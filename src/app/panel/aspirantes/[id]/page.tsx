import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ESTADOS, obtenerAspirante, type Aspirante } from '@/lib/aspirantes';
import { requerirSesion } from '@/lib/session';
import { claseEstado, formatearFecha } from '../../formato';
import CambioEstadoForm from './CambioEstadoForm';
import styles from '../../panel.module.css';

// ── Panel: detalle de una solicitud ──────────────────────────────────
// Todos los datos, la motivación completa (sin truncar), el consentimiento,
// el historial de estados y el cambio de estado.

export default async function AspirantePage({ params }: PageProps<'/panel/aspirantes/[id]'>) {
  await requerirSesion();
  const { id } = await params;

  let a: Aspirante | null;
  try {
    a = await obtenerAspirante(id);
  } catch (err) {
    console.error('[panel] no se pudo leer la solicitud:', err instanceof Error ? `${err.name}: ${err.message}` : err);
    return (
      <>
        <Link href="/panel" className={styles.volver}>← Volver a la lista</Link>
        <p className={styles.aviso} role="alert">No se pudo leer esta solicitud. Recarga la página en unos minutos.</p>
      </>
    );
  }
  if (!a) notFound();

  const historial = [...(a.historialEstados ?? [])].reverse(); // el más reciente arriba

  return (
    <>
      <Link href="/panel" className={styles.volver}>← Volver a la lista</Link>

      <div className={styles.heading}>
        <span className={styles.kicker}>Solicitud de aspirante</span>
        <h1 className={styles.title}>{a.nombre}</h1>
        <p className={styles.sub}>
          Recibida el {formatearFecha(a.timestamp)} ·{' '}
          <span className={`${styles.estado} ${claseEstado[a.estado] ?? ''}`}>{a.estado}</span>
        </p>
      </div>

      <div className={styles.detalle}>
        <section className={styles.bloque} aria-labelledby="h-datos">
          <h2 className={styles.bloqueTitulo} id="h-datos">Datos de contacto</h2>
          <dl className={styles.datos}>
            <div><dt>Nombre</dt><dd>{a.nombre}</dd></div>
            <div><dt>Edad</dt><dd>{a.edad ?? '—'}</dd></div>
            <div><dt>Teléfono</dt><dd><a href={`tel:${a.telefono}`}>{a.telefono}</a></dd></div>
            <div><dt>Correo</dt><dd><a href={`mailto:${a.email}`}>{a.email}</a></dd></div>
            <div><dt>Fecha de solicitud</dt><dd>{formatearFecha(a.timestamp)}</dd></div>
            <div>
              <dt>Consentimiento</dt>
              <dd>{a.consentimiento?.aceptado ? `Aceptado el ${formatearFecha(a.consentimiento.fecha)}` : 'No consta'}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.bloque} aria-labelledby="h-estado">
          <h2 className={styles.bloqueTitulo} id="h-estado">Estado</h2>
          <CambioEstadoForm id={a.id} estadoActual={a.estado} estados={[...ESTADOS]} />
        </section>

        <section className={`${styles.bloque} ${styles.bloqueAncho}`} aria-labelledby="h-motivacion">
          <h2 className={styles.bloqueTitulo} id="h-motivacion">Motivación</h2>
          <p className={styles.motivacion}>{a.descripcion}</p>
        </section>

        <section className={`${styles.bloque} ${styles.bloqueAncho}`} aria-labelledby="h-historial">
          <h2 className={styles.bloqueTitulo} id="h-historial">Historial de estados</h2>
          <ol className={styles.historial}>
            {historial.map((h, i) => (
              <li key={`${h.fecha}-${i}`}>
                <span className={`${styles.estado} ${claseEstado[h.estado] ?? ''}`}>{h.estado}</span>
                <time dateTime={h.fecha}>{formatearFecha(h.fecha)}</time>
                {h.nota && <span className={styles.nota}>{h.nota}</span>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
