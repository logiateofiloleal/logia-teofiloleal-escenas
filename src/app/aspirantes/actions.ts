'use server';

import { crearAspirante, existeEmail, existeTelefono } from '@/lib/aspirantes';
import {
  CAMPO_TRAMPA,
  validarAspirante,
  valoresFormulario,
  type AspiranteInput,
  type ErroresCampo,
  type ValoresFormulario,
} from '@/lib/aspiranteValidation';

export interface EstadoSolicitud {
  status: 'idle' | 'success' | 'error';
  mensaje?: string;
  errores?: ErroresCampo;
  /** Lo que la persona escribió, para no perderlo si hay que corregir. */
  valores?: ValoresFormulario;
  /** Cambia con cada respuesta: el formulario se remonta con `valores`. */
  intento: number;
}

const ERROR_ALMACENAMIENTO =
  'No pudimos registrar tu solicitud en este momento. Tus datos siguen en el formulario: inténtalo de nuevo en unos minutos.';

// El SDK de Blobs reintenta hasta 5 veces con 5 s de pausa; sin tope, una
// caída del almacenamiento dejaría "Enviando…" ~25 s y superaría el límite
// de tiempo de la función en Netlify (10 s). Por encima de esto se responde
// con el aviso de error.
const LIMITE_ALMACENAMIENTO_MS = 8000;

function conLimite<T>(tarea: Promise<T>, ms: number): Promise<T> {
  tarea.catch(() => {}); // si pierde la carrera, que su rechazo no quede sin manejar
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`sin respuesta del almacenamiento en ${ms} ms`)), ms);
  });
  return Promise.race([tarea, limite]).finally(() => clearTimeout(timer));
}

const DUP_EMAIL = 'Ya existe una solicitud registrada con este correo.';
const DUP_TELEFONO = 'Ya existe una solicitud registrada con este teléfono.';

/** Guarda la solicitud; devuelve los errores de duplicado o null si quedó registrada. */
async function registrar(data: AspiranteInput): Promise<ErroresCampo | null> {
  // Aviso de ambos duplicados a la vez; crearAspirante lo garantiza de
  // forma atómica aunque dos envíos coincidan.
  const [dupEmail, dupTelefono] = await Promise.all([existeEmail(data.email), existeTelefono(data.telefono)]);
  const errores: ErroresCampo = {};
  if (dupEmail) errores.email = DUP_EMAIL;
  if (dupTelefono) errores.telefono = DUP_TELEFONO;
  if (dupEmail || dupTelefono) return errores;

  const alta = await crearAspirante(data);
  if (alta.ok) return null;
  return alta.duplicado === 'email' ? { email: DUP_EMAIL } : { telefono: DUP_TELEFONO };
}

export async function enviarSolicitud(prev: EstadoSolicitud, fd: FormData): Promise<EstadoSolicitud> {
  const intento = prev.intento + 1;

  // Honeypot relleno: respuesta idéntica a un envío correcto, sin guardar
  // nada, para no darle al bot una señal que aprender.
  const trampa = fd.get(CAMPO_TRAMPA);
  if (typeof trampa === 'string' && trampa.trim() !== '') return { status: 'success', intento };

  const valores = valoresFormulario(fd);
  const validacion = validarAspirante(fd);
  if (!validacion.ok) {
    return { status: 'error', mensaje: 'Revisa los campos marcados.', errores: validacion.errores, valores, intento };
  }
  const data = validacion.data;

  try {
    const errores = await conLimite(registrar(data), LIMITE_ALMACENAMIENTO_MS);
    if (!errores) return { status: 'success', intento };

    return {
      status: 'error',
      mensaje: 'Ya recibimos una solicitud con estos datos. Si necesitas actualizarla, escríbenos por WhatsApp o redes sociales.',
      errores,
      valores,
      intento,
    };
  } catch (err) {
    // Solo el tipo de error: nunca datos del aspirante en los logs.
    console.error('[aspirantes] error de almacenamiento:', err instanceof Error ? `${err.name}: ${err.message}` : err);
    return { status: 'error', mensaje: ERROR_ALMACENAMIENTO, valores, intento };
  }
}
