// Estado de sesión de la experiencia narrativa (landing), en sessionStorage.
// Siempre dentro de try/catch: sessionStorage puede no estar disponible
// (modo privado estricto, almacenamiento bloqueado).
//
//   logiaGuiaVista       'true'       la intro "cómo se recorre" ya se mostró
//   logiaPreloaderVisto  'true'       el preloader ya se reprodujo
//   logiaSonido          'on' | 'off' preferencia de sonido elegida

export const SESION = {
  intro: 'logiaGuiaVista',
  preloader: 'logiaPreloaderVisto',
  sonido: 'logiaSonido',
} as const;

type Clave = (typeof SESION)[keyof typeof SESION];

export function leerSesion(clave: Clave): string | null {
  try { return sessionStorage.getItem(clave); } catch { return null; }
}

export function guardarSesion(clave: Clave, valor: string): void {
  try { sessionStorage.setItem(clave, valor); } catch {}
}
