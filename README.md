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

> `Cache-Control: immutable` en `/frames/v1/**` lo aplica `next.config.ts` con `npm start` (no con `npm run dev`) y `netlify.toml` en Netlify, donde el `headers()` de Next no afecta a los archivos de `/public`.

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
{ id: 't1', mode: 'frames', framesDir: '/frames/v1/desktop/t1', frameCount: 240 }
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
  frames/v1/{desktop,tablet,mobile}/escena-N/  ← secuencias de frames por tier (versionadas)
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

---

## Frames versionados

Los frames viven en `public/frames/v1/<tier>/escena-N/` y se sirven con
`Cache-Control: public, max-age=31536000, immutable` (`netlify.toml`).
Como el navegador no los revalida nunca, **regenerar frames = nueva versión de
ruta (`v2`), nunca sobrescribir `v1`**: copia la carpeta a `public/frames/v2/…`,
cambia las rutas en `src/config/segments.ts`, el `source` de `next.config.ts` y
el `for` de `netlify.toml`, y despliega. Quien ya tenga `v1` en caché simplemente
no lo vuelve a pedir.
