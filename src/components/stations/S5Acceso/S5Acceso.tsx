import Sep from '@/components/stations/Sep/Sep';
import styles from './S5Acceso.module.css';

export default function S5Acceso() {
  return (
    <>
      <p className={styles.emblema}>✦</p>
      <Sep />
      <h2>Acceso<br />Administrativo</h2>
      <p className={styles.subtitulo}>Exclusivo para miembros de la Logia</p>
      <a href="/login" className={styles.btn}>
        Ingresar →
      </a>
    </>
  );
}
