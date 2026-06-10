'use strict';

/* ============================================================
   LOGIA TEÓFILO LEAL N° 115 · escenas.js · v2
   Arquitectura: scroll-driven real, escenario fijo (sticky)
   Basado en scroll-logia-demo/js/main.js — adaptado para
   5 escenas, dots de navegación y overlay de entrada.
============================================================ */

/* ─── ELEMENTOS DEL DOM ─────────────────────────────────── */
const storyHero      = document.getElementById('storyHero');
const frames         = document.querySelectorAll('.sf');
const copies         = document.querySelectorAll('.scene-copy');
const goldenPulse    = document.querySelector('.golden-pulse');
const scrollHint     = document.querySelector('.scroll-hint');
const dots           = document.querySelectorAll('#escenas-nav .dot');

const N_ESCENAS = frames.length;   // 5
let isTicking   = false;

/* ─── DETECCIÓN DE MOVIMIENTO REDUCIDO ──────────────────── */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─── CONFIG PRELOADER ──────────────────────────────────── */
const PRE = {
  minSkipMs:  2200,
  durBarra:   2600,
  pausaF1:    550,
  durFade:    750,
  durF2:      2400,
  durPanel:   820,
  pausaPanel: 380,
  durRetiro:  980,
};

const STORAGE_KEY_E = 'logiaEscenasPreloaderVisto';

function preloaderYaVisto() {
  try { return sessionStorage.getItem(STORAGE_KEY_E) === 'true'; }
  catch (_) { return false; }
}

function marcarPreloaderVisto() {
  try { sessionStorage.setItem(STORAGE_KEY_E, 'true'); }
  catch (_) {}
}

function saltarPreloaderCompleto() {
  const elPre   = document.getElementById('preloader');
  const elPanel = document.getElementById('pre-panel');
  if (elPre)   elPre.classList.add('oculto');
  if (elPanel) elPanel.remove();
  document.body.style.overflow = '';
  updateStoryHero();
}


/* ════════════════════════════════════════════════════════════
   FUNCIONES MATEMÁTICAS
   Idénticas a scroll-logia-demo para reproducir su easing
════════════════════════════════════════════════════════════ */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function smoothStep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}


/* ════════════════════════════════════════════════════════════
   ACTUALIZACIÓN DEL STORY HERO
   Se llama en cada evento scroll/resize vía requestAnimationFrame.

   Cálculo del progreso (igual que scroll-logia-demo):
     progress 0 = usuario en el tope del storyHero
     progress 1 = usuario al final del storyHero
════════════════════════════════════════════════════════════ */
function updateStoryHero() {
  if (!storyHero) return;

  const rect        = storyHero.getBoundingClientRect();
  const totalScroll = storyHero.offsetHeight - window.innerHeight;
  const progress    = clamp(-rect.top / totalScroll, 0, 1);

  const sl          = 1 / N_ESCENAS;    // longitud de cada escena (fracción 0-1)
  const activeIndex = clamp(Math.floor(progress / sl), 0, N_ESCENAS - 1);


  /* ── FRAMES — fondos cinematográficos ─────────────────── */
  frames.forEach((frame, i) => {

    const sceneStart = i * sl;
    const sceneEnd   = sceneStart + sl;

    /*
      Escena 1 (i=0): arranca visible en progress=0.
      El fadeIn se fuerza a 1 — solo existe el fade-OUT al avanzar.
      El resto de escenas usan smoothStep normal.
    */
    const fadeIn = i === 0
      ? 1
      : smoothStep(sceneStart, sceneStart + sl * 0.22, progress);

    const fadeOut  = 1 - smoothStep(sceneEnd - sl * 0.25, sceneEnd, progress);
    const opacity  = clamp(fadeIn * fadeOut, 0, 1);

    /* Progreso local dentro de esta escena (0→1) para Ken Burns y filtros */
    const localProgress = clamp((progress - sceneStart) / sl, 0, 1);

    frame.style.opacity   = opacity;
    frame.style.transform = `scale(${1.045 - localProgress * 0.035})`;
    frame.style.filter    = `
      brightness(${0.82 + localProgress * 0.10})
      contrast(1.06)
      saturate(${1.04 + localProgress * 0.04})
    `;
  });


  /* ── COPIES — paneles de texto ─────────────────────────── */
  copies.forEach((copy, i) => {

    const sceneStart = i * sl;
    const sceneEnd   = sceneStart + sl;

    /*
      Escena 1 (i=0): texto visible desde progress=0.
      Para el resto: entra un poco después del frame (como scroll-logia-demo)
      y sale antes de que llegue el siguiente frame.
    */
    const textIn = i === 0
      ? 1
      : smoothStep(sceneStart + sl * 0.18, sceneStart + sl * 0.34, progress);

    const textOut    = 1 - smoothStep(sceneEnd - sl * 0.34, sceneEnd - sl * 0.16, progress);
    const textOpacity = clamp(textIn * textOut, 0, 1);

    copy.style.opacity      = textOpacity;
    copy.style.pointerEvents = textOpacity > 0.75 ? 'auto' : 'none';

    /*
      Animación de posición vertical: de -44% a -50% (deslizamiento suave
      hacia arriba mientras el texto aparece). Idéntico a scroll-logia-demo.

      Para copies centradas (clase "centered"), se combina con translateX(-50%)
      para mantener el centrado horizontal.
    */
    const yOffset = -44 + textOpacity * -6;

    if (copy.classList.contains('centered')) {
      copy.style.transform = `translateX(-50%) translateY(${yOffset}%)`;
    } else {
      copy.style.transform = `translateY(${yOffset}%)`;
    }
  });


  /* ── GOLDEN PULSE (aumenta con el progreso) ────────────── */
  if (goldenPulse) {
    const lightPower = smoothStep(0.48, 0.9, progress);
    goldenPulse.style.opacity   = lightPower * 0.75;
    goldenPulse.style.transform = `scale(${0.95 + lightPower * 0.18})`;
  }


  /* ── SCROLL HINT (desaparece al avanzar) ───────────────── */
  if (scrollHint) {
    scrollHint.style.opacity = 1 - smoothStep(0.02, 0.12, progress);
  }


  /* ── DOTS DE NAVEGACIÓN (sincronizados con escena activa) ─ */
  dots.forEach((dot, i) => {
    const esActivo = i === activeIndex;
    dot.classList.toggle('activo', esActivo);
    dot.setAttribute('aria-current', esActivo ? 'true' : 'false');
  });
}


/* ════════════════════════════════════════════════════════════
   THROTTLE CON requestAnimationFrame
   Idéntico a scroll-logia-demo
════════════════════════════════════════════════════════════ */
function requestUpdate() {
  if (isTicking) return;
  isTicking = true;
  requestAnimationFrame(() => {
    updateStoryHero();
    isTicking = false;
  });
}


/* ════════════════════════════════════════════════════════════
   NAVEGACIÓN POR DOTS
   Clic en un dot → scroll suave hasta esa escena dentro del hero
════════════════════════════════════════════════════════════ */
function scrollHaciaEscena(idx, offset = 0.15) {
  if (!storyHero) return;

  const totalScroll = storyHero.offsetHeight - window.innerHeight;

  /*
    Posición absoluta del inicio del hero en el documento.
    getBoundingClientRect().top es relativo al viewport,
    sumamos scrollY para obtener la posición absoluta.
  */
  const heroTop = storyHero.getBoundingClientRect().top + window.scrollY;

  /*
    offset 0.15 (dots): pasado el fade-in inicial, el usuario llega cerca.
    offset 0.50 (menú): centro del segmento, garantiza contenido activo y visible.
  */
  const targetProgress = (idx / N_ESCENAS) + (1 / N_ESCENAS) * offset;
  const targetY        = heroTop + targetProgress * totalScroll;

  window.scrollTo({
    top:      targetY,
    behavior: reducedMotion ? 'instant' : 'smooth',
  });
}

function initDots() {
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => scrollHaciaEscena(i));
  });
}


/* ════════════════════════════════════════════════════════════
   CABECERA Y MENÚ HAMBURGUESA
════════════════════════════════════════════════════════════ */
function initMenu() {
  const toggle     = document.getElementById('eh-toggle');
  const menu       = document.getElementById('eh-menu');
  const overlay    = document.getElementById('eh-overlay');
  const linkInicio = document.getElementById('eh-link-inicio');
  const linkPuerta = document.getElementById('eh-link-puerta');

  if (!toggle || !menu || !overlay) return;

  const links = menu.querySelectorAll('.eh-link');

  function abrirMenu() {
    menu.classList.add('abierto');
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Cerrar menú de navegación');
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function cerrarMenu() {
    menu.classList.remove('abierto');
    menu.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú de navegación');
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  toggle.addEventListener('click', () => {
    menu.classList.contains('abierto') ? cerrarMenu() : abrirMenu();
  });

  overlay.addEventListener('click', cerrarMenu);

  links.forEach(link => link.addEventListener('click', cerrarMenu));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('abierto')) cerrarMenu();
  });

  /* Logo de cabecera + "Inicio del recorrido" — ambos hacen scroll al tope */
  function scrollAlInicio(e) {
    e.preventDefault();
    const heroTop = storyHero ? storyHero.getBoundingClientRect().top + window.scrollY : 0;
    window.scrollTo({ top: heroTop, behavior: reducedMotion ? 'instant' : 'smooth' });
  }

  const brandLink = document.getElementById('eh-brand-link');
  if (brandLink) brandLink.addEventListener('click', scrollAlInicio);

  if (linkInicio) linkInicio.addEventListener('click', scrollAlInicio);

  /* "Tocar la puerta" — navega al centro activo de la escena 4 (índice 3) */
  if (linkPuerta) {
    linkPuerta.addEventListener('click', e => {
      e.preventDefault();
      scrollHaciaEscena(3, 0.50);
    });
  }
}


/* ════════════════════════════════════════════════════════════
   PRELOADER CEREMONIAL
   Logo → barra → identidad → panel cubre → panel se retira
════════════════════════════════════════════════════════════ */
function iniciarPreloader() {
  if (reducedMotion)        { saltarPreloaderCompleto(); return; }
  if (preloaderYaVisto())   { saltarPreloaderCompleto(); return; }

  const elPre      = document.getElementById('preloader');
  const elPanel    = document.getElementById('pre-panel');
  const barraEl    = document.getElementById('pre-barra');
  const barraTrack = document.getElementById('pre-barra-track');
  const identidad  = document.getElementById('pre-identidad');
  const logoImg    = document.getElementById('pre-logo-img');

  if (!elPre) { document.body.style.overflow = ''; updateStoryHero(); return; }

  document.body.style.overflow = 'hidden';

  if (logoImg) {
    const mostrarLogo = () => {
      logoImg.style.opacity   = '1';
      logoImg.style.transform = 'scale(1)';
    };
    if (logoImg.complete && logoImg.naturalWidth > 0) mostrarLogo();
    else {
      logoImg.addEventListener('load',  mostrarLogo, { once: true });
      logoImg.addEventListener('error', () => { logoImg.style.display = 'none'; }, { once: true });
    }
  }

  let puedeSkip = false, saltado = false, panelActivo = false;
  setTimeout(() => { puedeSkip = true; }, PRE.minSkipMs);

  function intentarSaltar() { if (puedeSkip && !saltado) saltar(); }
  document.addEventListener('click',      intentarSaltar);
  document.addEventListener('keydown',    intentarSaltar);
  document.addEventListener('touchstart', intentarSaltar, { passive: true });

  function limpiarSkip() {
    document.removeEventListener('click',      intentarSaltar);
    document.removeEventListener('keydown',    intentarSaltar);
    document.removeEventListener('touchstart', intentarSaltar);
  }

  let progBarra = 0;
  const stepVal = 100 / (PRE.durBarra / 16);
  const timer   = setInterval(() => {
    if (saltado) { clearInterval(timer); return; }
    progBarra = Math.min(100, progBarra + stepVal);
    barraEl.style.width = progBarra + '%';
    if (progBarra >= 100) { clearInterval(timer); setTimeout(mostrarIdentidad, PRE.pausaF1); }
  }, 16);

  function mostrarIdentidad() {
    if (saltado) return;
    barraTrack.classList.add('oculta');
    setTimeout(() => {
      if (saltado) return;
      identidad.classList.add('visible');
      setTimeout(cubrirConPanel, PRE.durF2);
    }, Math.round(PRE.durFade * 0.55));
  }

  function cubrirConPanel() {
    if (panelActivo) return;
    panelActivo = true;
    limpiarSkip();
    elPanel.classList.add('cubriendo');
    setTimeout(() => {
      marcarPreloaderVisto();
      elPre.classList.add('oculto');
      document.body.style.overflow = '';
      updateStoryHero();
      setTimeout(retirarPanel, PRE.pausaPanel);
    }, PRE.durPanel);
  }

  function retirarPanel() {
    elPanel.classList.remove('cubriendo');
    elPanel.classList.add('retirando');
    setTimeout(() => elPanel.remove(), PRE.durRetiro + 100);
  }

  function saltar() {
    saltado = true;
    clearInterval(timer);
    barraEl.style.transition = 'width 0.25s ease-out';
    barraEl.style.width      = '100%';
    setTimeout(cubrirConPanel, 340);
  }
}


/* ════════════════════════════════════════════════════════════
   INICIALIZACIÓN
════════════════════════════════════════════════════════════ */

/* Escuchar scroll y resize (passive para no bloquear el render) */
window.addEventListener('scroll', requestUpdate, { passive: true });
window.addEventListener('resize', requestUpdate);

/* Render inicial — garantiza que Escena 1 arranque visible */
updateStoryHero();

/* Preloader, dots y menú tras el DOM listo */
document.addEventListener('DOMContentLoaded', () => {
  iniciarPreloader();
  initDots();
  initMenu();
});
