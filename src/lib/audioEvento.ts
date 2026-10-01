// Canal para pausar/reanudar la música de la landing desde fuera de
// AmbientAudio (p. ej. el modal de acceso interno), sin acoplar componentes.
export const AUDIO_EVENTO = 'logia:audio';
export type AudioOrden = 'suspender' | 'reanudar';

export function ordenAudio(orden: AudioOrden): void {
  window.dispatchEvent(new CustomEvent<AudioOrden>(AUDIO_EVENTO, { detail: orden }));
}
