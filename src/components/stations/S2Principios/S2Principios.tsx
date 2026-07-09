import Image from 'next/image';
import Sep from '@/components/stations/Sep/Sep';
import styles from './S2Principios.module.css';

const PRINCIPIOS = [
  {
    num: 'I',
    titulo: 'Libertad',
    img: '/assets/img/acto2-icon-libertad-antorcha.png',
    texto: 'El pensamiento libre es la primera piedra del hombre que trabaja en sí mismo.',
  },
  {
    num: 'II',
    titulo: 'Igualdad',
    img: '/assets/img/acto2-icon-igualdad-balanza.png',
    texto: 'Ante la verdad, todos los hombres son iguales sin distinción de origen ni nombre.',
  },
  {
    num: 'III',
    titulo: 'Fraternidad',
    img: '/assets/img/acto2-icon-fraternidad-manos.png',
    texto: 'El trabajo compartido une lo que la diferencia separa y edifica lo perdurable.',
  },
] as const;

export default function S2Principios() {
  return (
    <>
      <span>Tres principios, una misma búsqueda</span>
      <h2>Libertad · Igualdad · Fraternidad</h2>
      <Sep />
      <div className={styles.principios}>
        {PRINCIPIOS.map(p => (
          <article key={p.titulo} className={styles.principio}>
            <div className={styles.medallion} aria-hidden="true">
              <Image src={p.img} alt="" width={20} height={20} />
            </div>
            <div className={styles.principioBody}>
              <h3 className={styles.titulo}>
                <span className={styles.num}>{p.num}</span> {p.titulo}
              </h3>
              <p className={styles.texto}>{p.texto}</p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
