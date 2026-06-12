'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import styles from './SecondaryLayout.module.css';

export default function SecondaryLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className={styles.page}>

      {/* Cabecera flotante */}
      <header className={styles.header} aria-label="Cabecera institucional">
        <a href="/" className={styles.brand} aria-label="Ir al inicio del recorrido">
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
          aria-controls="sl-menu"
          onClick={() => setOpen(v => !v)}
        >
          <span className={`${styles.bar} ${open ? styles.barOpen1 : ''}`} />
          <span className={`${styles.bar} ${open ? styles.barOpen2 : ''}`} />
          <span className={`${styles.bar} ${open ? styles.barOpen3 : ''}`} />
        </button>
      </header>

      {/* Panel de navegación */}
      <nav
        id="sl-menu"
        className={`${styles.menu} ${open ? styles.abierto : ''}`}
        aria-label="Menú principal"
        aria-hidden={!open}
      >
        <div className={styles.emblem} aria-hidden="true">
          <Image src="/assets/img/logo.png" alt="" width={86} height={86} draggable={false} />
        </div>

        <ul>
          <li>
            <a href="/" className={styles.link} onClick={close}>
              <span className={styles.linkSym} aria-hidden="true">✦</span>
              Inicio del recorrido
            </a>
          </li>
          <li>
            <a href="/teofilo-leal" className={styles.link} onClick={close}>
              <span className={styles.linkSym} aria-hidden="true">✦</span>
              Teófilo Leal
            </a>
          </li>
          <li>
            <a href="/" className={styles.link} onClick={close}>
              <span className={styles.linkSym} aria-hidden="true">✦</span>
              Tocar la puerta
            </a>
          </li>
          <li>
            <span
              className={`${styles.link} ${styles.pendiente}`}
              aria-disabled="true"
              title="Próximamente disponible"
            >
              <span className={styles.linkSym} aria-hidden="true">✦</span>
              Solicitud de aspirante
            </span>
          </li>
          <li>
            <span
              className={`${styles.link} ${styles.pendiente}`}
              aria-disabled="true"
              title="Próximamente disponible"
            >
              <span className={styles.linkSym} aria-hidden="true">✦</span>
              Acceso interno
            </span>
          </li>
        </ul>

        <div className={styles.contactos} aria-label="Redes sociales">
          <a
            href="https://wa.me/584247259897?text=Hola%20quiero%20información%20sobre%20la%20logia"
            className={styles.contactoLink} target="_blank" rel="noopener noreferrer"
            aria-label="WhatsApp" onClick={close}
          >WhatsApp</a>
          <a
            href="https://www.instagram.com/logiateofiloleal115/"
            className={styles.contactoLink} target="_blank" rel="noopener noreferrer"
            aria-label="Instagram" onClick={close}
          >Instagram</a>
          <a
            href="https://www.facebook.com/logiateofilo.leal.5"
            className={styles.contactoLink} target="_blank" rel="noopener noreferrer"
            aria-label="Facebook" onClick={close}
          >Facebook</a>
        </div>
      </nav>

      {/* Overlay */}
      {open && (
        <div
          className={styles.overlay}
          aria-hidden="true"
          onClick={close}
        />
      )}

      {/* Contenido de la página */}
      {children}

      {/* Footer institucional */}
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

    </div>
  );
}
