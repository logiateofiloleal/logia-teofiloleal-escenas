# MVP entregable — Logia Teófilo Leal N° 115

Baseline final del MVP, cerrado el **2026-10-03**. Este documento resume qué se entregó, cómo está construido y desde dónde debe partir cualquier trabajo posterior.

La reseña previa para revisión del equipo, de 2026-10-01, está en [`REVISION-MVP-2026-10-01.md`](../REVISION-MVP-2026-10-01.md). Este documento es el que manda.

---

## 1. Resumen del MVP

Sitio web de la Logia Teófilo Leal N° 115 (Oriente de Barquisimeto) construido como una **experiencia cinematográfica guiada por scroll**: el visitante recorre cuatro escenas (S1 → S4) que se transforman con secuencias de fotogramas mientras se desplaza.

| Parte | Incluye |
|---|---|
| **Pública** | Landing con recorrido S1 El Umbral → S2 Los Principios → S3 La Memoria → S4 La Puerta, página de homenaje `/teofilo-leal` y formulario `/aspirantes`. |
| **Interna** | Acceso por modal desde el menú, portal `/interno` y panel de aspirantes `/panel` (listado, detalle y cambio de estado con historial). |

## 2. Stack tecnológico

| Pieza | Uso |
|---|---|
| **Next.js 16.2.9** (App Router, Server Actions) | Rutas, render en servidor, formularios y acciones del panel. Node `22.23.3` (`.nvmrc`). |
| **React 19.2.4** | Componentes de cliente de la experiencia. |
| **Canvas 2D + secuencias de frames** | Un `<canvas>` fijo dibuja WebP decodificados como `ImageBitmap`, con un tier por dispositivo: 1280×720, 960×540 o 480×854. Ver `src/components/Canvas/` y `src/lib/frameLoader.ts`. |
| **Recorrido por scroll** | Scroll nativo. `ScrollEngine` traduce `scrollY` a segmento y progreso; `SceneSnap` deriva el estado de escena y sirve los saltos de los NavDots. La configuración central está en `src/config/segments.ts`. |
| **Audio ambiental** | `AmbientAudio`: un solo reproductor en bucle, silenciado por defecto; solo suena tras una interacción explícita con su botón. |
| **Netlify** | Deploy Previews por PR y producción desde `main`. |
| **Netlify Blobs** (`@netlify/blobs`) | Almacenamiento de las solicitudes de aspirantes. |
| **Git / GitHub** | Ramas por cambio, PR hacia `main`. |

## 3. Arquitectura funcional

- **Landing (`/`)**: `HeroPage` monta `ScrollEngineProvider` → `SceneSnapProvider` y, dentro, Canvas, Preloader, Header, NavDots, audio, guía de navegación y las estaciones.
- **Preloader**: espera la carga real de los recursos iniciales (`src/lib/preloadGate.ts`) y se reproduce una vez por sesión. Al liberar el scroll emite la señal «landing lista» (`src/lib/landingLista.ts`), indicando si esa entrada fue por el preloader (`porPreloader`).
- **Onboarding**: ver §4.
- **Recorrido S1 → S4**: transiciones con frames entre estaciones. Cada estación tiene su texto (`StationCopyWrapper`), que se desvanece con el progreso. Los paneles ocultos no reciben clics ni foco.
- **Teófilo**: en S3, el retrato enlaza a `/teofilo-leal`, la página de homenaje.
- **Header**: logo e «Inicio del recorrido» llevan a `/` (en la landing, desplazan al inicio). «Tocar la puerta» usa el enlace interno `/?estacion=puerta`, que espera a «landing lista» y salta a S4. Desde el menú también se abre el acceso interno.
- **Formulario de aspirantes (`/aspirantes`)**: Server Action con validación, honeypot y consentimiento. Rechaza los duplicados de correo y de teléfono.
- **Acceso interno**: ver §6.
- **Panel (`/panel`)**: listado de solicitudes (las más recientes primero), detalle con motivación completa, y cambio de estado con nota y registro en el historial.

## 4. Onboarding final

```
Preloader → escena real → guía de navegación → primer scroll/swipe/flecha → recorrido → ayuda de sonido
```

- **Se eliminó `IntroCortina`**, la pantalla de instrucciones previa al preloader, junto con su botón «Continuar». El Preloader arranca directamente al montar.
- **Guía de navegación** (`src/components/CoachMarks/`):
  - Aviso centrado en el hueco libre de la composición, sobre un **velo oscuro translúcido** que no captura clics.
  - Desaparece, junto con el velo, con el **primer desplazamiento real**: rueda, deslizar, teclado, NavDots o menú.
  - Escucha solo `scroll` en modo pasivo, sin `preventDefault`: un único gesto mueve el recorrido y oculta la guía.
- **Ayuda de sonido**: texto «Activa el sonido para una experiencia completa.» con una flecha junto al botón real.
  - Aparece tras ese primer desplazamiento, solo si el sonido sigue apagado.
  - Se va sola y no bloquea nada.
- **Regla única**: las dos ayudas dependen solo de `porPreloader`.
  - Si esa entrada no fue por el preloader, no aparece ninguna: al volver a `/` dentro de la sesión, al recargar con el preloader ya visto, con `/?estacion=puerta` o con el scroll restaurado a mitad del recorrido.
  - **No hay persistencia FTUE en `localStorage`.**
- Mientras la guía está activa (`html[data-guia]`), el bloque narrativo de S1 baja temporalmente a **opacidad 0.3** y el ScrollHint se oculta. Con el primer gesto ambos recuperan su estado normal al instante.

## 5. Datos de aspirantes

Se guardan en **Netlify Blobs**, en el store `aspirantes` (`src/lib/aspirantes.ts`):

| Clave | Contenido |
|---|---|
| `registro/<id>` | Solicitud completa en JSON: datos del formulario, `estado`, `timestamp`, `consentimiento` y `historialEstados`. |
| `indice/email/<sha256>` | `id` de la solicitud con ese correo (unicidad). |
| `indice/telefono/<sha256>` | `id` de la solicitud con ese teléfono (unicidad). |

- Los índices se reclaman con escritura condicional (`onlyIfNew`) y los cambios de estado se escriben con `onlyIfMatch` (ETag), así que no se pisan escrituras concurrentes.
- El panel interno lista, lee y actualiza esos registros.
- **Estados**: `Nuevo` → `Contactado` → `En proceso` → `Aprobado` / `Rechazado`. Cada cambio queda en el historial.
- El store es del sitio completo: **los Deploy Previews leen y escriben los mismos datos que producción.**

## 6. Acceso interno

- Login separado de la experiencia pública: modal desde el menú. `/login` solo redirige a ese modal.
- En el MVP existe **una credencial administrativa compartida**. Todavía **no hay usuarios individuales ni roles**.
- Contraseña verificada con hash scrypt. Sesión en cookie firmada con HMAC (`httpOnly`, `Secure` en producción, `SameSite=Lax`, 8 h). Límite de intentos fallidos por IP.
- `/interno` y `/panel` exigen sesión y las acciones del panel la vuelven a verificar. Sin sesión, redirigen a `/?acceso`.
- Configuración por **variables de entorno de Netlify**:
  - `ADMIN_USER`
  - `ADMIN_PASS_HASH` (generable con `scripts/hash-password.mjs`)
  - `SESSION_SECRET`

> No se documentan valores, contraseñas, hashes ni secretos. **Las credenciales se entregan por canal privado.**

## 7. Deploy

- **Netlify**: un Deploy Preview por cada PR y producción desde `main`.
- **Producción**: <https://logiateofiloleal.com>
- **Flujo de trabajo**: rama → prueba local (`pnpm build` + servidor de producción) → Deploy Preview → validación → PR → merge a `main` → producción.

## 8. Baseline final

| | |
|---|---|
| Último PR integrado | #15 — `feat/ftue-coach-marks` (onboarding final) |
| `main` | commit de merge **`45c0bd6`** |
| Árbol | equivalente al commit aprobado **`9ce3413`** |
| Integración previa | PR #14 — `release/mvp-final` (`7490905`) |
| Fecha de cierre | **2026-10-03** |

## 9. QA final

Smoke de producción sobre el baseline, en escritorio 1440×900 y móvil 390×844, con entrada real (rueda, toque y teclado):

| Área | Resultado |
|---|---|
| Onboarding: preloader → guía → primer gesto oculta guía y velo → ayuda de sonido (solo si sigue apagado); sin ayudas sin preloader, con `/?estacion=puerta` ni con scroll restaurado | ✅ |
| Navegación: logo, «Inicio del recorrido», «Tocar la puerta» (S4 exacto) | ✅ |
| S2 y S4: composición idéntica a la validada; CTA de S4 funcional | ✅ |
| Teófilo: clic y toque reales hacia `/teofilo-leal` y regreso | ✅ |
| Acceso interno, `/interno`, `/panel` (listado, detalle, cambio de estado) y logout | ✅ |
| Errores de JS / HTTP 404 | **0 / 0** |

## 10. Fuera del alcance / deuda aceptada

No bloqueante para este MVP, aceptado explícitamente:

- favicon, Open Graph y metadatos sociales;
- notificación por email de nuevas solicitudes;
- política de privacidad y retención de datos;
- extras del panel;
- credenciales individuales y roles;
- optimizaciones futuras no necesarias para este baseline. Las conocidas: uso de memoria de GPU cercano a 1 GB, tirón único al mostrar por primera vez algunas estaciones, carga y red, y el contraste puntual de «Oriente de Barquisimeto» cuando el haz de luz pasa detrás en móvil.

## 11. Regla para trabajo futuro

- Todo cambio parte de **`main` ≥ `45c0bd6`**, en una **rama nueva** y con PR hacia `main`.
- La deuda aceptada no se reabre salvo decisión explícita.
- Este baseline no se modifica sin aprobación.
