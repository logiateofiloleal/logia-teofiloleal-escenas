import styles from './Sep.module.css';

export default function Sep() {
  return (
    <div className={styles.sep} aria-hidden="true">
      <span className={styles.sepDot} />
    </div>
  );
}
