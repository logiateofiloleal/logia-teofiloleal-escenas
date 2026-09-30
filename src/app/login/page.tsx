import type { Metadata } from 'next';
import Image, { getImageProps } from 'next/image';
import Header from '@/components/Header/Header';
import LoginForm from './LoginForm';
import styles from './login.module.css';

// ── Acceso interno ───────────────────────────────────────────────────
// Ya no es el profano sino el hermano iniciado: interior del templo, el
// hermano a la izquierda, el altar al centro y un espacio oscuro a la
// derecha para la tarjeta (abajo en vertical). Fondo en prueba:
// login-templo-hermano.webp, hecho a medida; el anterior
// (login-templo.webp, de Old-Project frame-5) se conserva por si se
// vuelve a él. La autenticación se conecta en el bloque del panel.

export const metadata: Metadata = {
  title: 'Acceso interno — Logia Teófilo Leal N° 115',
  description: 'Acceso restringido para hermanos de la Respetable Logia Teófilo Leal N° 115.',
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

export default function LoginPage() {
  return (
    <>
      <Header />

      <main className={styles.page}>
        <Templo />

        <section className={styles.card} aria-labelledby="heading-acceso">
          <Image
            className={styles.logo}
            src="/assets/img/logo.png"
            alt="Logo Logia Teófilo Leal N° 115"
            width={64}
            height={64}
          />
          <span className={styles.kicker}>Acceso interno · Logia N° 115</span>
          <h1 className={styles.title} id="heading-acceso">Acceso restringido</h1>
          <div className={styles.rule} aria-hidden="true" />

          <LoginForm />

          <a href="/" className={styles.back}>
            <span className={styles.ln} />
            Volver al inicio
          </a>
        </section>
      </main>
    </>
  );
}
