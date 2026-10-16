"use client";

import { useActionState } from "react";
import { crearPropuestaVentaAccion, type EstadoAccion } from "./acciones";

const INICIAL: EstadoAccion = {};

export function FormularioVenta() {
  const [estado, accion, pendiente] = useActionState(crearPropuestaVentaAccion, INICIAL);

  if (estado.exito !== undefined) {
    return (
      <div className="sale-submit">
        <div className="import-success" role="status">
          <span className="eyebrow">PROPUESTA GUARDADA</span>
          <h3>¡Gracias por proponernos tu producto!</h3>
          <p>Tu referencia <strong>{estado.exito}</strong> quedó registrada en el servidor con las fotografías. Revisaremos la proposta y te contactaremos con una valoración.</p>
          <button className="btn ghost" onClick={() => location.reload()}>Enviar otra propuesta</button>
        </div>
      </div>
    );
  }
  return (
    <form>
      <fieldset className="sale-group">
        <legend><span>01</span> Datos del producto</legend>
        <div className="formgrid">
          <div className="field"><label htmlFor="value-name">Nombre del producto *</label><input required id="value-name" name="name" placeholder="Ej. Charizard ex o caja de sobres" /></div>
          <div className="field"><label htmlFor="value-universe">Universo *</label><select id="value-universe" name="universe"><option>Pokémon</option><option>One Piece</option><option>Dragon Ball</option><option>Otro TCG</option></select></div>
          <div className="field"><label htmlFor="value-product-type">Tipo de producto</label><select id="value-product-type" name="productType"><option value="Raw">Raw</option><option value="Gradeada">Gradeada</option><option value="Sellado">Sellado</option></select></div>
          <div className="field"><label htmlFor="value-set">Expansión</label><input id="value-set" name="set" placeholder="Nombre o código" /></div>
        </div>
      </fieldset>
      <fieldset className="sale-group">
        <legend><span>02</span> Estado y precio</legend>
        <div className="formgrid">
          <div className="field"><label htmlFor="value-condition">Estado</label><select id="value-condition" name="condition"><option>Casi nueva</option><option>Excelente</option><option>Buen estado</option><option>Usada</option><option>Muy deteriorada</option></select></div>
          <div className="field"><label htmlFor="value-price">Precio que propones (€) *</label><input required type="number" min={0} step=".01" id="value-price" name="price" placeholder="0,00" /></div>
        </div>
      </fieldset>
      <fieldset className="sale-group">
        <legend><span>03</span> Fotografías y detalles</legend>
        <div className="formgrid">
          <div className="field full"><label htmlFor="value-photos">Fotografías (hasta 6) *</label><div className="upload"><input type="file" id="value-photos" name="photos" accept="image/png,image/jpeg,image/webp" multiple required /><div>Sube imágenes nítidas del frontal y reverso</div></div></div>
          <div className="field full"><label htmlFor="value-notes">Detalles adicionales</label><textarea id="value-notes" name="notes" placeholder="Idioma, defectos, edición..." /></div>
        </div>
      </fieldset>
      {estado.error ? <p className="import-error" role="alert">{estado.error}</p> : null}
      <div className="sale-submit">
        <button className="btn" disabled={pendiente}>{pendiente ? "Enviando…" : "Guardar propuesta"}</button>
        <div className="note">La propuesta se guarda en el servidor de esta maqueta; aún no hay cobros ni compromisos reales.</div>
      </div>
    </form>
  );
}
