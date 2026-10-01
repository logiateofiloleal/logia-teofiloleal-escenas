# Revisión técnica del MVP — 1 de octubre de 2026

**Proyecto:** sitio de la Respetable Logia Teófilo Leal N° 115 (Oriente de Barquisimeto)
**Rama:** `fix/landing-stabilization` · **PR:** #7 → `main`
**Destinatarios:** José Felipe y equipo técnico

> **Esto es un MVP funcional para revisión, no una versión final aprobada.**
> La landing narrativa, el formulario de aspirantes, el acceso interno y el
> panel funcionan de punta a punta, pero hay decisiones de diseño y
> funciones que se dejaron deliberadamente para después (ver al final).

---

## 1. Estado actual

| Área | Estado |
|---|---|
| Landing narrativa S1–S4 (scroll storytelling) | Funcional y estabilizada. S3 (Teófilo) pendiente de revisión visual con el equipo. |
| Intro → preloader → landing | Funcional. |
| Audio de la experiencia | Funcional, limitado a la landing. |
| `/aspirantes` (solicitud) | Funcional con guardado real en Netlify Blobs. |
| Acceso interno (modal) + autenticación | Funcional (scrypt + cookie firmada). |
| `/interno` (portal privado) | Funcional, con un único módulo: Gestionar aspirantes. |
| `/panel` (gestión de aspirantes) | Funcional: lista, detalle, cambio de estado e historial. |
| `/teofilo-leal` (reseña) | Existe; navegación/enlaces pendientes de revisión. |

## 2. Arquitectura

- **Next.js 16.2.9** (App Router, Turbopack) y **React 19.2**. TypeScript.
- Despliegue en **Netlify** (runtime de Next; producción desde `main`, deploy previews por PR).
- **Node 22.23.3** fijado en `.nvmrc` (requisito de `@netlify/blobs` ≥ 22.12).
- Sin base de datos externa: los datos de aspirantes viven en **Netlify Blobs**.
- Dependencias de servidor nuevas: solo `@netlify/blobs`. Autenticación y hash con `node:crypto` (sin librerías).

Rutas:

| Ruta | Tipo | Notas |
|---|---|---|
| `/` | estática | Landing narrativa (`HeroPage`). |
| `/teofilo-leal` | estática | Reseña histórica. |
| `/aspirantes` | estática + Server Action | Formulario; escribe en Blobs. |
| `/login` | dinámica | Solo redirección (enlaces antiguos): con sesión → `/interno`; sin sesión → `/?acceso`. |
| `/interno` | dinámica, protegida | Portal privado. |
| `/panel` | dinámica, protegida | Lista de solicitudes. |
| `/panel/aspirantes/[id]` | dinámica, protegida | Detalle y cambio de estado. |

## 3. Landing S1–S4 y scroll storytelling

- Cuatro estaciones (S1 El Umbral, S2 Los Principios, S3 La Memoria, S4 La Puerta) unidas por tres transiciones con secuencias de frames sobre `<canvas>` (desktop, tablet y móvil con sus propios frames).
- Configuración central en `src/config/segments.ts` (`scrollVh`, `durationMs`, `dwellMs` por segmento). `ScrollEngine` y `SceneSnap` (contextos) gobiernan el avance y el anclaje a estaciones.
- `preloadGate` libera la página cuando los frames necesarios están cargados.

### Estabilizaciones realizadas (PR #6 y siguientes)

- Preloader ligado a la carga real de assets, primer pintado, tier de tablet y frames propios por tier con `prefers-reduced-motion`.
- Composición y contraste: margen derecho progresivo para textos en desktop, S2 compacta y fuera del haz de luz, S4 apartada de la mano y con velo local en vertical, luz y color originales de los frames.
- Tablets en retrato para S2/S4.

## 4. S3 / Teófilo — estado actual

- Implementada la evolución “receta C”: dentro de los 80vh de S3 el retrato viaja desde su lugar a la derecha hasta el centro, crece y pierde su giro de −14°, con el texto apareciendo escalonado y el fondo desenfocado (profundidad de campo, sin oscurecer). Animación FLIP solo con `transform`/`opacity`.
- Sin cambios en `scrollVh`, `dwellMs`, `SceneSnap` ni tiempos globales.
- **Pendiente de revisión visual con el equipo** (ver “Pendientes”).

## 5. `/aspirantes` y Netlify Blobs

- Formulario (`src/app/aspirantes/`) con Server Action `enviarSolicitud`; validación compartida del lado servidor en `src/lib/aspiranteValidation.ts` (nombre, edad entera 18–99, teléfono normalizado a +58, correo válido en minúsculas, motivación 20–2000 caracteres, consentimiento obligatorio).
- Antispam básico: honeypot (respuesta idéntica a un envío correcto, sin guardar).
- Errores por campo accesibles (`aria-invalid` / `aria-describedby`), avisos persistentes, confirmación sin redirigir.
- Tope de 8 s al almacenamiento (el SDK reintenta hasta ~25 s); un fallo de red en el cliente se muestra como aviso sin perder lo escrito.
- Atmósfera visual: último frame de la escena 3 (el toque) como fondo, con velos y tarjeta translúcida.

### Modelo de datos (store `aspirantes`)

```
registro/<uuid>            → Aspirante (JSON)
indice/email/<sha256>      → <uuid>    unicidad del correo
indice/telefono/<sha256>   → <uuid>    unicidad del teléfono
```

```ts
{
  id, nombre, edad, telefono, email, descripcion,
  estado: 'Nuevo' | 'Contactado' | 'En proceso' | 'Aprobado' | 'Rechazado',
  timestamp,                                  // ISO 8601
  historialEstados: [{ estado, fecha, nota }],
  consentimiento: { aceptado: true, fecha }
}
```

- **Índices hashed:** las claves de índice usan SHA-256 del correo/teléfono normalizado, para no dejar datos personales en los nombres de clave.
- Se reclaman con escritura condicional (`onlyIfNew`): dos envíos simultáneos con el mismo correo o teléfono no pueden registrarse ambos.
- Un índice huérfano (alta interrumpida) se libera pasados 2 minutos.
- El store es **de todo el sitio** (no por deploy): un deploy preview escribe en el mismo store que producción.

## 6. Autenticación

- **Contraseña:** `scrypt` (`node:crypto`), comparación en tiempo constante. El hash se genera con `node scripts/hash-password.mjs` (pide la contraseña sin mostrarla).
- **Sesión:** sin estado, en la cookie `lt_sesion` firmada con HMAC-SHA256 (`SESSION_SECRET`): `httpOnly`, `Secure` en producción, `SameSite=Lax`, 8 horas.
- **Freno de intentos:** 5 fallos en 15 min por IP → bloqueo de 15 min (memoria de la instancia).
- Un único mensaje para cualquier fallo (no revela si falló el usuario o la contraseña).
- `requerirSesion()` (`src/lib/session.ts`) protege páginas; cada Server Action del área privada verifica la sesión por sí misma.

**Variables de entorno necesarias en Netlify** (producción y deploy previews): `ADMIN_USER`, `ADMIN_PASS_HASH`, `SESSION_SECRET` (≥ 32 caracteres). Sus valores no se guardan en el repositorio.

**Acceso de revisión:** existe un usuario temporal de revisión (`hermano.prueba`) para esta etapa. La contraseña se comparte por canal privado y **no** está en el repositorio. Debe sustituirse por credenciales definitivas antes de la versión final.

### Modal de acceso

“Acceso interno” (menú) abre un modal sobre la página actual: `role="dialog"`, `aria-modal`, foco inicial en Usuario, Tab retenido, Escape y “Volver al inicio” cierran, fondo inerte. Credenciales válidas → `/interno`. `/?acceso` abre el modal (destino de las rutas protegidas sin sesión).

## 7. `/interno` y `/panel`

- **`/interno`:** portal privado (fondo del templo con el hermano). Acciones: Gestionar aspirantes, Cerrar sesión, Volver al inicio. Pensado para alojar más módulos en el futuro; por ahora solo uno.
- **`/panel`:** lista de solicitudes leída de Blobs (todas las páginas del listado, lecturas en lotes de 8), más recientes primero: nombre, fecha, teléfono, correo, estado. En móvil, tarjetas. Un registro corrupto se omite y se avisa; un error de red se muestra como tal.
- **`/panel/aspirantes/[id]`:** todos los datos, motivación completa (sin truncar), consentimiento, historial (más reciente arriba) y cambio de estado. Tras guardar: confirmación y “Volver a solicitudes” (sin redirección automática).

### Cambio de estado e historial

- Solo se reescribe `registro/<id>`; los índices nunca se tocan desde el panel.
- Se conserva el registro y se **añade** `{ estado, fecha, nota }` al historial (nunca se sobrescribe).
- Escritura condicional por ETag (`onlyIfMatch`) con reintento: dos cambios simultáneos no se pisan.
- Guardar el mismo estado no duplica el historial.

## 8. Intro → preloader → landing

- `IntroCortina`: cortina a pantalla completa (“Desplázate para iniciar el recorrido”), ratón animado (gesto de deslizar en táctil) y “Continuar”; desplazarse también continúa. Una vez por sesión.
- La coreografía del `Preloader` solo arranca al continuar: nunca se superponen.
- Estado de sesión centralizado en `src/lib/sesionLanding.ts` (`logiaGuiaVista`, `logiaPreloaderVisto`, `logiaSonido`).

## 9. Alcance del audio

- Un único `AmbientAudio` y un único reproductor, montado solo en `/` (S1→S4 mantienen el sonido).
- Autoplay: el loop arranca **silenciado**; solo un gesto del visitante sobre el botón lo hace audible. Nunca se llama a `play()` con sonido sin activación del usuario.
- Pista visual: flecha discreta hacia el botón de sonido tras la intro, si el sonido sigue apagado (~5 s, decorativa).
- Fade-out al salir de la landing; `/aspirantes`, `/interno` y `/panel` sin música. El modal de acceso suspende la música y la reanuda al cerrarse (no al entrar).
- `/teofilo-leal` no tiene audio y no se modificó.

## 10. Pruebas realizadas

Pruebas end-to-end automatizadas (Chrome headless vía CDP) contra el build de producción local, con un servidor local de Netlify Blobs (el del propio SDK, sin credenciales reales):

| Batería | Resultado |
|---|---|
| Intro, preloader, audio y pista (desktop, móvil, reduced motion) | 24/24 |
| `/aspirantes` (validación, duplicados, honeypot, errores de almacenamiento y red, móvil) | 38/38 |
| Acceso interno y sesión (modal, cookie, protección, filtraciones, limitador) | 30/30 |
| Panel (lista, detalle, estado, historial, índices intactos, sin sesión, móvil) | 26/26 |
| Panel: volver a solicitudes tras guardar | 14/14 |
| S3 (entrada/salida, reduced motion, contraste, choques con NavDots/audio/header) en 4 tamaños | 66/66 |

También: `npx tsc --noEmit` y `pnpm build` limpios; validación real de `/aspirantes` en el deploy preview del PR #7 (envío, duplicados y persistencia en Blobs).

## 11. Limitaciones conocidas

- El freno de intentos vive en memoria por instancia de función (frena fuerza bruta simple, no ataques distribuidos).
- Sesión sin estado: no se puede revocar una sesión concreta antes de 8 h (rotar `SESSION_SECRET` las cierra todas). Un solo administrador; sin roles.
- El historial registra qué cambió y cuándo, no quién.
- El panel lee todos los registros en cada visita (adecuado para cientos; con miles convendría paginar o un índice resumido). Sin tope de tiempo frente a Blobs en el panel.
- Volver a `/` es una recarga completa: el sonido elegido vuelve en el primer clic/toque/tecla (los navegadores no aceptan el scroll como gesto válido).
- iOS Safari no permite cambiar el volumen por código: el fade de salida no es gradual allí.
- Las pruebas de autoplay se hicieron en Chrome con la política de autoplay relajada (compensado verificando la activación del usuario); falta validación en dispositivos reales.
- El store de Blobs de producción contiene registros de prueba del deploy preview (identificables: `PRUEBA Deploy Preview`, dominio `example.com`).

## 12. Decisiones dejadas deliberadamente para después

- Borrado de solicitudes, exportación/CSV, búsqueda, filtros, paginación y estadísticas.
- Notificaciones por email, Turnstile/CAPTCHA, múltiples usuarios, roles, notas internas, auditoría de actor.
- Edición de datos personales del aspirante.
- Cambios de tiempos globales (`scrollVh`, `dwellMs`) y de la coreografía de S3 sin revisión visual conjunta.

---

## Pendientes para revisión del equipo

1. **S3 / Teófilo:** revisar la forma en que actúa el retrato durante la transición, especialmente movimiento, llegada al centro, easing y tiempo contemplativo. **No modificar todavía `dwellMs`, `scrollVh` ni tiempos globales sin revisar visualmente con el equipo.**
2. **Landscape phone S4.**
3. **Responsive pendiente de S2** en algunos formatos.
4. **Navegación/enlaces pendientes de `/teofilo-leal`.**
5. **Auditoría final mouse/teclado/touch.**
6. **Contraste de elementos secundarios del header** (“Oriente de Barquisimeto”) **y etiqueta IN MEMORIAM.**
7. **Performance/preloader/audio.**
8. **Limpieza de registros de prueba de Netlify Blobs** (no borrar todavía).
9. **Validación real de autoplay / iOS Safari.**
10. **Funciones post-MVP:** búsqueda, filtros, exportación, notificaciones email, roles, auditoría de actor y notas internas.
