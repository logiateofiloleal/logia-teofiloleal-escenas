'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { STATION_IDS } from '@/config/segments';
import { stationScrollY } from '@/lib/stationScroll';
import { alEstarLista } from '@/lib/landingLista';
import AccesoModal from '@/components/AccesoModal/AccesoModal';
import styles from './Header.module.css';

// Scroll to top of hero (station 1)
function scrollAlInicio(e: React.MouseEvent) {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

// Scroll to La Puerta — same resting position as its NavDot (derived from
// SEGMENTS via stationScroll, so it follows any layout change).
const LA_PUERTA = STATION_IDS.indexOf('s4');

function scrollALaPuerta(e: React.MouseEvent) {
  e.preventDefault();
  window.scrollTo({
    top: stationScrollY(LA_PUERTA, window.innerHeight),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // Acceso interno: modal de login sobre la página actual (no navega).
  const [acceso, setAcceso] = useState(false);
  const cerrarAcceso = useCallback(() => setAcceso(false), []);
  // The logo and "Inicio del recorrido" are real links to /: on the landing
  // they scroll back to the first station instead; elsewhere (e.g.
  // /teofilo-leal) they navigate.
  const enLanding = usePathname() === '/';
  const irAlInicio = useCallback((e: React.MouseEvent) => {
    if (enLanding) scrollAlInicio(e);
    close();
  }, [enLanding, close]);

  // /?acceso (p. ej. al entrar a /interno sin sesión) abre el modal y limpia la URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('acceso')) return;
    params.delete('acceso');
    const q = params.toString();
    window.history.replaceState(window.history.state, '', window.location.pathname + (q ? '?' + q : '') + window.location.hash);
    setAcceso(true);
  }, []);

  // "Tocar la puerta" from another page links to /?estacion=puerta: on the
  // landing, the URL is cleaned at once (it can't fire twice) and, once the
  // Preloader has released the scroll, the page jumps straight to La
  // Puerta's resting point — instant, so t1–t3 aren't scrubbed on the way.
  const irALaPuerta = useCallback((e: React.MouseEvent) => {
    if (enLanding) scrollALaPuerta(e);
    close();
  }, [enLanding, close]);

  useEffect(() => {
    if (window.location.pathname !== '/') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('estacion') !== 'puerta') return;
    params.delete('estacion');
    const q = params.toString();
    window.history.replaceState(window.history.state, '', '/' + (q ? '?' + q : '') + window.location.hash);
    let raf = 0;
    const cancelar = alEstarLista(() => {
      // Two frames after the scroll is released, so the layout has settled.
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          window.scrollTo({ top: stationScrollY(LA_PUERTA, window.innerHeight), behavior: 'instant' });
        });
      });
    });
    return () => { cancelar(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <header className={styles.header} aria-label="Cabecera institucional">
        <Link
          href="/"
          className={styles.brand}
          id="eh-brand-link"
          aria-label="Ir al inicio del recorrido"
          onClick={irAlInicio}
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
        </Link>

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
            { label: 'Inicio del recorrido',   href: '/',                   onClick: irAlInicio },
            { label: 'Teófilo Leal',           href: '/teofilo-leal',       onClick: close },
            { label: 'Tocar la puerta',        href: '/?estacion=puerta',   onClick: irALaPuerta },
            { label: 'Solicitud de aspirante', href: '/aspirantes',         onClick: close },
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
          <li>
            <button
              type="button"
              className={`${styles.link} ${styles.linkButton}`}
              aria-haspopup="dialog"
              onClick={() => { close(); setAcceso(true); }}
            >
              <span className={styles.linkSym} aria-hidden="true">✦</span>
              Acceso interno
            </button>
          </li>
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

      {acceso && <AccesoModal onClose={cerrarAcceso} />}
    </>
  );
}
