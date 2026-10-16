"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProductoTienda } from "../../../lib/catalogo";
import type { ProductoVista } from "../card-producto";
import { CardProducto, unidadCents } from "../card-producto";

const ORDENES = [
  ["default", "Orden recomendado"],
  ["price-asc", "Precio: menor a mayor"],
  ["price-desc", "Precio: mayor a menor"],
  ["name-asc", "Nombre: A–Z"],
  ["name-desc", "Nombre: Z–A"],
  ["newest", "Más recientes"],
] as const;

function ordenar(listado: ProductoVista[], orden: string): ProductoVista[] {
  const porNombre = (a: ProductoVista, b: ProductoVista) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true });
  const ordenadores: Record<string, (a: ProductoVista, b: ProductoVista) => number> = {
    "price-asc": (a, b) => unidadCents(a) - unidadCents(b) || porNombre(a, b),
    "price-desc": (a, b) => unidadCents(b) - unidadCents(a) || porNombre(a, b),
    "name-asc": porNombre,
    "name-desc": (a, b) => porNombre(b, a),
    newest: (a, b) => b.id - a.id,
  };
  return [...listado].sort(ordenadores[orden] ?? (() => 0));
}

export function VistaCatalogo({
  productos,
  cliente,
  favoritos,
  titulo,
  subtitulo,
  universo,
  tipo,
  baseHref,
  breadcrumb,
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
  const resultados = useMemo(
    () =>
      ordenar(
        productos.filter((producto) =>
          `${producto.nombre} ${producto.set} ${producto.codigo}`.toLowerCase().includes(texto),
        ),
        orden,
      ),
    [productos, texto, orden],
  );

  function ChipoTipo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
    const params = new URLSearchParams(baseHref.includes("?") ? baseHref.split("?")[1] : "");
    if (valor) params.set("tipo", valor);
    else params.delete("tipo");
    const href = baseHref.split("?")[0] + (params.toString() ? "?" + params.toString() : "");
    const activo = (tipo === null && valor === "") || tipo === valor;
    return (
      <Link
        href={href}
        className={activo ? "selected" : ""}
        aria-current={activo ? "page" : undefined}
      >
        {etiqueta}
      </Link>
    );
  }

  return (
    <div className="catalog-carousel-shell">
      <div className="catalog-carousel-head">
        <p className="catalog-count" aria-live="polite">
          {resultados.length} {resultados.length === 1 ? "producto" : "productos"}
        </p>
        <label className="sort-control">
          <span>Ordenar por</span>
          <select value={orden} onChange={(evento) => setOrden(evento.target.value)}>
            {ORDENES.map(([valorLista, texto]) => (
              <option key={valorLista} value={valorLista}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <label className="sort-control">
          <span>Buscar</span>
          <input
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Nombre, set o código…"
          />
        </label>
      </div>
      <nav className="product-types" aria-label="Tipos de productos">
        <ChipoTipo etiqueta="Todo" valor="" />
        <ChipoTipo etiqueta="Cartas" valor="cartas" />
        <ChipoTipo etiqueta="Sellado" valor="sellado" />
        <ChipoTipo etiqueta="Mystery Packs" valor="mistery-packs" />
      </nav>
      <div className="catalog-grid" role="region" aria-label={titulo + " · lista de productos"}>
        {resultados.length ? (
          resultados.map((producto) => (
            <CardProducto
              key={producto.id}
              producto={producto}
              cliente={cliente}
              favorito={favoritos.includes(producto.id)}
              origen={baseHref}
            />
          ))
        ) : (
          <div className="catalog-empty">
            <h2>{texto ? "No hay coincidencias" : "Aún no hay productos en este universo"}</h2>
            <p>{subtitulo}</p>
          </div>
        )}
      </div>
      <nav className="catalog-breadcrumb" aria-label="Ruta">
        {breadcrumb.map((item, indice) => (
          <span key={item.href}>
            <Link href={item.href}>{item.texto}</Link>
            {indice < breadcrumb.length - 1 ? <span aria-hidden="true"> / </span> : null}
          </span>
        ))}
        <span aria-hidden="true"> / </span>
        <span>
          {universo ? universo : "Todos los universos"}
          {tipo ? " · " + tipo : ""}
        </span>
      </nav>
    </div>
  );
}
