'use strict';

/* ============================================================
   LOGIA TEÓFILO LEAL N° 115 · main.js
============================================================ */

/* ─── CONFIGURACIÓN ─────────────────────────────────────── */
const CFG = {
  texto:      'Hay preguntas que el mundo exterior no puede responder.',
  typingMs:   65,
  bloqueoMs:  2400,
  skipHintMs: 1100,
  fadeDelay:  190,
  fadeThresh: 0.15,
};

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

/* ─── DOM ───────────────────────────────────────────────── */
const D = {
  e01:          () => document.getElementById('escena-01'),
  typewriterTxt:() => document.getElementById('typewriter-txt'),
  scrollDot:    () => document.getElementById('scroll-dot'),
  skipHint:     () => document.getElementById('skip-hint'),
};

/* ─── ESTADO ────────────────────────────────────────────── */
const S = {
  bloqueado:    true,
  typingOk:     false,
  tiempoInicio: 0,
  cortina:      false,
};


/* ════════════════════════════════════════════════════════════
   TYPEWRITER
════════════════════════════════════════════════════════════ */
function iniciarTypewriter() {
  const txt   = D.typewriterTxt();
  const chars = CFG.texto.split('');
  let i = 0, cancelado = false;

  txt.classList.add('visible');
  setTimeout(() => D.skipHint().classList.add('visible'), CFG.skipHintMs);

  const iv = setInterval(() => {
    if (cancelado) return;
    txt.textContent += chars[i++];
    if (i >= chars.length) { clearInterval(iv); finTyping(); }
  }, CFG.typingMs);

  S.cancelTyping = () => {
    cancelado = true; clearInterval(iv);
    txt.textContent = CFG.texto;
    finTyping();
  };
}

function finTyping() {
  S.typingOk = true;
  D.typewriterTxt().classList.add('completo');
  setTimeout(() => {
    D.scrollDot().classList.add('visible');
    D.skipHint().classList.remove('visible');
  }, 300);
  const restante = Math.max(0, CFG.bloqueoMs - (Date.now() - S.tiempoInicio));
  setTimeout(desbloquear, restante);
}

function desbloquear() {
  S.bloqueado = false;
  subirCortina();
}

function skipIntro() {
  if (!S.typingOk) S.cancelTyping?.();
  if (S.bloqueado) desbloquear();
  else if (S.cortina) aplicarSalidaCortina();
}


/* ════════════════════════════════════════════════════════════
   CORTINA — sube y revela el hero
════════════════════════════════════════════════════════════ */
let _cortinaTid = null;
let _subiendo   = false;

function subirCortina() {
  const e01 = D.e01();
  if (!e01) {
    document.body.style.overflow = '';
    document.body.classList.add('revealed');
    return;
  }
  S.cortina   = true;
  _cortinaTid = setTimeout(aplicarSalidaCortina, 360);
}

function aplicarSalidaCortina() {
  if (_subiendo) return;
  _subiendo = true;
  if (_cortinaTid) { clearTimeout(_cortinaTid); _cortinaTid = null; }
  const e01 = D.e01();
  if (!e01) {
    document.body.style.overflow = '';
    document.body.classList.add('revealed');
    return;
  }
  e01.classList.add('saliendo');
  document.body.classList.add('revealed');
  setTimeout(() => {
    S.cortina = false;
    document.body.style.overflow = '';
    e01.classList.add('fuera');
  }, 2300);
}


/* ════════════════════════════════════════════════════════════
   ENTRADAS
════════════════════════════════════════════════════════════ */
function configurarEntradas() {
  document.body.style.overflow = 'hidden';
  const actuar = () => { if (S.bloqueado || S.cortina) skipIntro(); };
  D.e01().addEventListener('click',       actuar);
  document.addEventListener('keydown',    actuar);
  document.addEventListener('wheel',      actuar, { passive: true });
  document.addEventListener('touchstart', actuar, { passive: true });
}


/* ════════════════════════════════════════════════════════════
   ACTOS II–IV — FADE-IN
════════════════════════════════════════════════════════════ */
function iniciarObservadores() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el    = entry.target;
      const orden = parseInt(el.dataset.delay || '0', 10);
      setTimeout(() => el.classList.add('visible'), orden * CFG.fadeDelay);
      observer.unobserve(el);
    });
  }, { threshold: CFG.fadeThresh });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}


/* ════════════════════════════════════════════════════════════
   SESIÓN — control de preloader
════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'logiaPreloaderVisto';

function preloaderYaVisto() {
  try { return sessionStorage.getItem(STORAGE_KEY) === 'true'; }
  catch (_) { return false; }
}

function marcarPreloaderVisto() {
  try { sessionStorage.setItem(STORAGE_KEY, 'true'); }
  catch (_) {}
}

function saltarPreloaderCompleto() {
  const elPre   = document.getElementById('preloader');
  const elPanel = document.getElementById('pre-panel');
  const e01     = document.getElementById('escena-01');

  // Ocultar preloader y panel de transición
  if (elPre)   elPre.classList.add('oculto');
  if (elPanel) elPanel.remove();

  // Ocultar cortina narrativa sin animación
  if (e01)     e01.classList.add('fuera');

  // Revelar página y desbloquear scroll
  document.body.classList.add('revealed');
  document.body.style.overflow = '';

  // Inicializar solo los módulos relevantes (sin preloader ni cortina)
  iniciarObservadores();
  iniciarFrasesRotativas();
  iniciarFondosActo3();
  iniciarHamburguesa();
}


/* ════════════════════════════════════════════════════════════
   PRELOADER
════════════════════════════════════════════════════════════ */
function iniciarPreloader() {
  if (preloaderYaVisto()) { saltarPreloaderCompleto(); return; }

  const elPre      = document.getElementById('preloader');
  const elPanel    = document.getElementById('pre-panel');
  const barraEl    = document.getElementById('pre-barra');
  const barraTrack = document.getElementById('pre-barra-track');
  const identidad  = document.getElementById('pre-identidad');
  const logoImg    = document.getElementById('pre-logo-img');

  if (!elPre) { init(); return; }

  if (logoImg) {
    const mostrarLogo = () => { logoImg.style.opacity = '1'; logoImg.style.transform = 'scale(1)'; };
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
      init();
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
   FRASES ROTATIVAS — Acto II
════════════════════════════════════════════════════════════ */
function iniciarFrasesRotativas() {
  const el = document.getElementById('frase-rotativa');
  if (!el) return;

  const frases = [
    'La fraternidad une lo que el ego separa.',
    'El hombre libre no busca dominar — busca construir.',
    'Ante la verdad, todos los hombres pesan lo mismo.',
    'Libre no es quien no tiene ataduras, sino quien elige las suyas.',
    'El hermano no se elige por sangre, sino por trabajo compartido.',
    'La igualdad no nivela a los hombres — los dignifica.',
    'La libertad es la distancia justa entre lo que eres y lo que podrías ser.',
    'El nivel no mide alturas, mide conciencias.',
    'Quien trabaja en sí mismo trabaja por todos.',
  ];

  let i = 0;

  setInterval(() => {
    el.classList.add('saliendo');
    setTimeout(() => {
      i = (i + 1) % frases.length;
      el.textContent = frases[i];
      el.classList.remove('saliendo');
    }, 440);
  }, 3500);
}


/* ════════════════════════════════════════════════════════════
   ACTO III — Eliminación de canvas blanco sobrante
════════════════════════════════════════════════════════════ */

function quitarFondoBlanco(img, umbral) {
  umbral = umbral || 22;
  const c   = document.createElement('canvas');
  const ctx = c.getContext('2d');
  c.width  = img.naturalWidth;
  c.height = img.naturalHeight;
  try {
    ctx.drawImage(img, 0, 0);
    const id  = ctx.getImageData(0, 0, c.width, c.height);
    const px  = id.data;
    const w   = c.width;
    const h   = c.height;

    /* Detecta si un índice de píxel es fondo blanco/acromático */
    function esFondo(pi) {
      const r = px[pi], g = px[pi+1], b = px[pi+2];
      const brillo = (r + g + b) / 3;
      const spread = Math.max(Math.abs(r-g), Math.abs(r-b), Math.abs(g-b));
      return brillo > 255 - umbral && spread < 24;
    }

    /* BFS desde los cuatro bordes externos del PNG.
       Solo se marcan píxeles conectados al canvas exterior;
       el contenido interior (páginas del libro, etc.) queda intacto. */
    const marcado = new Uint8Array(w * h);
    const cola    = [];

    /* Sembrar: borde superior e inferior */
    for (let x = 0; x < w; x++) {
      const top = x;
      const bot = (h - 1) * w + x;
      if (esFondo(top * 4) && !marcado[top]) { marcado[top] = 1; cola.push(top); }
      if (esFondo(bot * 4) && !marcado[bot]) { marcado[bot] = 1; cola.push(bot); }
    }
    /* Sembrar: borde izquierdo y derecho (sin repetir esquinas) */
    for (let y = 1; y < h - 1; y++) {
      const izq = y * w;
      const der = y * w + (w - 1);
      if (esFondo(izq * 4) && !marcado[izq]) { marcado[izq] = 1; cola.push(izq); }
      if (esFondo(der * 4) && !marcado[der]) { marcado[der] = 1; cola.push(der); }
    }

    /* Expansión BFS: 4-conectado */
    let qi = 0;
    while (qi < cola.length) {
      const idx = cola[qi++];
      const x   = idx % w;
      const y   = Math.floor(idx / w);
      const vecinos = [
        y > 0     ? idx - w     : -1,
        y < h - 1 ? idx + w     : -1,
        x > 0     ? idx - 1     : -1,
        x < w - 1 ? idx + 1     : -1,
      ];
      for (let k = 0; k < 4; k++) {
        const n = vecinos[k];
        if (n < 0 || marcado[n]) continue;
        if (esFondo(n * 4)) { marcado[n] = 1; cola.push(n); }
      }
    }

    /* Aplicar transparencia gradual solo a los píxeles marcados */
    for (let i = 0; i < w * h; i++) {
      if (!marcado[i]) continue;
      const pi    = i * 4;
      const brillo = (px[pi] + px[pi+1] + px[pi+2]) / 3;
      const t     = (brillo - (255 - umbral)) / umbral;
      px[pi+3]    = Math.floor(px[pi+3] * (1 - t));
    }

    ctx.putImageData(id, 0, 0);
    c.toBlob(function(blob) { img.src = URL.createObjectURL(blob); }, 'image/png');
  } catch(e) { /* contexto CORS no disponible — se omite silenciosamente */ }
}

function iniciarFondosActo3() {
  document.querySelectorAll('.acto3-img-asset').forEach(function(img) {
    if (img.complete && img.naturalWidth > 0) {
      quitarFondoBlanco(img);
    } else {
      img.addEventListener('load', function() { quitarFondoBlanco(img); }, { once: true });
    }
  });
}


/* ════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════ */
function init() {
  S.tiempoInicio = Date.now();
  configurarEntradas();
  iniciarTypewriter();
  iniciarObservadores();
  iniciarFrasesRotativas();
  iniciarFondosActo3();
  iniciarHamburguesa();
}

/* ════════════════════════════════════════════════════════════
   MENÚ HAMBURGUESA — móvil
════════════════════════════════════════════════════════════ */
function iniciarHamburguesa() {
  const toggle = document.querySelector('.menu-toggle');
  const menu   = document.querySelector('.nav .menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', function () {
    const abierto = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(abierto));
  });

  menu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 700) {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarPreloader);
} else {
  iniciarPreloader();
}
