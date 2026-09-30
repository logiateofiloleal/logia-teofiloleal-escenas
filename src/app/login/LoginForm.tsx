'use client';

import { useState } from 'react';
import styles from './login.module.css';

// Solo visual por ahora: la autenticación llega con el panel. El envío se
// intercepta para que las credenciales nunca viajen en la URL (un <form>
// sin acción haría GET con usuario y contraseña a la vista).
export default function LoginForm() {
  const [aviso, setAviso] = useState('');

  return (
    <form
      className={styles.form}
      onSubmit={e => {
        e.preventDefault();
        setAviso('El acceso interno todavía no está habilitado.');
      }}
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor="usuario">Usuario</label>
        <input
          className={styles.input}
          id="usuario"
          name="usuario"
          type="text"
          autoComplete="username"
          placeholder="Nombre de usuario"
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">Contraseña</label>
        <input
          className={styles.input}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      <p className={styles.aviso} role="status" aria-live="polite">{aviso}</p>

      <button type="submit" className={styles.submit}>Entrar</button>
    </form>
  );
}
