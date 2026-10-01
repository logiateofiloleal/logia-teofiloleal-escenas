import type { Metadata } from 'next';
import { getImageProps } from 'next/image';
import Header from '@/components/Header/Header';
import AspiranteForm from './AspiranteForm';
import styles from './aspirantes.module.css';

// ── Solicitud de aspirante ───────────────────────────────────────────
// Destino de "Tocar la puerta" (S4) y del menú. Misma estructura interna
// que /teofilo-leal: Header, hero con kicker, contenido y pie. El envío y
// la validación viven en actions.ts y lib/aspiranteValidation.ts.

// "El otro lado del toque": último frame de la escena 3 (la mano del
// profano en la puerta), recortado del original 4K. Desktop horizontal
// reencuadrado para que cabeza, rendija y mano queden a la derecha del
// formulario; móvil y tablets en vertical con el frame vertical 4K.
function Atmosfera() {
  const common = { alt: '', sizes: '100vw', loading: 'eager' as const };
  const {
    props: { srcSet: desktop },
  } = getImageProps({ ...common, src: '/assets/img/fondos/aspirantes-toque-desktop-amplio.webp', width: 2886, height: 1804 });
  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({ ...common, src: '/assets/img/fondos/aspirantes-toque-mobile.webp', width: 1440, height: 2547 });

  return (
    <div className={styles.stage} aria-hidden="true">
      <picture>
        <source media="(min-width: 769px) and (orientation: landscape)" srcSet={desktop} />
        <source srcSet={mobile} />
        <img {...rest} alt="" className={styles.stageImg} fetchPriority="high" />
      </picture>
    </div>
  );
}

export const metadata: Metadata = {
  title: 'Solicitud de aspirante — Logia Teófilo Leal N° 115',
  description:
    'Formulario de solicitud para aspirantes a la Respetable Logia Teófilo Leal N° 115, Oriente de Barquisimeto.',
};

export default function AspirantesPage() {
  return (
    <>
      <Header />

      <main className={styles.page}>
        <Atmosfera />

        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.kicker}>
              <span className={styles.rule} />
              <span className={styles.kickerLbl}>Proceso de iniciación</span>
              <span className={styles.kickerSym}>◆</span>
              <span className={styles.kickerLbl}>Logia N° 115</span>
              <span className={styles.rule} />
            </div>

            <h1 className={styles.title}>Solicitud de aspirante</h1>

            <p className={styles.subtitle}>
              Si sientes el llamado a conocer el camino masónico, completa el siguiente
              formulario. Tu solicitud será recibida con discreción y respeto fraternal.
            </p>
          </div>
        </header>

        <div className={styles.contentWrap}>
          <section className={styles.card} aria-labelledby="heading-datos">
            <div className={styles.cardHeader}>
              <span className={styles.cardLabel}>Información personal</span>
              <h2 className={styles.cardTitle} id="heading-datos">Datos de contacto</h2>
              <div className={styles.cardRule} aria-hidden="true" />
              <p className={styles.cardSub}>
                Todos los campos son obligatorios. La información será tratada con
                absoluta reserva institucional.
              </p>
            </div>

            <AspiranteForm />
          </section>

          <div className={styles.actions}>
            <a href="/" className={styles.btnSecondary}>
              <span className={styles.ln} />
              Volver al inicio
            </a>
          </div>
        </div>

        <footer className={styles.footer} role="contentinfo">
          <div className={styles.footerInner}>
            <span className={styles.footerEmblema} aria-hidden="true">✦</span>
            <p className={styles.footerNombre}>Logia Teófilo Leal N° 115</p>
            <p className={styles.footerOriente}>Oriente de Barquisimeto</p>
            <div className={styles.footerSep} aria-hidden="true" />
            <p className={styles.footerLema}>Verdad · Fraternidad · Disciplina · Trabajo</p>
            <p className={styles.footerYear}>© 2026</p>
          </div>
        </footer>
      </main>
    </>
  );
}
