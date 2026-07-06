'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './Header.module.css';

// Scroll to top of hero (station 1)
function scrollAlInicio(e: React.MouseEvent) {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

// Scroll to center of station 4 (La Puerta — index 6 in SEGMENTS, station index 3)
function scrollALaPuerta(e: React.MouseEvent) {
  e.preventDefault();
  const vh = window.innerHeight;
  // T4 starts at S1+T1+S2+T2+S3+T3+S4 = 80+50+80+50+80+50+80 = 470vh
  // Station 4 center ≈ at 80+50+80+50+80+50 + 40 = 430+40 = 470 → center of S4 = 470+40=510vh
  const targetVh = 80 + 50 + 80 + 50 + 80 + 50 + 40; // 430vh = center of S4
  window.scrollTo({
    top: targetVh * vh / 100,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <header className={styles.header} aria-label="Cabecera institucional">
        <a
          href="#"
          className={styles.brand}
          id="eh-brand-link"
          aria-label="Ir al inicio del recorrido"
          onClick={scrollAlInicio}
        >
          <div className={styles.mark}>
            <Image
              src="/assets/img/logo.png"
              alt="Logia Teófilo Leal N° 115"
              width={30} height={30}
              draggable={false}
            />
          </div>
          <div className={styles.name}>
            <b>Logia Teófilo Leal N° 115</b>
            <span>Oriente de Barquisimeto</span>
          </div>
        </a>

        <button
          className={styles.toggle}
          aria-label={open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          aria-expanded={open}
          aria-controls="eh-menu"
          onClick={() => setOpen(v => !v)}
        >
          <span className={`${styles.bar} ${open ? styles.barOpen1 : ''}`} />
          <span className={`${styles.bar} ${open ? styles.barOpen2 : ''}`} />
          <span className={`${styles.bar} ${open ? styles.barOpen3 : ''}`} />
        </button>
      </header>

      {/* Nav panel */}
      <nav
        id="eh-menu"
        className={`${styles.menu} ${open ? styles.abierto : ''}`}
        aria-label="Menú principal"
        aria-hidden={!open}
      >
        <div className={styles.emblem} aria-hidden="true">
          <Image src="/assets/img/logo.png" alt="" width={86} height={86} draggable={false} />
        </div>

        <ul>
          {[
            { label: 'Inicio del recorrido',   href: '#',                   onClick: (e: React.MouseEvent) => { scrollAlInicio(e); close(); } },
            { label: 'Teófilo Leal',           href: '/teofilo-leal',       onClick: close },
            { label: 'Tocar la puerta',        href: '#',                   onClick: (e: React.MouseEvent) => { scrollALaPuerta(e); close(); } },
            { label: 'Solicitud de aspirante', href: '/aspirantes',         onClick: close },
            { label: 'Acceso interno',         href: '/login',              onClick: close },
          ].map(item => (
            <li key={item.label}>
              {item.href.startsWith('/') ? (
                // Real route — use next/link so navigation is driven by the
                // router itself, not by the browser's native anchor default
                // action (which can be dropped when the same click also
                // flips pointer-events/transform on the menu ancestor).
                <Link href={item.href} className={styles.link} onClick={item.onClick}>
                  <span className={styles.linkSym} aria-hidden="true">✦</span>
                  {item.label}
                </Link>
              ) : (
                <a href={item.href} className={styles.link} onClick={item.onClick}>
                  <span className={styles.linkSym} aria-hidden="true">✦</span>
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>

        <div className={styles.contactos} aria-label="Redes sociales">
          <a href="https://wa.me/584247259897?text=Hola%20quiero%20información%20sobre%20la%20logia"
             className={styles.contactoLink} target="_blank" rel="noopener noreferrer"
             aria-label="WhatsApp" onClick={close}>WhatsApp</a>
          <a href="https://www.instagram.com/logiateofiloleal115/"
             className={styles.contactoLink} target="_blank" rel="noopener noreferrer"
             aria-label="Instagram" onClick={close}>Instagram</a>
          <a href="https://www.facebook.com/logiateofilo.leal.5"
             className={styles.contactoLink} target="_blank" rel="noopener noreferrer"
             aria-label="Facebook" onClick={close}>Facebook</a>
        </div>
      </nav>

      {/* Overlay */}
      {open && (
        <div
          className={styles.overlay}
          aria-hidden="true"
          onClick={close}
          onKeyDown={e => e.key === 'Escape' && close()}
        />
      )}
    </>
  );
}
