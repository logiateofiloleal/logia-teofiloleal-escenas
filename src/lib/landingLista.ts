// Señal "la landing ya se puede recorrer": el Preloader la da cuando libera
// el scroll del body (tras su coreografía, o al montar si la sesión ya lo
// vio). Indica además si fue la entrada normal por el preloader —el
// preloader se mostró en esta carga—, que es cuando aparece la guía de
// navegación (CoachMarks). Se reinicia con cada montaje de la landing, así
// que una navegación de vuelta a / vuelve a esperar a su propio Preloader.

let lista = false;
let porPreloader = false;
let pendientes: Array<(porPreloader: boolean) => void> = [];

export function reiniciarLandingLista(): void {
  lista = false;
  porPreloader = false;
}

export function avisarLandingLista(conPreloader = false): void {
  lista = true;
  porPreloader = conPreloader;
  const cbs = pendientes;
  pendientes = [];
  cbs.forEach(cb => cb(porPreloader));
}

/** Ejecuta `cb` cuando la landing esté lista (ya, si lo está). Devuelve la cancelación. */
export function alEstarLista(cb: (porPreloader: boolean) => void): () => void {
  if (lista) { cb(porPreloader); return () => {}; }
  pendientes.push(cb);
  return () => { pendientes = pendientes.filter(c => c !== cb); };
}
