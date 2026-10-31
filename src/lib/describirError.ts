// Resumen de un error para los logs: solo tipo/código y mensaje. Nunca el
// objeto completo: los errores de Supabase traen `details` con el valor que
// violó una restricción (un correo o un teléfono), y no deben quedar datos
// personales en los logs.
export function describirError(err: unknown): string {
  if (err && typeof err === 'object') {
    const { name, code, message } = err as { name?: unknown; code?: unknown; message?: unknown };
    const tipo = [name, code].filter(v => typeof v === 'string' && v).join(' ');
    return `${tipo || 'Error'}: ${typeof message === 'string' ? message : 'sin mensaje'}`;
  }
  return String(err);
}
