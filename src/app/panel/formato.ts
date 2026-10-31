import { edadCumplida } from '@/lib/aspiranteValidation';
import styles from './panel.module.css';

// Fechas del panel en hora de Barquisimeto (el servidor corre en UTC).
const fmt = new Intl.DateTimeFormat('es-VE', {
  timeZone: 'America/Caracas',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const fmtDia = new Intl.DateTimeFormat('es-VE', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });

/** Fecha de nacimiento (YYYY-MM-DD) sin hora ni cambio de zona, para que no se corra un día. */
export function formatearFechaNacimiento(fecha: string | undefined): string {
  const m = fecha ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha) : null;
  if (!m) return '—';
  const base = fmtDia.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
  const edad = edadCumplida(fecha!);
  return edad === null ? base : `${base} (${edad} años)`;
}

export function formatearFecha(iso: string | undefined): string {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? fmt.format(d) : '—';
}

/** Color discreto por estado (el texto del estado siempre acompaña). */
export const claseEstado: Record<string, string | undefined> = {
  'Nuevo': styles.estNuevo,
  'Contactado': styles.estContactado,
  'En proceso': styles.estProceso,
  'Aprobado': styles.estAprobado,
  'Rechazado': styles.estRechazado,
};
