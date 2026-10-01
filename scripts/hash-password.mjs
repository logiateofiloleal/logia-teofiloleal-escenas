#!/usr/bin/env node
// Genera ADMIN_PASS_HASH para el acceso interno (scrypt, node:crypto).
//
//   node scripts/hash-password.mjs            → pide la contraseña sin mostrarla
//   echo -n "clave" | node scripts/hash-password.mjs   → la lee de stdin
//
// Imprime una línea: scrypt:<N>:<r>:<p>:<sal>:<hash>. Pégala tal cual como
// valor de ADMIN_PASS_HASH (Netlify → Environment variables, o .env.local).
// Mismo formato que src/lib/password.ts: si uno cambia, cambiar el otro.

import { randomBytes, scrypt } from 'node:crypto';
import { createInterface } from 'node:readline';

const N = 2 ** 15, r = 8, p = 1, KEYLEN = 64;

function leerOculta(pregunta) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(pregunta)) process.stdout.write(s); };
    rl.question(pregunta, respuesta => { rl.close(); process.stdout.write('\n'); resolve(respuesta); });
  });
}

async function leerStdin() {
  let datos = '';
  for await (const trozo of process.stdin) datos += trozo;
  return datos.replace(/\r?\n$/, '');
}

const password = process.stdin.isTTY ? await leerOculta('Contraseña del acceso interno: ') : await leerStdin();
if (!password || password.length < 12) {
  console.error('La contraseña debe tener al menos 12 caracteres.');
  process.exit(1);
}

const sal = randomBytes(16);
scrypt(password, sal, KEYLEN, { N, r, p, maxmem: 256 * N * r + 1024 * 1024 }, (err, hash) => {
  if (err) { console.error(err.message); process.exit(1); }
  console.log(['scrypt', N, r, p, sal.toString('base64url'), hash.toString('base64url')].join(':'));
});
