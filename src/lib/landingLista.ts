// Señal "la landing ya se puede recorrer": el Preloader la da cuando libera
// el scroll del body (tras la intro y el preloader, o al montar si la sesión
// ya los vio). Se reinicia con cada montaje de la landing, así que una
// navegación de vuelta a / vuelve a esperar a su propio Preloader.

let lista = false;
let pendientes: Array<() => void> = [];

export function reiniciarLandingLista(): void {
  lista = false;
}

export function avisarLandingLista(): void {
  lista = true;
  const cbs = pendientes;
  pendientes = [];
  cbs.forEach(cb => cb());
}

/** Ejecuta `cb` cuando la landing esté lista (ya, si lo está). Devuelve la cancelación. */
export function alEstarLista(cb: () => void): () => void {
  if (lista) { cb(); return () => {}; }
  pendientes.push(cb);
  return () => { pendientes = pendientes.filter(c => c !== cb); };
}
