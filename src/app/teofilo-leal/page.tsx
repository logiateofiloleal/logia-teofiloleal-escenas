import type { Metadata } from 'next';
import Image from 'next/image';
import Header from '@/components/Header/Header';
import styles from './teofilo-leal.module.css';

export const metadata: Metadata = {
  title: 'Teófilo Leal Berra — Logia Teófilo Leal N° 115',
  description:
    'Reseña histórica de Teófilo Leal Berra, figura del teatro venezolano y masón ejemplar que da nombre a la Respetable Logia N° 115 de Barquisimeto.',
};

function DiamondSep() {
  return (
    <div className={styles.diamondSep} aria-hidden="true">
      <span className={styles.diamondLine} />
      <span className={styles.diamondGem} />
      <span className={styles.diamondLine} />
    </div>
  );
}

export default function TeofiloLealPage() {
  return (
    <>
      <Header />

      <main className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.kicker}>
              <span className={styles.rule} />
              <span className={styles.kickerLbl}>Homenaje histórico</span>
              <span className={styles.kickerSym}>◆</span>
              <span className={styles.kickerLbl}>Logia N° 115</span>
              <span className={styles.rule} />
            </div>

            <h1 className={styles.title}>Teófilo Leal Berra</h1>

            <p className={styles.subtitle}>
              Actor, poeta, músico y masón ejemplar. Figura señera de la cultura venezolana
              cuyo espíritu inspira el nombre y los valores de nuestra Respetable Logia.
            </p>
          </div>
        </header>

        <figure className={styles.portrait} aria-label="Cuadro conmemorativo de Teófilo Leal Berra">
          <Image
            className={styles.portraitImg}
            src="/assets/img/acto3-cuadro-teofilo-leal-memoria.png"
            alt="Cuadro conmemorativo de Teófilo Leal Berra"
            width={440}
            height={550}
            priority
          />
          <figcaption className={styles.caption}>
            Cuadro conmemorativo · Logia Teófilo Leal N° 115
          </figcaption>
        </figure>

        <div className={styles.contentWrap}>
          <DiamondSep />

          <section className={styles.section} aria-labelledby="heading-resena">
            <span className={styles.sectionLabel}>Reseña histórica</span>
            <h2 className={styles.sectionTitle} id="heading-resena">Vida y trayectoria</h2>
            <div className={styles.sectionRule} aria-hidden="true" />

            <div className={styles.body}>
              <p>
                Teófilo Leal Berra nació el <strong>8 de enero de 1866</strong> en la parroquia
                La Candelaria de Caracas y pasó al oriente eterno el <strong>15 de junio de 1940</strong>.
                Fue una de las figuras más destacadas del teatro venezolano entre finales del
                siglo XIX y principios del siglo XX.
              </p>

              <p>
                Desde temprana edad mostró inclinación por el arte escénico, iniciándose en el
                teatro a los doce años. Con el paso del tiempo desarrolló una sólida trayectoria
                como actor, director y promotor cultural, participando en importantes compañías
                teatrales dentro y fuera de Venezuela.
              </p>

              <p>
                A lo largo de su vida artística recorrió diversos países como México, Guatemala,
                España y otras regiones de América, llevando consigo el talento venezolano y
                obteniendo reconocimiento internacional. Fue además fundador de agrupaciones
                teatrales, director de instituciones artísticas y creador de obras dramáticas.
              </p>

              <p>
                Su talento no se limitó al teatro. También se destacó como poeta —siendo
                <em> &ldquo;Consuelos&rdquo;</em> una de sus composiciones más conocidas—, periodista, músico
                y pintor. Entre sus aportes se encuentran la creación de la ópera <em>Guaicaipuro</em>
                {' '}y la fundación de periódicos como <em>El Imparcial</em>.
              </p>

              <p>
                En el ámbito masónico, Teófilo Leal dejó una huella significativa marcada por la
                fraternidad, la lealtad, la cultura y el servicio. Su vida dentro de la institución
                reflejó un profundo compromiso espiritual y moral, siendo recordado como un masón
                ejemplar cuya memoria merece perpetuarse.
              </p>
            </div>
          </section>

          <DiamondSep />

          <section className={styles.section} aria-labelledby="heading-logia">
            <span className={styles.sectionLabel}>Fundación · 1949</span>
            <h2 className={styles.sectionTitle} id="heading-logia">La Logia que lleva su nombre</h2>
            <div className={styles.sectionRule} aria-hidden="true" />

            <div className={styles.body}>
              <p>
                En honor a sus virtudes y legado, el <strong>21 de febrero de 1949</strong> un grupo
                de hermanos masones decidió fundar en Barquisimeto la Respetable Logia &ldquo;Teófilo Leal&rdquo;
                N° 115, la cual fue instalada solemnemente el <strong>16 de abril</strong> del mismo año
                bajo los auspicios de la Gran Logia de la República de Venezuela.
              </p>
            </div>

            <blockquote className={styles.legacy}>
              <p className={styles.legacyText}>
                Su legado perdura como símbolo de disciplina, cultura, virtud y compromiso,
                siendo una referencia histórica y moral para todos aquellos que continúan el
                camino del perfeccionamiento personal y el servicio a la humanidad.
              </p>
            </blockquote>
          </section>

          <div className={styles.actions}>
            <a
              href="https://www.venciclopedia.org/index.php?title=Te%C3%B3filo_Leal"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.btnPrimary}
            >
              Ver referencia bibliográfica
            </a>

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
