"use client";

import { useActionState, useState } from "react";
import { entrarAccion, registrarAccion, type EstadoAccion } from "../acciones";

const INICIAL: EstadoAccion = {};

export function CuentaAcceso() {
  const [modo, setModo] = useState<"entrar" | "registro">("entrar");
  const [estadoEntrar, accionEntrar, pendienteEntrar] = useActionState(entrarAccion, INICIAL);
  const [estadoRegistro, accionRegistro, pendienteRegistro] = useActionState(registrarAccion, INICIAL);

  return (
    <div className="account-card" id="login-section">
      <span className="overline">BIENVENIDO</span>
      <h2>{modo === "entrar" ? "Inicia sesión" : "Crea tu cuenta"}</h2>
      <p>Accede a tu cuenta, guarda favoritos, haz tus pedidos y encarga productos desde Japón.</p>
      {modo === "entrar" ? (
        <form action={accionEntrar}>
          <label htmlFor="login-user">Usuario</label>
          <input id="login-user" name="username" type="text" autoComplete="username" required maxLength={30} />
          <label htmlFor="login-password">Contraseña</label>
          <input id="login-password" name="password" type="password" autoComplete="current-password" required />
          {estadoEntrar.error ? <p className="import-error" role="alert">{estadoEntrar.error}</p> : null}
          <button className="primary finish" disabled={pendienteEntrar}>{pendienteEntrar ? "Comprobando…" : "Entrar"}</button>
        </form>
      ) : (
        <form action={accionRegistro}>
          <label htmlFor="reg-user">Usuario (letras, números, . , - o _)</label>
          <input id="reg-user" name="username" type="text" autoComplete="username" required maxLength={30} minLength={3} />
          <label htmlFor="reg-password">Contraseña (8+ caracteres, letras y números)</label>
          <input id="reg-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <label htmlFor="reg-confirm">Repite la contraseña</label>
          <input id="reg-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
          {estadoRegistro.error ? <p className="import-error" role="alert">{estadoRegistro.error}</p> : null}
          <button className="primary finish" disabled={pendienteRegistro}>{pendienteRegistro ? "Creando…" : "Crear cuenta"}</button>
        </form>
      )}
      <button type="button" className="textlink" style={{ background: "none", border: 0, marginTop: 12 }} onClick={() => setModo(modo === "entrar" ? "registro" : "entrar")}>
        {modo === "entrar" ? "No tengo cuenta: registrarme" : "Ya tengo cuenta: iniciar sesión"}
      </button>
      <p className="micro">La cuenta de administración de la tienda entra aquí con sus credenciales del servidor.</p>
    </div>
  );
}
