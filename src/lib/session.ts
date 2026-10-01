import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// ── Sesión del acceso interno ─────────────────────────────────────────
// Sesión sin estado en una cookie firmada con HMAC-SHA256 (SESSION_SECRET):
//
//   <payload base64url>.<firma base64url>   payload = { sub, iat, exp }
//
// La cookie es httpOnly (el navegador no la expone a JavaScript), Secure
// en producción, SameSite=Lax y dura 8 horas. Nada de la sesión vive en
// sessionStorage ni llega al cliente salvo la propia cookie.
//
// Uso en rutas protegidas (/interno ahora, /panel después):
//   const sesion = await requerirSesion();   // redirige si no hay sesión

export const COOKIE_SESION = 'lt_sesion';
export const DURACION_SESION_S = 8 * 60 * 60;

export interface Sesion {
  sub: string;
  iat: number; // segundos
  exp: number; // segundos
}

function secreto(): Buffer | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? Buffer.from(s) : null;
}

const firmar = (datos: string, clave: Buffer) => createHmac('sha256', clave).update(datos).digest('base64url');

function decodificar(token: string | undefined, clave: Buffer): Sesion | null {
  if (!token) return null;
  const [datos, firma, ...resto] = token.split('.');
  if (!datos || !firma || resto.length) return null;
  const esperada = Buffer.from(firmar(datos, clave));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const s = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8')) as Sesion;
    if (typeof s.sub !== 'string' || typeof s.exp !== 'number') return null;
    return s.exp > Math.floor(Date.now() / 1000) ? s : null;
  } catch {
    return null;
  }
}

/** Crea la sesión y la guarda en la cookie. Lanza si falta SESSION_SECRET. */
export async function crearSesion(sub: string): Promise<void> {
  const clave = secreto();
  if (!clave) throw new Error('SESSION_SECRET ausente o demasiado corto (mínimo 32 caracteres)');
  const ahora = Math.floor(Date.now() / 1000);
  const datos = Buffer.from(JSON.stringify({ sub, iat: ahora, exp: ahora + DURACION_SESION_S })).toString('base64url');
  (await cookies()).set(COOKIE_SESION, `${datos}.${firmar(datos, clave)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_SESION_S,
  });
}

/** La sesión válida actual, o null (cookie ausente, alterada o caducada). */
export async function obtenerSesion(): Promise<Sesion | null> {
  // La cookie se lee siempre primero: eso hace dinámica cualquier ruta que
  // consulte la sesión. Si faltara SESSION_SECRET en el build y se saliera
  // antes, Next prerenderizaría la ruta como estática (redirección fija).
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  const clave = secreto();
  return clave ? decodificar(token, clave) : null;
}

export async function borrarSesion(): Promise<void> {
  (await cookies()).delete(COOKIE_SESION);
}

/** Para páginas protegidas: sin sesión, vuelve al inicio con el acceso abierto. */
export async function requerirSesion(destinoSinSesion = '/?acceso'): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect(destinoSinSesion);
  return sesion;
}
