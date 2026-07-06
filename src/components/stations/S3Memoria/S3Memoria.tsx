import Image from 'next/image';
import Link from 'next/link';
import styles from './S3Memoria.module.css';

export default function S3Memoria() {
  return (
    <Link
      href="/teofilo-leal"
      className={styles.root}
      aria-label="Ver la reseña histórica de Teófilo Leal Berra"
    >
      <p className={styles.inMemoriam}>In Memoriam</p>
      <div className={styles.marco}>
        <Image
          src="/assets/img/acto3-cuadro-teofilo-leal-memoria.png"
          alt="Retrato de Teófilo Leal Berra"
          width={260}
          height={325}
          quality={100}
          sizes="(max-width: 768px) 200px, 260px"
          className={styles.retrato}
          draggable={false}
        />
      </div>
      <h2 className={styles.nombre}>Teófilo Leal<br />Berra</h2>
      <div className={styles.fechas}>
        <span>1866 — 1940</span>
      </div>
      <p className={styles.roles}>Actor · Poeta · Músico · Pintor</p>
      <p className={styles.epitafio}>
        Su memoria ilumina cada trabajo de esta Logia.
      </p>
    </Link>
  );
}
