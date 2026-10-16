"use client";

import { useActionState, useState } from "react";
import { opcionesAvatares, avatarMarkup } from "../../../lib/avatars.ts";
import { guardarPerfilAccion, guardarAvatarAccion, type EstadoAccion } from "../../(tienda)/acciones";
import type { Perfil } from "../../../lib/usuarios.ts";

const INICIAL: EstadoAccion = {};

export function EditorPerfil({ perfil }: { perfil: Perfil }) {
  const [estado, accion, pendiente] = useActionState(guardarPerfilAccion, INICIAL);
  const [mostrarAvatares, setMostrarAvatares] = useState(false);
  const avatarActual = opcionesAvatares.find((a) => a.id === perfil.avatar) ?? opcionesAvatares[0];

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
        {estado.error ? <p className="import-error" role="alert">{estado.error}</p> : null}
        <button className="primary" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar mi perfil"}</button>
        {estado.exito ? <p className="note" role="status">{estado.exito}</p> : null}
      </form>
      <p className="micro border-top" style={{ marginTop: 12 }}>
        {avatarActual ? "Avatar actual: " + avatarActual.name + " · " : ""}
        <button type="button" className="textlink" onClick={() => setMostrarAvatares(!mostrarAvatares)}>{mostrarAvatares ? "Cerrar galería" : "Cambiar avatar"}</button>
      </p>
      {mostrarAvatares ? (
        <div>
          {["Exploradores y criaturas", "Piratas", "Guerreros", "Ninjas"].map((grupo) => (
            <fieldset className="avatar-group" key={grupo}>
              <legend>{grupo}</legend>
              <div className="avatar-grid">
                {opcionesAvatares.filter((a) => a.grupo === grupo).map((avatar) => (
                  <form action={guardarAvatarAccion} key={avatar.id}>
                    <input type="hidden" name="avatar" value={avatar.id} />
                    <button type="submit" className={"avatar-option" + (avatar.id === perfil.avatar ? " selected" : "")} aria-label={"Elegir " + avatar.name} title={avatar.name} aria-pressed={avatar.id === perfil.avatar}>
                      <span dangerouslySetInnerHTML={{ __html: avatarMarkup(avatar.id) }} />
                    </button>
                  </form>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      ) : null}
    </section>
  );
}
