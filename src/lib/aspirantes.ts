import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import type { AspiranteInput } from './aspiranteValidation';

// ── Aspirantes: capa de datos (Netlify Blobs) ─────────────────────────
// Cada solicitud es un registro independiente en el store "aspirantes":
//
//   registro/<id>                 → Aspirante (JSON)
//   indice/email/<sha256>         → id   (unicidad del correo)
//   indice/telefono/<sha256>      → id   (unicidad del teléfono)
//
// Los índices se reclaman con escritura condicional (onlyIfNew), así que
// dos envíos simultáneos con el mismo correo o teléfono no pueden
// registrarse los dos. Las claves de índice usan un hash para no dejar
// datos personales en los nombres de clave.
//
// Un índice sin registro (alta interrumpida a mitad, p. ej. por el límite
// de tiempo de la función) no bloquea para siempre: pasado INDICE_EN_CURSO_MS
// se considera huérfano y se puede volver a reclamar.
//
// En Netlify el runtime de Next inyecta el contexto de Blobs: no hace
// falta ninguna variable. Fuera de Netlify, getStore lanza
// MissingBlobsEnvironmentError (la acción lo trata como error de
// almacenamiento).

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

/** Un índice sin registro más reciente que esto es un alta todavía en curso. */
const INDICE_EN_CURSO_MS = 2 * 60 * 1000;

type Store = ReturnType<typeof getStore>;
const store = () => getStore({ name: 'aspirantes', consistency: 'strong' });
const hash = (valor: string) => createHash('sha256').update(valor).digest('hex');
const clave = {
  registro: (id: string) => `registro/${id}`,
  email: (email: string) => `indice/email/${hash(email)}`,
  telefono: (telefono: string) => `indice/telefono/${hash(telefono)}`,
};

/** ¿El índice corresponde a una solicitud real (o a un alta en curso)? */
async function indiceVigente(s: Store, key: string): Promise<{ vigente: boolean; etag?: string } | null> {
  const entrada = await s.getWithMetadata(key);
  if (!entrada) return null;
  if (await s.getMetadata(clave.registro(entrada.data))) return { vigente: true };
  const creado = Number(entrada.metadata?.creado ?? 0);
  if (Date.now() - creado < INDICE_EN_CURSO_MS) return { vigente: true };
  // La lectura no siempre trae el ETag (el servidor local de Blobs no lo
  // envía en GET); el listado sí, en ambos entornos.
  const etag = entrada.etag ?? (await s.list({ prefix: key })).blobs.find(b => b.key === key)?.etag;
  return { vigente: false, etag };
}

/** Reclama un índice para `id`; false si pertenece a otra solicitud. */
async function reclamar(s: Store, key: string, id: string): Promise<boolean> {
  const metadata = { creado: Date.now() };
  if ((await s.set(key, id, { onlyIfNew: true, metadata })).modified) return true;
  const actual = await indiceVigente(s, key);
  if (!actual) return (await s.set(key, id, { onlyIfNew: true, metadata })).modified;
  if (actual.vigente || !actual.etag) return false;
  // Huérfano: se sustituye solo si nadie lo cambió mientras tanto.
  return (await s.set(key, id, { onlyIfMatch: actual.etag, metadata })).modified;
}

/** `email` ya normalizado (normalizarEmail). */
export async function existeEmail(email: string): Promise<boolean> {
  return (await indiceVigente(store(), clave.email(email)))?.vigente ?? false;
}

/** `telefono` ya normalizado (normalizarTelefono). */
export async function existeTelefono(telefono: string): Promise<boolean> {
  return (await indiceVigente(store(), clave.telefono(telefono)))?.vigente ?? false;
}

/** Registra una solicitud validada. Lanza si falla el almacenamiento. */
export async function crearAspirante(input: AspiranteInput): Promise<ResultadoAlta> {
  const s = store();
  const id = randomUUID();
  const ahora = new Date().toISOString();

  if (!(await reclamar(s, clave.email(input.email), id))) return { ok: false, duplicado: 'email' };

  let telefonoReclamado = false;
  try {
    if (!(await reclamar(s, clave.telefono(input.telefono), id))) {
      await s.delete(clave.email(input.email));
      return { ok: false, duplicado: 'telefono' };
    }
    telefonoReclamado = true;

    const aspirante: Aspirante = {
      id,
      ...input,
      estado: 'Nuevo',
      timestamp: ahora,
      historialEstados: [{ estado: 'Nuevo', fecha: ahora, nota: 'Solicitud registrada' }],
      consentimiento: { aceptado: true, fecha: ahora },
    };
    await s.setJSON(clave.registro(id), aspirante);
    return { ok: true, id };
  } catch (err) {
    // Libera los índices reclamados por este intento para que la persona
    // pueda reintentar (nunca los de otra solicitud).
    await Promise.allSettled([
      s.delete(clave.email(input.email)),
      telefonoReclamado ? s.delete(clave.telefono(input.telefono)) : null,
    ]);
    throw err;
  }
}

// ── Panel interno: lectura y cambio de estado ─────────────────────────
// Solo se leen y reescriben claves registro/<id>; los índices de correo y
// teléfono no se tocan nunca desde el panel. Las Server Actions que llaman
// a estas funciones verifican la sesión antes.

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LECTURAS_EN_PARALELO = 8;
const NOTA_PANEL = 'Estado actualizado desde el panel';

export const esEstado = (v: string): v is EstadoAspirante => (ESTADOS as readonly string[]).includes(v);

/** Forma mínima de un registro válido (lo demás se muestra si existe). */
function esAspirante(v: unknown): v is Aspirante {
  const a = v as Partial<Aspirante> | null;
  return !!a && typeof a === 'object' && typeof a.id === 'string' && typeof a.nombre === 'string'
    && typeof a.timestamp === 'string' && typeof a.estado === 'string' && Array.isArray(a.historialEstados);
}

export interface ListadoAspirantes {
  aspirantes: Aspirante[];
  /** Registros presentes pero ilegibles (JSON corrupto o forma inválida): se omiten. */
  ilegibles: number;
}

/**
 * Todas las solicitudes, más recientes primero. list() recorre todas las
 * páginas del listado; las lecturas van en lotes para no abrir cientos de
 * peticiones a la vez. Un registro corrupto se omite (y se cuenta); un
 * error de red se propaga para que el panel lo muestre como tal.
 */
export async function listarAspirantes(): Promise<ListadoAspirantes> {
  const s = store();
  const { blobs } = await s.list({ prefix: 'registro/' });
  const aspirantes: Aspirante[] = [];
  let ilegibles = 0;
  for (let i = 0; i < blobs.length; i += LECTURAS_EN_PARALELO) {
    const lote = await Promise.all(blobs.slice(i, i + LECTURAS_EN_PARALELO).map(async b => {
      try {
        const v: unknown = await s.get(b.key, { type: 'json' });
        if (v === null) return 'borrado' as const; // desapareció entre el listado y la lectura
        return esAspirante(v) ? v : ('ilegible' as const);
      } catch (err) {
        if (err instanceof SyntaxError) return 'ilegible' as const;
        throw err;
      }
    }));
    for (const r of lote) {
      if (r === 'ilegible') ilegibles++;
      else if (r !== 'borrado') aspirantes.push(r);
    }
  }
  aspirantes.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return { aspirantes, ilegibles };
}

/** Una solicitud por id (null si el id no es válido o no existe). Lanza si está corrupta. */
export async function obtenerAspirante(id: string): Promise<Aspirante | null> {
  if (!ID_RE.test(id)) return null;
  const v: unknown = await store().get(clave.registro(id), { type: 'json' });
  if (v === null) return null;
  if (!esAspirante(v)) throw new Error(`registro/${id} ilegible`);
  return v;
}

export type ResultadoCambio =
  | { ok: true; aspirante: Aspirante; sinCambios: boolean }
  | { ok: false; motivo: 'no-encontrado' | 'conflicto' };

/**
 * Cambia el estado y AÑADE una entrada al historial, conservando el resto
 * del registro tal cual. La escritura es condicional (onlyIfMatch con el
 * ETag leído): si otro cambio llegó en medio, se relee y se reintenta, así
 * que ningún cambio de estado pisa a otro ni se pierde historial.
 */
export async function cambiarEstado(id: string, estado: EstadoAspirante): Promise<ResultadoCambio> {
  if (!ID_RE.test(id)) return { ok: false, motivo: 'no-encontrado' };
  const s = store();
  const key = clave.registro(id);
  for (let intento = 0; intento < 3; intento++) {
    const entrada = await s.getWithMetadata(key, { type: 'json' });
    if (!entrada) return { ok: false, motivo: 'no-encontrado' };
    const actual: unknown = entrada.data;
    if (!esAspirante(actual)) throw new Error(`registro/${id} ilegible`);
    if (actual.estado === estado) return { ok: true, aspirante: actual, sinCambios: true };

    // El servidor local de Blobs no envía el ETag en GET; el listado sí.
    const etag = entrada.etag ?? (await s.list({ prefix: key })).blobs.find(b => b.key === key)?.etag;
    if (!etag) throw new Error(`sin ETag para registro/${id}`);

    const actualizado: Aspirante = {
      ...actual,
      estado,
      historialEstados: [...actual.historialEstados, { estado, fecha: new Date().toISOString(), nota: NOTA_PANEL }],
    };
    if ((await s.setJSON(key, actualizado, { onlyIfMatch: etag })).modified) {
      return { ok: true, aspirante: actualizado, sinCambios: false };
    }
  }
  return { ok: false, motivo: 'conflicto' };
}
