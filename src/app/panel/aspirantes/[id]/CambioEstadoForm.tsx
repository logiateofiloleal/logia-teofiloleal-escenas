'use client';

import { useActionState } from 'react';
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
        <select id="estado" name="estado" className={styles.select} defaultValue={estadoActual}>
          {estados.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button type="submit" className={styles.boton} disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {state.mensaje && (
        <p className={state.status === 'ok' ? styles.ok : styles.error} role={state.status === 'ok' ? 'status' : 'alert'}>
          {state.mensaje}
        </p>
      )}
    </form>
  );
}
