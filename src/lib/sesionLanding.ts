// Estado de la experiencia narrativa (landing). Siempre dentro de try/catch:
// el almacenamiento puede no estar disponible (modo privado estricto,
// almacenamiento bloqueado) y entonces la experiencia sigue sin él.
//
// Por sesión (sessionStorage):
//   logiaPreloaderVisto  'true'       el preloader ya se reprodujo
//   logiaSonido          'on' | 'off' preferencia de sonido elegida
//
// Entre visitas (localStorage) — primera ayuda del sonido (AmbientAudio):
//   logiaFtueSonido      'true'       ya se mostró la ayuda del sonido
// (La guía de navegación no se guarda: aparece en cada entrada por el
// preloader — ver landingLista.ts.)
// Solo indicadores funcionales, sin datos personales.

export const SESION = {
  preloader: 'logiaPreloaderVisto',
  sonido: 'logiaSonido',
} as const;

export const FTUE = {
  sonido: 'logiaFtueSonido',
} as const;

type Clave = (typeof SESION)[keyof typeof SESION];
type ClaveFtue = (typeof FTUE)[keyof typeof FTUE];

export function leerSesion(clave: Clave): string | null {
  try { return sessionStorage.getItem(clave); } catch { return null; }
}

export function guardarSesion(clave: Clave, valor: string): void {
  try { sessionStorage.setItem(clave, valor); } catch {}
}

/** true si esa ayuda de primera visita ya se mostró en este navegador. */
export function ftueVisto(clave: ClaveFtue): boolean {
  try { return localStorage.getItem(clave) === 'true'; } catch { return false; }
}

export function marcarFtue(clave: ClaveFtue): void {
  try { localStorage.setItem(clave, 'true'); } catch {}
}
