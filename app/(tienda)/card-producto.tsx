"use client";

import Link from "next/link";
import type { ProductoTienda } from "../../lib/catalogo.ts";
import { agregarArticuloAccion, alternarFavoritoAccion } from "./acciones";
import { BotonCarrito } from "./boton-carrito";

export type ProductoVista = ProductoTienda & { descuentoDemo?: number; ejemplo?: boolean };

export function moneda(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

export function unidadCents(producto: ProductoVista): number {
  const descuento = producto.descuentoDemo ?? producto.descuento;
  return Math.max(1, Math.round((producto.precioBaseCents * (100 - descuento)) / 100));
}

export function CardProducto({
  producto,
  cliente,
  favorito,
  origen,
}: {
  producto: ProductoVista;
  cliente: boolean;
  favorito: boolean;
  origen: string;
}) {
  const descuento = producto.descuentoDemo ?? producto.descuento;
  return (
    <article className="product">
      <div className="p-art">
        {producto.imagenUrl ? (
          <img className="product-image" src={producto.imagenUrl} alt={producto.nombre} />
        ) : (
          <div className="no-product-image">
            📦<span>Sin imagen</span>
          </div>
        )}
        {descuento > 0 ? (
          <em className="discount-badge">
            <span className="discount-value">−{descuento}%</span>
          </em>
        ) : producto.emblema ? (
          <em>{producto.emblema}</em>
        ) : null}
        <form action={alternarFavoritoAccion}>
          <input type="hidden" name="productId" value={producto.id} />
          <button
            className={"fav" + (favorito ? " on" : "")}
            disabled={!cliente || producto.ejemplo}
            title={cliente ? "Favorito" : "Inicia sesión para guardar favoritos"}
            aria-label="Favorito"
          >
            {favorito ? "♥" : "♡"}
          </button>
        </form>
      </div>
      <div className="p-body">
        {producto.ejemplo ? <span className="sample-label">EJEMPLO VISUAL</span> : null}
        <div className="tag">
          {producto.categoria} · {producto.set}
        </div>
        <h3>{producto.nombre}</h3>
        <span className="condition">{producto.estado}</span>
        <div className="price-row">
          <span className="price">
            {moneda(unidadCents(producto))}
            {descuento > 0 ? <span className="old">{moneda(producto.precioBaseCents)}</span> : null}
          </span>
        </div>
        {producto.ejemplo ? (
          <span className="add add-demo" aria-hidden="true">
            Ejemplo de la tienda
          </span>
        ) : (
          <>
            <form action={agregarArticuloAccion}>
              <input type="hidden" name="productId" value={producto.id} />
              <input type="hidden" name="qty" value="1" />
              <input type="hidden" name="origen" value={origen} />
              <BotonCarrito agotado={producto.stock === 0} />
            </form>
            <Link className="textlink ver-detalle" href={`/producto/${producto.id}`}>
              Ver detalle
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
