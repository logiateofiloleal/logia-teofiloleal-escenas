// Canal para dar órdenes a la música de la landing desde fuera de
// AmbientAudio, sin acoplar componentes: el modal de acceso interno la
// pausa y la reanuda; la guía de primera visita (CoachMarks) pide la ayuda
// del sonido junto al botón.
export const AUDIO_EVENTO = 'logia:audio';
export type AudioOrden = 'suspender' | 'reanudar' | 'pista';

export function ordenAudio(orden: AudioOrden): void {
  window.dispatchEvent(new CustomEvent<AudioOrden>(AUDIO_EVENTO, { detail: orden }));
}
