"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProductoTienda } from "../../../lib/catalogo";
import { agregarArticuloAccion, alternarFavoritoAccion } from "../acciones";

const ORDENES = [
  ["default", "Orden recomendado"],
  ["price-asc", "Precio: menor a mayor"],
  ["price-desc", "Precio: mayor a menor"],
  ["name-asc", "Nombre: A–Z"],
  ["name-desc", "Nombre: Z–A"],
  ["newest", "Más recientes"],
] as const;

export function moneda(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

export function unidadDe(producto: ProductoTienda) {
  return Math.max(1, Math.round((producto.precioBaseCents * (100 - producto.descuento)) / 100));
}

function ordenar(listado: ProductoTienda[], orden: string) {
  const porNombre = (a: ProductoTienda, b: ProductoTienda) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true });
  const ordenadores: Record<string, (a: ProductoTienda, b: ProductoTienda) => number> = {
    "price-asc": (a, b) => unidadDe(a) - unidadDe(b) || porNombre(a, b),
    "price-desc": (a, b) => unidadDe(b) - unidadDe(a) || porNombre(a, b),
    "name-asc": porNombre,
    "name-desc": (a, b) => porNombre(b, a),
    newest: (a, b) => b.id - a.id,
  };
  return [...listado].sort(ordenadores[orden] ?? (() => 0));
}

export function TarjetaCatalogo({ producto, cliente, favorito, origen }: { producto: ProductoTienda; cliente: boolean; favorito: boolean; origen: string }) {
  return (
    <article className={"product" + (producto.descuento > 0 ? " offer-image-card" : "")}>
      <div className="p-art">
        {producto.imagenUrl ? <img className="product-image" src={producto.imagenUrl} alt={producto.nombre} /> : <div className="no-product-image">📦<span>Sin imagen</span></div>}
        {producto.descuento > 0 ? (
          <em className="discount-badge"><span className="discount-value">−{producto.descuento}%</span></em>
        ) : producto.emblema ? <em>{producto.emblema}</em> : null}
        <form action={alternarFavoritoAccion}>
          <input type="hidden" name="productId" value={producto.id} />
          <button className={"fav" + (favorito ? " on" : "")} disabled={!cliente} title={cliente ? "Favorito" : "Inicia sesión para guardar favoritos"} aria-label="Favorito">{favorito ? "♥" : "♡"}</button>
        </form>
        {producto.descuento > 0 ? (
          <div className="offer-image-prices">
            <span className="offer-now"><small>Ahora</small><strong>{moneda(unidadDe(producto))}</strong></span>
            <span className="offer-before">Antes <s>{moneda(producto.precioBaseCents)}</s></span>
          </div>
        ) : null}
      </div>
      <div className="p-body">
        <div className="tag">{producto.categoria} · {producto.set}</div>
        <h3>{producto.nombre}</h3>
        <span className="condition">{producto.estado}</span>
        <div className="price-row"><span className="price">{moneda(unidadDe(producto))}{producto.descuento > 0 ? <span className="old">{moneda(producto.precioBaseCents)}</span> : null}</span></div>
        <form action={agregarArticuloAccion}>
          <input type="hidden" name="productId" value={producto.id} />
          <input type="hidden" name="qty" value="1" />
          <input type="hidden" name="origen" value={origen} />
          <button className="add" disabled={producto.stock === 0}>{producto.stock === 0 ? "Agotado" : "Añadir al carrito"}</button>
        </form>
        <Link className="textlink ver-detalle" href={`/producto/${producto.id}`}>Ver detalle</Link>
      </div>
    </article>
  );
}

export function VistaCatalogo({
  productos, cliente, favoritos, titulo, subtitulo, universo, tipo, baseHref, breadcrumb,
}: {
  productos: ProductoTienda[];
  cliente: boolean;
  favoritos: number[];
  titulo: string;
  subtitulo: string;
  universo: string | null;
  tipo: string | null;
  baseHref: string;
  breadcrumb: { href: string; texto: string }[];
}) {
  const [consulta, setConsulta] = useState("");
  const [orden, setOrden] = useState("default");
  const texto = consulta.toLowerCase();
  const resultados = useMemo(() => ordenar(productos.filter((producto) => `${producto.nombre} ${producto.set} ${producto.codigo}`.toLowerCase().includes(texto)), orden), [productos, texto, orden]);
  const accesos = { cliente, favoritos };

  function ChipoTipo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
    const params = new URLSearchParams(baseHref.includes("?") ? baseHref.split("?")[1] : "");
    if (valor) params.set("tipo", valor);
    else params.delete("tipo");
    const href = baseHref.split("?")[0] + (params.toString() ? "?" + params.toString() : "");
    const activo = (tipo === null && valor === "") || tipo === valor;
    return <Link href={href} className={activo ? "selected" : ""} aria-current={activo ? "page" : undefined}>{etiqueta}</Link>;
  }

  return (
    <div className="catalog-carousel-shell">
      <div className="catalog-carousel-head">
        <p className="catalog-count" aria-live="polite">{resultados.length} {resultados.length === 1 ? "producto" : "productos"}</p>
        <label className="sort-control">
          <span>Ordenar por</span>
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            {ORDENES.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
          </select>
        </label>
        <label className="sort-control">
          <span>Buscar</span>
          <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Nombre, set o código…" />
        </label>
      </div>
      <nav className="product-types" aria-label="Tipos de productos">
        <ChipoTipo etiqueta="Todo" valor="" />
        <ChipoTipo etiqueta="Cartas" valor="cartas" />
        <ChipoTipo etiqueta="Sellado" valor="sellado" />
        <ChipoTipo etiqueta="Mystery Packs" valor="mistery-packs" />
      </nav>
      <div className="catalog-grid" role="region" aria-label={titulo + " · lista de productos"}>
        {resultados.length ? resultados.map((producto) => <TarjetaCatalogo key={producto.id} producto={producto} cliente={accesos.cliente} favorito={accesos.favoritos.includes(producto.id)} origen={baseHref} />) : <div className="catalog-empty"><h2>{texto ? "No hay coincidencias" : "Todavía no hay aquí productos"}</h2><p>{subtitulo}</p></div>}
      </div>
      <nav className="catalog-breadcrumb" aria-label="Ruta">
        {breadcrumb.map((item, indice) => (
          <span key={item.href}>
            <Link href={item.href}>{item.texto}</Link>
            {indice < breadcrumb.length - 1 ? <span aria-hidden="true"> / </span> : null}
          </span>
        ))}
        <span aria-hidden="true"> / </span>
        <span>{universo ? universo : "Todos los universos"}{tipo ? " · " + tipo : ""}</span>
      </nav>
    </div>
  );
}
