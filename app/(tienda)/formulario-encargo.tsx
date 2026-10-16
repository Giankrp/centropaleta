"use client";

import { useActionState } from "react";
import { crearEncargoAccion, type EstadoAccion } from "./acciones";

const INICIAL: EstadoAccion = {};

export function FormularioEncargo() {
  const [estado, accion, pendiente] = useActionState(crearEncargoAccion, INICIAL);

  if (estado.exito !== undefined) {
    return (
      <section className="section" id="encargos">
        <div className="import-form-card">
          <div className="import-success" id="estado-encargo" role="status" tabIndex={-1}>
            <span className="eyebrow">SOLICITUD GUARDADA</span>
            <h3>¡Gracias por compartir tu próximo sueño!</h3>
            <p>Tu encargo <strong>{estado.exito}</strong> ha quedado registrado en el servidor. Nuestro equipo revisará el producto que buscas y se pondrá en contacto contigo para explicarte los siguientes pasos.</p>
            <p className="note">Maqueta: sin cobro ni compromisos reales. La solicitud queda registrada junto a tu sesión.</p>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="section" id="encargos">
      <div className="import-intro">
        <div className="eyebrow">DE JAPÓN A TU COLECCIÓN</div>
        <h2>Ese producto que sueñas,<br />lo buscamos contigo.</h2>
        <p>Desde Centro Paleta importamos cualquier producto de Japón relacionado con el TCG. Cuéntanos qué buscas: un miembro de nuestro equipo se pondrá en contacto contigo lo antes posible, con la información relevante para ayudarte a hacer realidad el sueño de conseguir ese producto.</p>
      </div>
      <div className="import-form-card">
        <div className="section-head">
          <div><h2>¿Qué producto buscas?</h2><p>Cuantos más detalles nos des, mejor podremos ayudarte.</p></div>
        </div>
        <form action={accion}>
          <fieldset className="sale-group">
            <legend><span>01</span> El producto de tus sueños</legend>
            <div className="formgrid">
              <div className="field full"><label htmlFor="import-product">Nombre del producto *</label><input id="import-product" name="product" maxLength={180} required placeholder="Ej. una caja japonesa, una carta o un accesorio TCG" /></div>
              <div className="field"><label htmlFor="import-universe">Universo</label><select id="import-universe" name="universe"><option>Pokémon</option><option>One Piece</option><option>Lorcana</option><option>Dragon Ball</option><option>Naruto</option><option>Otro TCG</option></select></div>
              <div className="field"><label htmlFor="import-quantity">Cantidad *</label><input id="import-quantity" name="quantity" type="number" min={1} max={999} step={1} defaultValue={1} required /></div>
              <div className="field"><label htmlFor="import-budget">Presupuesto orientativo total (€)</label><input id="import-budget" name="budget" type="number" min={0} step="0.01" placeholder="Opcional" /></div>
              <div className="field"><label htmlFor="import-url">Enlace de referencia</label><input id="import-url" name="url" type="url" maxLength={1000} placeholder="https://… (opcional)" /></div>
              <div className="field full"><label htmlFor="import-notes">Detalles que nos ayudarán a encontrarlo</label><textarea id="import-notes" name="notes" maxLength={2000} placeholder="Edición, idioma, estado, expansión, código o cualquier detalle importante…" /></div>
            </div>
          </fieldset>
          <fieldset className="sale-group">
            <legend><span>02</span> Cómo contactar contigo</legend>
            <div className="formgrid">
              <div className="field"><label htmlFor="import-name">Tu nombre *</label><input id="import-name" name="customerName" autoComplete="name" maxLength={100} required /></div>
              <div className="field"><label htmlFor="import-email">Correo electrónico *</label><input id="import-email" name="email" type="email" autoComplete="email" maxLength={180} required /></div>
              <div className="field full"><label htmlFor="import-phone">Teléfono / WhatsApp</label><input id="import-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="Opcional" /></div>
            </div>
          </fieldset>
          <p className="note">La solicitud permite estudiar disponibilidad y condiciones; no confirma una compra ni realiza ningún cobro.</p>
          {estado.error ? <p className="import-error" role="alert">{estado.error}</p> : null}
          <button className="btn" id="import-submit" disabled={pendiente}>{pendiente ? "Enviando…" : "Enviar solicitud de encargo"}</button>
          <p className="note">Solicitudes de demostración: quedan registradas en el servidor de esta maqueta sin cobro real.</p>
        </form>
      </div>
    </section>
  );
}
