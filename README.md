# Logia Teófilo Leal N° 115 — Next.js

Experiencia cinematográfica scroll-driven. Fase 1: hero principal.

## Dev

```bash
# 1. Procesar los 5 stills a WebP 1280×720 (solo la primera vez)
node scripts/process-stills.mjs

# 2. Servidor de desarrollo
npm run dev
# → http://localhost:3000
```

## Producción

```bash
npm run build && npm start
```

> `Cache-Control: immutable` en `/frames/**` solo aplica con `npm start`, no con `npm run dev`.

---

## Extraer frames de video (al recibir videos de Higgsfield)

```bash
# Desktop 1280×720
bash scripts/extract-frames.sh --input ~/videos/t1.mp4 --id t1

# Mobile 480×854
bash scripts/extract-frames.sh --input ~/videos/t1-mobile.mp4 --id t1 --scale 480:854
```

Tras extraer, editar `src/config/segments.ts` para esa transición:

```ts
// Antes (stills):
{ id: 't1', mode: 'stills', frameCount: 0 }

// Después (frames reales):
{ id: 't1', mode: 'frames', framesDir: '/frames/desktop/t1', frameCount: 240 }
```

No hay más cambios de código. Cada transición migra de forma independiente.

---

## Estructura clave

```
src/
  config/segments.ts       ← config central: estaciones + transiciones
  context/ScrollEngine.tsx ← scroll engine (RAF, boundaries, emite callbacks)
  components/Canvas/       ← canvas fijo, dibuja frames/crossfades
  components/Hero/         ← secciones sticky + texto de cada estación
  lib/frameLoader.ts       ← carga ImageBitmaps, gestión de memoria
scripts/
  process-stills.mjs       ← convierte JPEGs fuente → WebP 1280×720
  extract-frames.sh        ← extrae frames de video con ffmpeg
public/
  frames/desktop/          ← stills y carpetas de transición cuando estén listas
  frames/mobile/           ← placeholder para assets 9:16 (480×854)
  assets/                  ← logo, iconos, retratos
```

## Canvas backing store

El canvas se fija al tamaño del tier (`src/hooks/useFrameTier.ts`), leído una vez al cargar:

| Tier | Backing | Cuándo |
|---|---|---|
| mobile | 480×854 | viewport vertical |
| tablet | 960×540 | horizontal en dispositivo táctil, lado mayor ≤ 1440 px |
| desktop | 1280×720 | horizontal con mouse/trackpad, o pantallas mayores |

El CSS lo muestra a pantalla completa con `object-fit: cover`: conserva la proporción y recorta el sobrante (nunca estira ni pone barras). Con `prefers-reduced-motion` no se descargan las secuencias: cada estación y transición muestra la imagen fija del propio tier.

Los frames tablet se extraen de los masters 4K (fuera del repo) con `node scripts/extract-frames-tablet.js --videos "<carpeta>"`.
