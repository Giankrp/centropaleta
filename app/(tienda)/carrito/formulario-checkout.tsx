"use client";

import { useActionState, useState } from "react";
import type { LineaPedido } from "../../../lib/carrito.ts";
import { finalizarCompraAccion, type EstadoAccion } from "../acciones";
import { PRECIO_ENVIO_CENTS } from "../../../lib/precios.ts";

const INICIAL: EstadoAccion = {};

function moneda(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

export function CarritoCheckoutForm({ lineas }: { lineas: LineaPedido[] }) {
  const [estado, accion, pendiente] = useActionState(finalizarCompraAccion, INICIAL);
  const [domicilio, setDomicilio] = useState(false);
  const subtotal = lineas.reduce(
    (total, linea) => total + linea.precioUnidadCents * linea.unidades,
    0,
  );
  const envio = domicilio ? PRECIO_ENVIO_CENTS : 0;
  return (
    <form action={accion}>
      {estado.error ? (
        <p className="import-error" role="alert">
          {estado.error}
        </p>
      ) : null}
      <fieldset className="delivery-options">
        <legend>¿Cómo quieres recibir tu pedido?</legend>
        <label>
          <input
            type="radio"
            name="delivery"
            value="pickup"
            checked={!domicilio}
            onChange={() => setDomicilio(false)}
          />
          <span>Recogida en tienda</span>
          <strong>Gratis</strong>
        </label>
        <label>
          <input
            type="radio"
            name="delivery"
            value="shipping"
            checked={domicilio}
            onChange={() => setDomicilio(true)}
          />
          <span>Envío a domicilio</span>
          <strong>4,99 €</strong>
        </label>
      </fieldset>
      {domicilio ? (
        <div className="field full">
          <label htmlFor="dirección-entrega">Dirección de envío</label>
          <input
            id="dirección-entrega"
            name="address"
            required
            autoComplete="street-address"
            placeholder="Calle, número, piso, ciudad…"
          />
        </div>
      ) : null}
      <div className="delivery-summary">
        <span>Productos</span>
        <span>{moneda(subtotal)}</span>
      </div>
      <div className="delivery-summary">
        <span>{domicilio ? "Envío a domicilio" : "Recogida en tienda"}</span>
        <span>{domicilio ? "4,99 €" : "Gratis"}</span>
      </div>
      <div className="total">
        <span>Total</span>
        <span>{moneda(subtotal + envio)}</span>
      </div>
      <button className="btn" style={{ width: "100%" }} disabled={pendiente}>
        {pendiente ? "Procesando…" : "Confirmar pedido (pago simulado)"}
      </button>
      <p className="note">
        Demo de maqueta: el pago es simulado, no se cobra nada real. Cuando exista la pasarela, el
        stock y el pedido solo se confirmarán tras un pago efectivo.
      </p>
    </form>
  );
}
