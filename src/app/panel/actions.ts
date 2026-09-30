'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cambiarEstado, esEstado } from '@/lib/aspirantes';
import { obtenerSesion } from '@/lib/session';

// ── Panel: Server Actions ────────────────────────────────────────────
// Cada acción verifica la sesión por sí misma: una Server Action es un
// endpoint público aunque su formulario solo se muestre en /panel.

export interface EstadoCambio {
  status: 'idle' | 'ok' | 'error';
  mensaje?: string;
  intento: number;
}

export async function actualizarEstado(prev: EstadoCambio, fd: FormData): Promise<EstadoCambio> {
  if (!(await obtenerSesion())) redirect('/?acceso');
  const intento = prev.intento + 1;

  const id = String(fd.get('id') ?? '');
  const estado = String(fd.get('estado') ?? '');
  if (!esEstado(estado)) return { status: 'error', mensaje: 'Estado no válido.', intento };

  try {
    const r = await cambiarEstado(id, estado);
    if (!r.ok) {
      return {
        status: 'error',
        mensaje: r.motivo === 'no-encontrado'
          ? 'Esta solicitud ya no existe.'
          : 'La solicitud cambió mientras tanto. Recarga la página e inténtalo de nuevo.',
        intento,
      };
    }
    revalidatePath('/panel');
    revalidatePath(`/panel/aspirantes/${id}`);
    return {
      status: 'ok',
      mensaje: r.sinCambios ? `El estado ya era «${estado}».` : `Estado actualizado a «${estado}».`,
      intento,
    };
  } catch (err) {
    console.error('[panel] no se pudo cambiar el estado:', err instanceof Error ? `${err.name}: ${err.message}` : err);
    return { status: 'error', mensaje: 'No se pudo guardar el cambio. Inténtalo de nuevo en unos minutos.', intento };
  }
}
