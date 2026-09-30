import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/session';

// /login ya no es una pantalla: el acceso es el modal del menú. Se conserva
// para enlaces y marcadores antiguos — con sesión va a /interno; sin ella,
// al inicio con el modal de acceso abierto.
export default async function LoginPage() {
  redirect((await obtenerSesion()) ? '/interno' : '/?acceso');
}
