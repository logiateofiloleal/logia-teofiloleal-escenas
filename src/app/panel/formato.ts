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
