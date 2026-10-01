'use client';

import { useActionState, useEffect, useRef } from 'react';
import { enviarSolicitud, type EstadoSolicitud } from './actions';
import { CAMPOS, CAMPO_TRAMPA, LIMITES, valoresFormulario, type CampoFormulario } from '@/lib/aspiranteValidation';
import styles from './aspirantes.module.css';

const INICIAL: EstadoSolicitud = { status: 'idle', intento: 0 };
const ORDEN_FOCO: CampoFormulario[] = [...CAMPOS, 'consentimiento'];

// Si la acción no llega a responder (sin red, función caída), useActionState
// lanzaría el error al error boundary y la página se rompería con los datos
// dentro. Se convierte en un aviso más, conservando lo escrito.
async function enviar(prev: EstadoSolicitud, fd: FormData): Promise<EstadoSolicitud> {
  try {
    return await enviarSolicitud(prev, fd);
  } catch {
    return {
      status: 'error',
      mensaje: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo: tus datos siguen en el formulario.',
      valores: valoresFormulario(fd),
      intento: prev.intento + 1,
    };
  }
}

function FieldError({ campo, msg }: { campo: CampoFormulario; msg?: string }) {
  return msg ? (
    <p className={styles.fieldError} id={`${campo}-error`}>
      {msg}
    </p>
  ) : null;
}

export default function AspiranteForm() {
  const [state, formAction, pending] = useActionState(enviar, INICIAL);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Tras cada respuesta, lleva el foco a lo que la persona debe leer:
  // la confirmación, el primer campo con error o el aviso general.
  useEffect(() => {
    if (state.status === 'success') {
      confirmRef.current?.focus();
    } else if (state.status === 'error') {
      const primero = ORDEN_FOCO.find(c => state.errores?.[c]);
      const campo = primero && formRef.current?.querySelector<HTMLElement>(`[name="${primero}"]`);
      (campo ?? alertRef.current)?.focus();
    }
  }, [state]);

  if (state.status === 'success') {
    return (
      <div className={styles.confirmacion} role="status">
        <span className={styles.confirmSym} aria-hidden="true">✦</span>
        <h2 className={styles.confirmTitle} ref={confirmRef} tabIndex={-1}>
          Solicitud recibida
        </h2>
        <div className={styles.cardRule} aria-hidden="true" />
        <p className={styles.confirmText}>
          Gracias por tocar la puerta. Tu solicitud ha quedado registrada y será
          recibida con discreción y respeto fraternal.
        </p>
        <p className={styles.confirmText}>
          Un miembro de la Logia se pondrá en contacto contigo.
        </p>
      </div>
    );
  }

  const err = state.status === 'error' ? state.errores ?? {} : {};
  const val = state.valores ?? {};
  const a11y = (campo: CampoFormulario, hint?: boolean) => ({
    'aria-invalid': err[campo] ? true : undefined,
    'aria-describedby':
      [hint ? `${campo}-ayuda` : '', err[campo] ? `${campo}-error` : ''].filter(Boolean).join(' ') || undefined,
  });

  return (
    <form
      key={state.intento}
      ref={formRef}
      action={formAction}
      className={styles.form}
      noValidate
      aria-busy={pending}
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor="nombre">Nombre completo</label>
        <input
          className={styles.input}
          id="nombre"
          name="nombre"
          type="text"
          autoComplete="name"
          placeholder="Tu nombre y apellido"
          maxLength={LIMITES.nombre.max}
          required
          defaultValue={val.nombre}
          {...a11y('nombre')}
        />
        <FieldError campo="nombre" msg={err.nombre} />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edad">Edad</label>
          <input
            className={styles.input}
            id="edad"
            name="edad"
            type="text"
            inputMode="numeric"
            placeholder="Años cumplidos"
            maxLength={3}
            required
            defaultValue={val.edad}
            {...a11y('edad')}
          />
          <FieldError campo="edad" msg={err.edad} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="telefono">Teléfono</label>
          <input
            className={styles.input}
            id="telefono"
            name="telefono"
            type="tel"
            autoComplete="tel"
            placeholder="0414 123 4567"
            maxLength={24}
            required
            defaultValue={val.telefono}
            {...a11y('telefono')}
          />
          <FieldError campo="telefono" msg={err.telefono} />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">Correo electrónico</label>
        <input
          className={styles.input}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nombre@correo.com"
          maxLength={LIMITES.email.max}
          required
          defaultValue={val.email}
          {...a11y('email')}
        />
        <FieldError campo="email" msg={err.email} />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="descripcion">
          ¿Qué te motiva a acercarte a la Masonería?
        </label>
        <p className={styles.hint} id="descripcion-ayuda">
          Entre {LIMITES.descripcion.min} y {LIMITES.descripcion.max} caracteres.
        </p>
        <textarea
          className={styles.textarea}
          id="descripcion"
          name="descripcion"
          rows={5}
          placeholder="Comparte brevemente tu interés o motivación…"
          maxLength={LIMITES.descripcion.max}
          required
          defaultValue={val.descripcion}
          {...a11y('descripcion', true)}
        />
        <FieldError campo="descripcion" msg={err.descripcion} />
      </div>

      {/* Honeypot: fuera de la vista y del orden de tabulación. */}
      <div className={styles.trampa} aria-hidden="true">
        <label htmlFor={CAMPO_TRAMPA}>No completes este campo</label>
        <input id={CAMPO_TRAMPA} name={CAMPO_TRAMPA} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className={styles.field}>
        <div className={styles.consent}>
          <input
            className={styles.checkbox}
            id="consentimiento"
            name="consentimiento"
            type="checkbox"
            value="si"
            required
            defaultChecked={val.consentimiento}
            {...a11y('consentimiento')}
          />
          <label className={styles.consentLabel} htmlFor="consentimiento">
            Autorizo a la Respetable Logia Teófilo Leal N° 115 a usar estos datos
            exclusivamente para evaluar mi solicitud y ponerse en contacto conmigo.
            No serán compartidos con terceros.
          </label>
        </div>
        <FieldError campo="consentimiento" msg={err.consentimiento} />
      </div>

      {state.status === 'error' && state.mensaje && (
        <div className={styles.alert} role="alert" ref={alertRef} tabIndex={-1}>
          {state.mensaje}
        </div>
      )}

      <p className={styles.srOnly} role="status" aria-live="polite">
        {pending ? 'Enviando solicitud…' : ''}
      </p>

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  );
}
