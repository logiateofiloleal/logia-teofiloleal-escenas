import Link from 'next/link';
import { listarAspirantes, type ListadoAspirantes } from '@/lib/aspirantes';
import { requerirSesion } from '@/lib/session';
import { claseEstado, formatearFecha } from './formato';
import styles from './panel.module.css';

// ── Panel: solicitudes de aspirantes ─────────────────────────────────
// Lista leída del store "aspirantes" (Netlify Blobs) en el servidor, más
// recientes primero. Cada fila abre /panel/aspirantes/[id].

export default async function PanelPage() {
  await requerirSesion();

  let listado: ListadoAspirantes | null = null;
  try {
    listado = await listarAspirantes();
  } catch (err) {
    console.error('[panel] no se pudieron listar las solicitudes:', err instanceof Error ? `${err.name}: ${err.message}` : err);
  }

  return (
    <>
      <div className={styles.heading}>
        <span className={styles.kicker}>Gestión interna</span>
        <h1 className={styles.title}>Solicitudes de aspirantes</h1>
        {listado && (
          <p className={styles.sub}>
            {listado.aspirantes.length === 1 ? '1 solicitud' : `${listado.aspirantes.length} solicitudes`} · más recientes primero
          </p>
        )}
      </div>

      {!listado && (
        <p className={styles.aviso} role="alert">
          No se pudieron cargar las solicitudes. Recarga la página en unos minutos.
        </p>
      )}

      {listado && listado.ilegibles > 0 && (
        <p className={styles.aviso} role="status">
          {listado.ilegibles === 1 ? '1 registro no se pudo leer y se omitió.' : `${listado.ilegibles} registros no se pudieron leer y se omitieron.`}
        </p>
      )}

      {listado && listado.aspirantes.length === 0 && (
        <p className={styles.vacio}>Aún no hay solicitudes registradas.</p>
      )}

      {listado && listado.aspirantes.length > 0 && (
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Fecha de solicitud</th>
              <th scope="col">Teléfono</th>
              <th scope="col">Correo</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {listado.aspirantes.map(a => (
              <tr key={a.id}>
                <td data-label="Nombre">
                  <Link href={`/panel/aspirantes/${a.id}`} className={styles.nombre}>{a.nombre}</Link>
                </td>
                <td data-label="Fecha">{formatearFecha(a.timestamp)}</td>
                <td data-label="Teléfono">{a.telefono}</td>
                <td data-label="Correo" className={styles.correo}>{a.email}</td>
                <td data-label="Estado">
                  <span className={`${styles.estado} ${claseEstado[a.estado] ?? ''}`}>{a.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
