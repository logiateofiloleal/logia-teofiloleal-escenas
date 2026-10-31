// ── Solicitud de aspirante: validación y normalización ────────────────
// Única fuente de verdad de las reglas del formulario. La usa la Server
// Action de /aspirantes antes de tocar el almacenamiento; el formulario no
// valida en el navegador (noValidate) para que todos los errores lleguen
// con el mismo texto y la misma presentación accesible.

export const CAMPOS = ['nombre', 'fechaNacimiento', 'telefono', 'email', 'descripcion'] as const;
export type Campo = (typeof CAMPOS)[number];
export type CampoFormulario = Campo | 'consentimiento';
export type ErroresCampo = Partial<Record<CampoFormulario, string>>;

/** Honeypot: invisible para personas, tentador para bots de formularios. */
export const CAMPO_TRAMPA = 'sitio_web';

export const LIMITES = {
  nombre: { min: 3, max: 120 },
  // Edad cumplida, calculada desde la fecha de nacimiento. 21 es el mínimo
  // para ingresar a la institución.
  edad: { min: 21, max: 99 },
  email: { max: 254 },
  descripcion: { min: 20, max: 2000 },
} as const;

export interface AspiranteInput {
  nombre: string;
  /** Fecha de nacimiento, YYYY-MM-DD. */
  fechaNacimiento: string;
  telefono: string;
  email: string;
  descripcion: string;
}

export type ResultadoValidacion =
  | { ok: true; data: AspiranteInput }
  | { ok: false; errores: ErroresCampo };

export type ValoresFormulario = Partial<Record<Campo, string>> & { consentimiento?: boolean };

const texto = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : '');

/** Lo que la persona escribió, tal cual, para devolverlo al formulario. */
export function valoresFormulario(fd: FormData): ValoresFormulario {
  const valores: ValoresFormulario = { consentimiento: fd.get('consentimiento') === 'si' };
  for (const campo of CAMPOS) valores[campo] = texto(fd.get(campo)).slice(0, 4000);
  return valores;
}
/** Fecha de hoy (YYYY-MM-DD) en Venezuela; el servidor corre en UTC. */
export function hoyCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
}

/** YYYY-MM-DD → [año, mes, día], o null si no es una fecha real (p. ej. 2000-02-30). */
function partesFecha(fecha: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return null;
  const [y, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(y, mes - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d ? [y, mes, d] : null;
}

/** Años cumplidos a `hoy` (YYYY-MM-DD); null si la fecha no es válida. */
export function edadCumplida(fechaNacimiento: string, hoy: string = hoyCaracas()): number | null {
  const nac = partesFecha(fechaNacimiento);
  const act = partesFecha(hoy);
  if (!nac || !act) return null;
  const cumplioEsteAnio = act[1] > nac[1] || (act[1] === nac[1] && act[2] >= nac[2]);
  return act[0] - nac[0] - (cumplioEsteAnio ? 0 : 1);
}

/** Fecha de hace `anios` años (YYYY-MM-DD): ayuda para min/max del selector de fecha. */
export function fechaHaceAnios(anios: number): string {
  const [y, m, d] = partesFecha(hoyCaracas())!;
  return new Date(Date.UTC(y - anios, m - 1, d)).toISOString().slice(0, 10);
}

const colapsar = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Teléfono en forma canónica para guardar y detectar duplicados:
 * "0414-123 45 67", "(0414) 1234567", "+58 414 1234567" → "+584141234567".
 * Números venezolanos (0 + 10 dígitos, 58 + 10 o 10 dígitos móviles) pasan
 * a +58; los extranjeros deben venir con "+". Devuelve null si no es válido.
 */
export function normalizarTelefono(raw: string): string | null {
  const limpio = raw.trim().replace(/[\s().\-/]/g, '');
  if (!/^\+?\d+$/.test(limpio)) return null;
  let tel = limpio;
  if (!tel.startsWith('+')) {
    if (/^0\d{10}$/.test(tel)) tel = '+58' + tel.slice(1);
    else if (/^58\d{10}$/.test(tel)) tel = '+' + tel;
    else if (/^4\d{9}$/.test(tel)) tel = '+58' + tel;
    else return null;
  }
  return /^\+\d{8,15}$/.test(tel) ? tel : null;
}

export function normalizarEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

export function validarAspirante(fd: FormData): ResultadoValidacion {
  const errores: ErroresCampo = {};

  const nombre = colapsar(texto(fd.get('nombre')));
  if (!nombre) errores.nombre = 'Escribe tu nombre y apellido.';
  else if (nombre.length < LIMITES.nombre.min || !/\p{L}/u.test(nombre))
    errores.nombre = 'Escribe tu nombre y apellido completos.';
  else if (nombre.length > LIMITES.nombre.max)
    errores.nombre = `El nombre no puede superar ${LIMITES.nombre.max} caracteres.`;

  const fechaRaw = texto(fd.get('fechaNacimiento')).trim();
  const edad = edadCumplida(fechaRaw);
  if (!fechaRaw) errores.fechaNacimiento = 'Indica tu fecha de nacimiento.';
  else if (edad === null) errores.fechaNacimiento = 'Escribe una fecha de nacimiento válida.';
  else if (edad < LIMITES.edad.min)
    errores.fechaNacimiento = `Debes tener al menos ${LIMITES.edad.min} años para presentar tu solicitud.`;
  else if (edad > LIMITES.edad.max)
    errores.fechaNacimiento = `Revisa la fecha: indica una edad entre ${LIMITES.edad.min} y ${LIMITES.edad.max} años.`;

  const telefonoRaw = texto(fd.get('telefono'));
  const telefono = normalizarTelefono(telefonoRaw);
  if (!telefonoRaw.trim()) errores.telefono = 'Indica un teléfono de contacto.';
  else if (!telefono) errores.telefono = 'Escribe un teléfono válido con su código de área, p. ej. 0414 123 4567.';

  const email = normalizarEmail(texto(fd.get('email')));
  if (!email) errores.email = 'Indica tu correo electrónico.';
  else if (email.length > LIMITES.email.max || !EMAIL_RE.test(email))
    errores.email = 'Escribe un correo electrónico válido, p. ej. nombre@correo.com.';

  const descripcion = texto(fd.get('descripcion')).replace(/\r\n?/g, '\n').trim();
  if (!descripcion) errores.descripcion = 'Cuéntanos qué te motiva a acercarte a la Masonería.';
  else if (descripcion.length < LIMITES.descripcion.min)
    errores.descripcion = `Cuéntanos un poco más (al menos ${LIMITES.descripcion.min} caracteres).`;
  else if (descripcion.length > LIMITES.descripcion.max)
    errores.descripcion = `El texto no puede superar ${LIMITES.descripcion.max} caracteres.`;

  if (texto(fd.get('consentimiento')) !== 'si')
    errores.consentimiento = 'Necesitamos tu autorización para tratar estos datos.';

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, data: { nombre, fechaNacimiento: fechaRaw, telefono: telefono!, email, descripcion } };
}
