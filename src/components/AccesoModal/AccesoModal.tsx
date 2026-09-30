'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { iniciarSesion, sesionActiva, type EstadoAcceso } from '@/app/interno/actions';
import styles from './AccesoModal.module.css';

// ── Modal del acceso interno ─────────────────────────────────────────
// Se abre desde "Acceso interno" del menú (o con /?acceso). Diálogo modal
// accesible: foco inicial en Usuario, Tab no sale del diálogo, Escape y
// "Volver al inicio" lo cierran, el resto de la página queda inerte
// mientras está abierto. Credenciales válidas → cookie de sesión (servidor)
// y navegación a /interno.

const INICIAL: EstadoAcceso = { status: 'idle', intento: 0 };
const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

async function enviar(prev: EstadoAcceso, fd: FormData): Promise<EstadoAcceso> {
  try {
    return await iniciarSesion(prev, fd);
  } catch {
    return { status: 'error', mensaje: 'No pudimos conectar con el servidor. Inténtalo de nuevo.', usuario: String(fd.get('usuario') ?? ''), intento: prev.intento + 1 };
  }
}

export default function AccesoModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState(enviar, INICIAL);
  const dialogRef = useRef<HTMLDivElement>(null);
  const usuarioRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Abrir: bloquea el scroll (en <html>: el <body> lo gestionan Preloader y
  // FinalGate), deja inerte el resto de la página y devuelve el foco al
  // cerrar. Si ya hay sesión, va directo a /interno.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflowPrevio = html.style.overflow;
    html.style.overflow = 'hidden';
    const portal = dialogRef.current?.parentElement;
    const inertes = [...document.body.children].filter(el => el !== portal && !el.hasAttribute('inert')) as HTMLElement[];
    inertes.forEach(el => el.setAttribute('inert', ''));
    usuarioRef.current?.focus();

    let vigente = true;
    sesionActiva().then(activa => {
      if (vigente && activa) { onCloseRef.current(); router.push('/interno'); }
    }).catch(() => {});

    return () => {
      vigente = false;
      html.style.overflow = overflowPrevio;
      inertes.forEach(el => el.removeAttribute('inert'));
      previo?.focus?.();
    };
  }, [router]);

  // Tras cada respuesta: éxito → /interno; error → foco en la contraseña
  // (el usuario se conserva para corregir sin reescribir).
  useEffect(() => {
    if (state.status === 'ok') {
      router.push('/interno');
      onCloseRef.current();
    } else if (state.status === 'error') {
      (state.usuario ? passwordRef.current : usuarioRef.current)?.focus();
    }
  }, [state, router]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const nodos = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLES)];
    if (!nodos.length) return;
    const primero = nodos[0], ultimo = nodos[nodos.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  function volverAlInicio() {
    onClose();
    if (pathname !== '/') router.push('/');
  }

  const error = state.status === 'error' ? state.mensaje : undefined;

  return createPortal(
    <div
      className={styles.overlay}
      onKeyDown={onKeyDown}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="acceso-titulo"
        aria-describedby="acceso-kicker"
      >
        <Image className={styles.logo} src="/assets/img/logo.png" alt="Logo Logia Teófilo Leal N° 115" width={60} height={60} />
        <span className={styles.kicker} id="acceso-kicker">Acceso interno · Logia N° 115</span>
        <h2 className={styles.title} id="acceso-titulo">Acceso restringido</h2>
        <div className={styles.rule} aria-hidden="true" />

        <form key={state.intento} action={formAction} className={styles.form} noValidate aria-busy={pending}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="acceso-usuario">Usuario</label>
            <input
              ref={usuarioRef}
              className={styles.input}
              id="acceso-usuario"
              name="usuario"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Nombre de usuario"
              defaultValue={state.usuario ?? ''}
              maxLength={100}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'acceso-error' : undefined}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="acceso-password">Contraseña</label>
            <input
              ref={passwordRef}
              className={styles.input}
              id="acceso-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              maxLength={256}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'acceso-error' : undefined}
            />
          </div>

          {error && (
            <p className={styles.error} id="acceso-error" role="alert">{error}</p>
          )}
          <p className={styles.srOnly} role="status" aria-live="polite">{pending ? 'Verificando acceso…' : ''}</p>

          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? 'Verificando…' : 'Entrar'}
          </button>
        </form>

        <button type="button" className={styles.back} onClick={volverAlInicio}>
          <span className={styles.ln} />
          Volver al inicio
        </button>
      </div>
    </div>,
    document.body,
  );
}
