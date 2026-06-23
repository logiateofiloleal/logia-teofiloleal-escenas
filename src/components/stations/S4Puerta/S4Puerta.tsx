import Sep from '@/components/stations/Sep/Sep';
import styles from './S4Puerta.module.css';

export default function S4Puerta() {
  return (
    <>
      <svg
        className={styles.arco}
        viewBox="0 0 100 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M12,128 L12,52 Q12,12 50,12 Q88,12 88,52 L88,128"
              stroke="#9a7432" strokeWidth="1.5" fill="none"/>
        <path d="M22,128 L22,56 Q22,23 50,23 Q78,23 78,56 L78,128"
              stroke="#9a7432" strokeWidth="0.7" fill="none" opacity="0.4"/>
        <circle cx="50" cy="12" r="5"   stroke="#9a7432" strokeWidth="1.2" fill="none"/>
        <circle cx="50" cy="12" r="2.2" fill="#c9a84c"/>
        <line x1="50" y1="24" x2="50" y2="128"
              stroke="#9a7432" strokeWidth="0.5" opacity="0.26"/>
        <line x1="10" y1="127" x2="90" y2="127"
              stroke="#9a7432" strokeWidth="1" opacity="0.5"/>
      </svg>

      <h2>¿Sientes<br />el llamado?</h2>
      <Sep />
      <p>
        La Logia Teófilo Leal N° 115 recibe a hombres que buscan
        el perfeccionamiento moral e intelectual. Si sientes que
        este es tu camino, da el primer paso.
      </p>
      <a href="/aspirantes" className={styles.btn}>
        Tocar la puerta &nbsp;✦
      </a>
    </>
  );
}
