// Estado de sesión de la experiencia narrativa (landing), en sessionStorage.
// Siempre dentro de try/catch: sessionStorage puede no estar disponible
// (modo privado estricto, almacenamiento bloqueado).
//
//   logiaPreloaderVisto  'true'       el preloader ya se reprodujo
//   logiaSonido          'on' | 'off' preferencia de sonido elegida
//
// Las ayudas de navegación y sonido no se guardan: aparecen en cada entrada
// por el preloader (ver landingLista.ts y CoachMarks).

export const SESION = {
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
