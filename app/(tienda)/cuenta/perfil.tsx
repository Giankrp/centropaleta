"use client";

import { useActionState } from "react";
import { opcionesAvatares } from "../../../lib/avatars";
import { guardarPerfilAccion, guardarAvatarAccion, type EstadoAccion } from "../acciones";
import type { Perfil } from "../../../lib/usuarios";

const INICIAL: EstadoAccion = {};

export function CuentaPerfil({ perfil }: { perfil: Perfil }) {
  const [estado, accion, pendiente] = useActionState(guardarPerfilAccion, INICIAL);

  return (
    <div className="page-heading">
      <div>
        <span className="overline">ÁREA DE CLIENTE · {perfil.username}</span>
        <h2>{perfil.displayName || perfil.username}</h2>
      </div>
    </div>
  );
}

export function EditorPerfil({ perfil }: { perfil: Perfil }) {
  const [estado, accion, pendiente] = useActionState(guardarPerfilAccion, INICIAL);

  return (
    <section className="account-card">
      <span className="overline">MI PERFIL</span>
      <h3>Datos de contacto</h3>
      <form action={accion}>
        <label htmlFor="p-name">Nombre para mostrar</label>
        <input id="p-name" name="displayName" type="text" maxLength={100} defaultValue={perfil.displayName ?? ""} />
        <label htmlFor="p-email">Correo electrónico</label>
        <input id="p-email" name="contactEmail" type="email" maxLength={180} defaultValue={perfil.contactEmail ?? ""} />
        <label htmlFor="p-phone">Teléfono / WhatsApp</label>
        <input id="p-phone" name="contactPhone" type="tel" maxLength={40} defaultValue={perfil.contactPhone ?? ""} />
        <label htmlFor="p-address">Dirección de envío</label>
        <input id="p-address" name="address" type="text" maxLength={300} defaultValue={perfil.address ?? ""} autoComplete="street-address" />
        {estado.error ? <p className="import-error" role="alert">{estado.error}</p> : estado.exito ? <p className="note" role="status">{estado.exito}</p> : null}
        <button className="primary" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar mi perfil"}</button>
      </form>
      <details className="avatar-details">
        <summary>Avatar ({opcionesAvatares.find((a) => a.id === perfil.avatar)?.name ?? "Exploradora Coral"})</summary>
        <div className="avatar-picker">
          {opcionesAvatares.map((avatar) => (
            <form action={guardarAvatarAccion} key={avatar.id}>
              <input type="hidden" name="avatar" value={avatar.id} />
              <button type="submit" className="avatar-option" aria-label={"Elegir " + avatar.name} title={avatar.name}
                style={{ backgroundPosition: `${(avatar.index % 4) * (100 / 3)}% ${Math.floor(avatar.index / 4) * 50}%` }} />
            </form>
          ))}
        </div>
      </details>
    </section>
  );
}
