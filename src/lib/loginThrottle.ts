import 'server-only';

// ── Freno básico contra intentos repetidos de acceso ──────────────────
// Por IP: tras MAX_FALLOS fallos dentro de VENTANA_MS, bloqueo durante
// BLOQUEO_MS. Vive en la memoria de cada instancia del servidor (en
// Netlify, por instancia de función): frena la fuerza bruta desde un
// navegador o script simple, no un ataque distribuido. Complementa el
// coste de scrypt y la pausa fija tras cada fallo.

const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const BLOQUEO_MS = 15 * 60 * 1000;

interface Registro { fallos: number; desde: number; bloqueadoHasta: number }
const registros = new Map<string, Registro>();

function limpiar(ahora: number) {
  if (registros.size < 500) return;
  for (const [ip, r] of registros) if (r.bloqueadoHasta < ahora && ahora - r.desde > VENTANA_MS) registros.delete(ip);
}

export function estaBloqueado(ip: string): boolean {
  return (registros.get(ip)?.bloqueadoHasta ?? 0) > Date.now();
}

export function registrarFallo(ip: string): void {
  const ahora = Date.now();
  limpiar(ahora);
  const r = registros.get(ip);
  if (!r || ahora - r.desde > VENTANA_MS) {
    registros.set(ip, { fallos: 1, desde: ahora, bloqueadoHasta: 0 });
    return;
  }
  r.fallos += 1;
  if (r.fallos >= MAX_FALLOS) r.bloqueadoHasta = ahora + BLOQUEO_MS;
}

export function registrarExito(ip: string): void {
  registros.delete(ip);
}
