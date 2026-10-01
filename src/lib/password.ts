import 'server-only';
import { scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// ── Contraseña del acceso interno: scrypt (node:crypto, sin dependencias) ──
// Formato de ADMIN_PASS_HASH, sin "$" para que la expansión de variables de
// los .env no lo altere:
//
//   scrypt:<N>:<r>:<p>:<sal base64url>:<hash base64url>
//
// Se genera con `node scripts/hash-password.mjs` (misma codificación; si se
// cambia aquí, cambiarla también allí).

const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Compara en tiempo constante; false ante cualquier hash mal formado. */
export async function verificarPassword(password: string, almacenado: string): Promise<boolean> {
  const partes = almacenado.split(':');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, salB64, hashB64] = partes;
  const N = Number(n), R = Number(r), P = Number(p);
  if (![N, R, P].every(Number.isInteger) || N < 2 ** 14 || R < 1 || P < 1) return false;
  const esperado = Buffer.from(hashB64, 'base64url');
  if (esperado.length !== KEYLEN) return false;
  const calculado = await scrypt(password, Buffer.from(salB64, 'base64url'), {
    N, r: R, p: P, maxmem: 256 * N * R + 1024 * 1024,
  });
  return timingSafeEqual(calculado, esperado);
}
