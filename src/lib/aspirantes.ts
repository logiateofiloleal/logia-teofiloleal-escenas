import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AspiranteInput } from './aspiranteValidation';

// ── Aspirantes: capa de datos (Supabase / Postgres) ───────────────────
// Tabla public.aspirantes (supabase/migrations/…_aspirantes.sql). La
// unicidad de correo y teléfono la garantizan restricciones UNIQUE de
// Postgres, así que dos envíos simultáneos con el mismo dato no pueden
// registrarse los dos. La tabla tiene RLS sin políticas: solo se accede
// desde el servidor con la clave service_role (nunca con prefijo
// NEXT_PUBLIC_). Variables: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.

export const ESTADOS = ['Nuevo', 'Contactado', 'En proceso', 'Aprobado', 'Rechazado'] as const;
export type EstadoAspirante = (typeof ESTADOS)[number];

export interface CambioEstado {
  estado: EstadoAspirante;
  fecha: string; // ISO 8601
  nota: string;
}

export interface Aspirante extends AspiranteInput {
  id: string;
  estado: EstadoAspirante;
  timestamp: string; // ISO 8601, alta de la solicitud
  historialEstados: CambioEstado[];
  consentimiento: { aceptado: true; fecha: string };
}

export type ResultadoAlta =
  | { ok: true; id: string }
  | { ok: false; duplicado: 'email' | 'telefono' };

const TABLA = 'aspirantes';
const PAGINA = 1000;

let cliente: SupabaseClient | undefined;
function db(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  cliente = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}

interface Fila {
  id: string;
  nombre: string;
  fecha_nacimiento: string;
  telefono: string;
  email: string;
  descripcion: string;
  estado: EstadoAspirante;
  historial_estados: CambioEstado[];
  consentimiento_fecha: string;
  creado_en: string;
}

const iso = (v: string) => new Date(v).toISOString();

function aAspirante(f: Fila): Aspirante {
  return {
    id: f.id,
    nombre: f.nombre,
    fechaNacimiento: f.fecha_nacimiento,
    telefono: f.telefono,
    email: f.email,
    descripcion: f.descripcion,
    estado: f.estado,
    timestamp: iso(f.creado_en),
    historialEstados: (f.historial_estados ?? []).map(c => ({ ...c, fecha: iso(c.fecha) })),
    consentimiento: { aceptado: true, fecha: iso(f.consentimiento_fecha) },
  };
}

async function existe(columna: 'email' | 'telefono', valor: string): Promise<boolean> {
  const { data, error } = await db().from(TABLA).select('id').eq(columna, valor).limit(1);
  if (error) throw error;
  return data.length > 0;
}

/** `email` ya normalizado (normalizarEmail). */
export const existeEmail = (email: string) => existe('email', email);

/** `telefono` ya normalizado (normalizarTelefono). */
export const existeTelefono = (telefono: string) => existe('telefono', telefono);

/** Registra una solicitud validada. Lanza si falla el almacenamiento. */
export async function crearAspirante(input: AspiranteInput): Promise<ResultadoAlta> {
  const id = randomUUID();
  const ahora = new Date().toISOString();
  const { error } = await db().from(TABLA).insert({
    id,
    nombre: input.nombre,
    fecha_nacimiento: input.fechaNacimiento,
    telefono: input.telefono,
    email: input.email,
    descripcion: input.descripcion,
    estado: 'Nuevo',
    historial_estados: [{ estado: 'Nuevo', fecha: ahora, nota: 'Solicitud registrada' }],
    consentimiento_fecha: ahora,
    creado_en: ahora,
  });
  if (!error) return { ok: true, id };
  if (error.code === '23505') {
    const detalle = `${error.message} ${error.details ?? ''}`;
    if (detalle.includes('aspirantes_email_key')) return { ok: false, duplicado: 'email' };
    if (detalle.includes('aspirantes_telefono_key')) return { ok: false, duplicado: 'telefono' };
  }
  throw error;
}

// ── Panel interno: lectura y cambio de estado ─────────────────────────
// Las Server Actions que llaman a estas funciones verifican la sesión antes.

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTA_PANEL = 'Estado actualizado desde el panel';

export const esEstado = (v: string): v is EstadoAspirante => (ESTADOS as readonly string[]).includes(v);

export interface ListadoAspirantes {
  aspirantes: Aspirante[];
  /** Registros ilegibles. La tabla valida su forma, así que no hay (siempre 0); se mantiene para el panel. */
  ilegibles: number;
}

/** Todas las solicitudes, más recientes primero. Un error de red se propaga para que el panel lo muestre. */
export async function listarAspirantes(): Promise<ListadoAspirantes> {
  const aspirantes: Aspirante[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await db()
      .from(TABLA)
      .select('*')
      .order('creado_en', { ascending: false })
      .order('id')
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;
    aspirantes.push(...(data as Fila[]).map(aAspirante));
    if (data.length < PAGINA) break;
  }
  return { aspirantes, ilegibles: 0 };
}

/** Una solicitud por id (null si el id no es válido o no existe). */
export async function obtenerAspirante(id: string): Promise<Aspirante | null> {
  if (!ID_RE.test(id)) return null;
  const { data, error } = await db().from(TABLA).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? aAspirante(data as Fila) : null;
}

export type ResultadoCambio =
  | { ok: true; aspirante: Aspirante; sinCambios: boolean }
  | { ok: false; motivo: 'no-encontrado' | 'conflicto' };

/**
 * Cambia el estado y AÑADE una entrada al historial, conservando el resto
 * del registro. Lo hace la función SQL cambiar_estado_aspirante en una sola
 * transacción con la fila bloqueada: ningún cambio pisa a otro ni se pierde
 * historial, así que ya no existe el caso 'conflicto'.
 */
export async function cambiarEstado(id: string, estado: EstadoAspirante): Promise<ResultadoCambio> {
  if (!ID_RE.test(id)) return { ok: false, motivo: 'no-encontrado' };
  const { data, error } = await db().rpc('cambiar_estado_aspirante', { p_id: id, p_estado: estado, p_nota: NOTA_PANEL });
  if (error) throw error;
  if (!data) return { ok: false, motivo: 'no-encontrado' };
  const { cambiado, aspirante } = data as { cambiado: boolean; aspirante: Fila };
  return { ok: true, aspirante: aAspirante(aspirante), sinCambios: !cambiado };
}
