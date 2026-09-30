import type { Metadata } from 'next';
import Image, { getImageProps } from 'next/image';
import Header from '@/components/Header/Header';
import { requerirSesion } from '@/lib/session';
import { cerrarSesion } from './actions';
import styles from './interno.module.css';

// ── Área interna (protegida) ─────────────────────────────────────────
// Destino tras el acceso del modal. Ya no es el profano sino el hermano
// iniciado: interior del templo, el hermano a la izquierda, el altar al
// centro y un espacio oscuro a la derecha para la tarjeta (abajo en
// vertical). Fondo: login-templo-hermano.webp (el anterior,
// login-templo.webp, se conserva). Sin sesión válida, requerirSesion()
// devuelve al inicio con el acceso abierto (/?acceso).

export const metadata: Metadata = {
  title: 'Área interna — Logia Teófilo Leal N° 115',
  description: 'Área reservada para hermanos de la Respetable Logia Teófilo Leal N° 115.',
  robots: { index: false, follow: false },
};

function Templo() {
  const { props } = getImageProps({
    alt: '', sizes: '100vw', loading: 'eager', src: '/assets/img/fondos/login-templo-hermano.webp', width: 1672, height: 941,
  });

  return (
    <div className={styles.stage} aria-hidden="true">
      <img {...props} alt="" className={styles.stageImg} fetchPriority="high" />
    </div>
  );
}

export default async function InternoPage() {
  await requerirSesion();

  return (
    <>
      <Header />

      <main className={styles.page}>
        <Templo />

        <section className={styles.card} aria-labelledby="heading-interno">
          <Image
            className={styles.logo}
            src="/assets/img/logo.png"
            alt="Logo Logia Teófilo Leal N° 115"
            width={64}
            height={64}
          />
          <span className={styles.kicker}>Acceso interno · Logia N° 115</span>
          <h1 className={styles.title} id="heading-interno">Bienvenido, hermano</h1>
          <div className={styles.rule} aria-hidden="true" />

          <p className={styles.texto}>
            Has ingresado al área interna de la Respetable Logia Teófilo Leal N° 115.
            Las herramientas de trabajo estarán disponibles aquí próximamente.
          </p>

          <form action={cerrarSesion}>
            <button type="submit" className={styles.submit}>Cerrar sesión</button>
          </form>

          <a href="/" className={styles.back}>
            <span className={styles.ln} />
            Volver al inicio
          </a>
        </section>
      </main>
    </>
  );
}
