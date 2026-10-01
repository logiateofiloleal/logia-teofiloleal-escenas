import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { cerrarSesion } from '@/app/interno/actions';
import styles from './panel.module.css';

// ── Panel interno: estructura común ──────────────────────────────────
// Solo la barra y el marco, sin datos: la sesión se comprueba en cada
// página (requerirSesion) y en cada Server Action, no aquí — un layout no
// se vuelve a renderizar al navegar entre sus páginas.

export const metadata: Metadata = {
  title: 'Panel interno — Logia Teófilo Leal N° 115',
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link href="/panel" className={styles.brand}>
          <Image src="/assets/img/logo.png" alt="" width={34} height={34} className={styles.brandLogo} />
          <span>
            <b>Panel interno</b>
            <span>Logia Teófilo Leal N° 115</span>
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Panel">
          <Link href="/interno" className={styles.navLink}>Área interna</Link>
          <form action={cerrarSesion}>
            <button type="submit" className={styles.navLink}>Cerrar sesión</button>
          </form>
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
