'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { actualizarEstado, type EstadoCambio } from '../../actions';
import styles from '../../panel.module.css';

const INICIAL: EstadoCambio = { status: 'idle', intento: 0 };

async function enviar(prev: EstadoCambio, fd: FormData): Promise<EstadoCambio> {
  try {
    return await actualizarEstado(prev, fd);
  } catch {
    return { status: 'error', mensaje: 'No pudimos conectar con el servidor. Inténtalo de nuevo.', intento: prev.intento + 1 };
  }
}

export default function CambioEstadoForm({ id, estadoActual, estados }: { id: string; estadoActual: string; estados: string[] }) {
  const [state, formAction, pending] = useActionState(enviar, INICIAL);

  return (
    <form action={formAction} className={styles.cambio} aria-busy={pending}>
      <input type="hidden" name="id" value={id} />
      <label className={styles.label} htmlFor="estado">Cambiar estado</label>
      <div className={styles.cambioFila}>
        {/* key: tras guardar, React reinicia el formulario; el selector se
            remonta con el estado ya guardado en vez de volver al anterior */}
        <select key={estadoActual} id="estado" name="estado" className={styles.select} defaultValue={estadoActual}>
          {estados.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button type="submit" className={styles.boton} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {state.status === 'ok' && state.mensaje && (
        // Sin redirección automática: se ve el estado actualizado y se
        // vuelve a la lista cuando se quiera.
        <div className={styles.confirmacion}>
          <p className={styles.ok} role="status">{state.mensaje}</p>
          <Link href="/panel" className={styles.volverSolicitudes}>Volver a solicitudes</Link>
        </div>
      )}
      {state.status === 'error' && state.mensaje && (
        <p className={styles.error} role="alert">{state.mensaje}</p>
      )}
    </form>
  );
}
