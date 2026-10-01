'use server';

import { createHash, timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verificarPassword } from '@/lib/password';
import { borrarSesion, crearSesion, obtenerSesion } from '@/lib/session';
import { estaBloqueado, registrarExito, registrarFallo } from '@/lib/loginThrottle';

// ── Acceso interno: Server Actions ───────────────────────────────────
// Las credenciales se validan solo aquí, contra ADMIN_USER y
// ADMIN_PASS_HASH (scrypt). Un único mensaje para cualquier fallo: nunca
// se revela si falló el usuario o la contraseña.

export interface EstadoAcceso {
  status: 'idle' | 'ok' | 'error';
  mensaje?: string;
  /** Solo el usuario se devuelve al formulario; la contraseña nunca. */
  usuario?: string;
  intento: number;
}

const CREDENCIALES_INCORRECTAS = 'Credenciales incorrectas o acceso no autorizado.';
const DEMASIADOS_INTENTOS = 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.';
const NO_DISPONIBLE = 'El acceso interno no está disponible en este momento.';
const PAUSA_FALLO_MS = 400;

const pausa = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Igualdad de cadenas en tiempo constante (compara sus hashes). */
function mismaCadena(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

async function ipCliente(): Promise<string> {
  const h = await headers();
  return h.get('x-nf-client-connection-ip') ?? h.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
}

export async function iniciarSesion(prev: EstadoAcceso, fd: FormData): Promise<EstadoAcceso> {
  const intento = prev.intento + 1;
  const usuario = String(fd.get('usuario') ?? '').trim().slice(0, 100);
  const password = String(fd.get('password') ?? '').slice(0, 256);
  const ip = await ipCliente();

  if (estaBloqueado(ip)) return { status: 'error', mensaje: DEMASIADOS_INTENTOS, usuario, intento };

  const adminUser = process.env.ADMIN_USER;
  const adminHash = process.env.ADMIN_PASS_HASH;
  if (!adminUser || !adminHash || !process.env.SESSION_SECRET) {
    console.error('[acceso] faltan ADMIN_USER, ADMIN_PASS_HASH o SESSION_SECRET');
    return { status: 'error', mensaje: NO_DISPONIBLE, usuario, intento };
  }

  // Ambas comprobaciones siempre, para no delatar cuál falló por el tiempo.
  const usuarioOk = mismaCadena(usuario, adminUser);
  let passwordOk = false;
  try {
    passwordOk = password.length > 0 && (await verificarPassword(password, adminHash));
  } catch (err) {
    console.error('[acceso] error verificando la contraseña:', err instanceof Error ? err.message : err);
  }

  if (!usuarioOk || !passwordOk) {
    registrarFallo(ip);
    await pausa(PAUSA_FALLO_MS);
    return { status: 'error', mensaje: CREDENCIALES_INCORRECTAS, usuario, intento };
  }

  registrarExito(ip);
  try {
    await crearSesion(adminUser);
  } catch (err) {
    console.error('[acceso] no se pudo crear la sesión:', err instanceof Error ? err.message : err);
    return { status: 'error', mensaje: NO_DISPONIBLE, usuario, intento };
  }
  return { status: 'ok', intento };
}

/** ¿Hay ya una sesión válida? (para saltar el modal si ya se entró). */
export async function sesionActiva(): Promise<boolean> {
  return (await obtenerSesion()) !== null;
}

export async function cerrarSesion(): Promise<void> {
  await borrarSesion();
  redirect('/');
}
