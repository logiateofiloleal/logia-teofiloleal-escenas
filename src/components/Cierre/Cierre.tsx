import Image from 'next/image';
import styles from './Cierre.module.css';

export default function Cierre() {
  return (
    <section className={styles.cierre} aria-label="Cierre del recorrido institucional">
      <div className={styles.inner}>

        <div className={styles.ornamento} aria-hidden="true">
          <span className={styles.linea} />
          <span className={styles.sym}>✦</span>
          <span className={styles.linea} />
        </div>

        <figure className={styles.placaWrap}>
          <Image
            className={styles.placa}
            src="/assets/img/acto3-placa-logia-teofilo-leal-115.png"
            alt="Placa de la Respetable Logia Teófilo Leal N° 115"
            width={288} height={216}
            loading="lazy"
          />
        </figure>

        <blockquote className={styles.frase}>
          Una puerta no se abre<br />
          por curiosidad, sino por propósito.
        </blockquote>

        <p className={styles.firma}>
          Respetable Logia Simbólica Teófilo Leal N° 115<br />
          Or∴ de Barquisimeto · A∴ L∴ G∴ D∴ G∴ A∴ D∴ U∴
        </p>

      </div>
    </section>
  );
}
