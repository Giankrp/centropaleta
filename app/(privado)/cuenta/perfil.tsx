"use client";

import { useActionState, useState } from "react";
import { opcionesAvatares, avatarMarkup } from "../../../lib/avatars.ts";
import {
  guardarPerfilAccion,
  guardarAvatarAccion,
  type EstadoAccion,
} from "../../(tienda)/acciones";
import type { Perfil } from "../../../lib/usuarios.ts";

const INICIAL: EstadoAccion = {};

export function SelectorAvatar({ perfil }: { perfil: Perfil }) {
  const [mostrar, setMostrar] = useState(false);
  const avatarActual = opcionesAvatares.find((a) => a.id === perfil.avatar) ?? opcionesAvatares[0];

  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "center", width: "100%" }}>
      <span
        className="cp-avatar"
        style={{
          backgroundPosition: `${(avatarActual.index % 4) * (100 / 3)}% ${Math.floor(avatarActual.index / 4) * 50}%`,
        }}
        role="img"
        aria-label={avatarActual.name}
      />
      {mostrar ? (
        <div className="selector-avatar-grid">
          {opcionesAvatares.map((avatar) => (
            <form action={guardarAvatarAccion} key={avatar.id}>
              <input type="hidden" name="avatar" value={avatar.id} />
              <button
                type="submit"
                className={"avatar-option" + (avatar.id === perfil.avatar ? " selected" : "")}
                aria-label={"Elegir " + avatar.name}
                title={avatar.name}
                aria-pressed={avatar.id === perfil.avatar}
                style={{ padding: 0, border: 0, background: "none" }}
              >
                <span
                  className="cp-avatar"
                  style={{
                    backgroundPosition: `${(avatar.index % 4) * (100 / 3)}% ${Math.floor(avatar.index / 4) * 50}%`,
                  }}
                />
              </button>
            </form>
          ))}
        </div>
      ) : null}
      <button type="button" className="textlink" onClick={() => setMostrar(!mostrar)}>
        {mostrar ? "Cerrar galería" : "Cambiar avatar"}
      </button>
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
        <input
          id="p-name"
          name="displayName"
          type="text"
          maxLength={100}
          defaultValue={perfil.displayName ?? ""}
        />
        <label htmlFor="p-email">Correo electrónico</label>
        <input
          id="p-email"
          name="contactEmail"
          type="email"
          maxLength={180}
          defaultValue={perfil.contactEmail ?? ""}
        />
        <label htmlFor="p-phone">Teléfono / WhatsApp</label>
        <input
          id="p-phone"
          name="contactPhone"
          type="tel"
          maxLength={40}
          defaultValue={perfil.contactPhone ?? ""}
        />
        <label htmlFor="p-address">Dirección de envío</label>
        <input
          id="p-address"
          name="address"
          type="text"
          maxLength={300}
          defaultValue={perfil.address ?? ""}
          autoComplete="street-address"
        />
        {estado.error ? (
          <p className="import-error" role="alert">
            {estado.error}
          </p>
        ) : null}
        <button className="primary" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar mi perfil"}
        </button>
        {estado.exito ? (
          <p className="note" role="status">
            {estado.exito}
          </p>
        ) : null}
      </form>
    </section>
  );
}
