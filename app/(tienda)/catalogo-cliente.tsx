"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Catalogo, ProductoTienda, VentaReciente } from "../../lib/catalogo";
import { agregarArticuloAccion, alternarFavoritoAccion } from "./acciones";
import { useBusqueda } from "./busqueda";

const DESCUENTOS_EJEMPLO = [20, 15, 25, 10, 30];
const ORDENES = [
  ["default", "Orden recomendado"],
  ["price-asc", "Precio: menor a mayor"],
  ["price-desc", "Precio: mayor a menor"],
  ["name-asc", "Nombre: A–Z"],
  ["name-desc", "Nombre: Z–A"],
  ["newest", "Más recientes"],
] as const;

type ProductoVista = ProductoTienda & { descuentoDemo?: number; ejemplo?: boolean };

function moneda(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

function unidadCents(producto: ProductoVista): number {
  const descuento = producto.descuentoDemo ?? producto.descuento;
  return Math.max(1, Math.round((producto.precioBaseCents * (100 - descuento)) / 100));
}

function ordenar(listado: ProductoVista[], orden: string): ProductoVista[] {
  const porNombre = (a: ProductoVista, b: ProductoVista) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true });
  const ordenadores: Record<string, (a: ProductoVista, b: ProductoVista) => number> = {
    "price-asc": (a, b) => unidadCents(a) - unidadCents(b) || porNombre(a, b),
    "price-desc": (a, b) => unidadCents(b) - unidadCents(a) || porNombre(a, b),
    "name-asc": porNombre,
    "name-desc": (a, b) => porNombre(b, a),
    newest: (a, b) => b.id - a.id,
  };
  return [...listado].sort(ordenadores[orden] ?? (() => 0));
}

function TarjetaProducto({ producto, cliente, favorito, ofertaVista = false }: { producto: ProductoVista; cliente: boolean; favorito: boolean; ofertaVista?: boolean }) {
  const overlay = ofertaVista && (producto.descuentoDemo ?? producto.descuento) > 0;
  const descuento = producto.descuentoDemo ?? producto.descuento;
  return (
    <article className={"product" + (overlay ? " offer-image-card" : "")}>
      <div className="p-art">
        {producto.imagenUrl ? <img className="product-image" src={producto.imagenUrl} alt={producto.nombre} /> : <div className="no-product-image">📦<span>Sin imagen</span></div>}
        {descuento > 0 ? (
          <em className={"discount-badge" + (overlay ? " offer-discount-badge" : "")}><span className="discount-value">−{descuento}%</span>{overlay ? <small>DESCUENTO</small> : ""}</em>
        ) : producto.emblema ? <em>{producto.emblema}</em> : null}
        <form action={alternarFavoritoAccion}>
          <input type="hidden" name="productId" value={producto.id} />
          <button className={"fav" + (favorito ? " on" : "")} disabled={!cliente} title={cliente ? "Favorito" : "Inicia sesión para guardar favoritos"} aria-label="Favorito">{favorito ? "♥" : "♡"}</button>
        </form>
        {overlay ? (
          <div className="offer-image-prices">
            <span className="offer-now"><small>Ahora</small><strong>{moneda(unidadCents(producto))}</strong></span>
            <span className="offer-before">Antes <s>{moneda(producto.precioBaseCents)}</s></span>
          </div>
        ) : null}
      </div>
      <div className="p-body">
        <div className="tag">{producto.categoria} · {producto.set}</div>
        <h3>{producto.nombre}</h3>
        <span className="condition">{producto.estado}</span>
        <div className="price-row"><span className="price">{moneda(unidadCents(producto))}{descuento > 0 && producto.descuentoDemo == null ? <span className="old">{moneda(producto.precioBaseCents)}</span> : null}</span></div>
        <form action={agregarArticuloAccion}>
          <input type="hidden" name="productId" value={producto.id} />
          <input type="hidden" name="qty" value="1" />
          <input type="hidden" name="origen" value="/" />
          <button className="add" disabled={producto.stock === 0}>{producto.stock === 0 ? "Agotado" : "Añadir al carrito"}</button>
        </form>
        <Link className="textlink ver-detalle" href={`/producto/${producto.id}`}>Ver detalle</Link>
      </div>
    </article>
  );
}

function Rail({ productos, cliente, favoritos }: { productos: ProductoVista[]; cliente: boolean; favoritos: number[] }) {
  return (
    <div className="rail">
      {productos.length ? productos.map((producto) => <TarjetaProducto key={producto.id + (producto.ejemplo ? "-demo" : "")} producto={producto} cliente={cliente} favorito={favoritos.includes(producto.id)} />) : <div className="empty">No hay cartas que coincidan con tu búsqueda.</div>}
    </div>
  );
}

function SelectOrden({ valor, cambia }: { valor: string; cambia: (valor: string) => void }) {
  return (
    <label className="sort-control">
      <span>Ordenar por</span>
      <select value={valor} onChange={(evento) => cambia(evento.target.value)}>
        {ORDENES.map(([valorLista, texto]) => <option key={valorLista} value={valorLista}>{texto}</option>)}
      </select>
    </label>
  );
}

export function CatalogoCliente({ catalogo, cliente, favoritos }: { catalogo: Catalogo; cliente: boolean; favoritos: number[] }) {
  const { consulta } = useBusqueda();
  const [orden, setOrden] = useState("default");
  const [ordenFlash, setOrdenFlash] = useState("default");

  const texto = consulta.toLowerCase();
  const candidatos = useMemo(
    () => catalogo.productos.filter((producto) => `${producto.nombre} ${producto.categoria} ${producto.set} ${producto.codigo}`.toLowerCase().includes(texto)).map((producto) => ({ ...producto })),
    [catalogo, texto],
  );

  const ofertasEjemplo: ProductoVista[] = useMemo(() => {
    const reales = catalogo.productos.filter((producto) => producto.enOferta);
    const lista: ProductoVista[] = [];
    for (const producto of catalogo.productos) {
      if (reales.length + lista.length >= 5) break;
      if (reales.some((real) => real.id === producto.id)) continue;
      lista.push({ ...producto, descuentoDemo: DESCUENTOS_EJEMPLO[lista.length % DESCUENTOS_EJEMPLO.length], ejemplo: true });
    }
    return lista;
  }, [catalogo]);

  const ofertasFlash = useMemo(
    () => ordenar([...catalogo.productos.filter((producto) => producto.enOferta).map((producto) => ({ ...producto })), ...ofertasEjemplo], ordenFlash),
    [catalogo, ofertasEjemplo, ordenFlash],
  );

  const ventas: { venta: VentaReciente; producto: ProductoTienda | null }[] = catalogo.ventasRecientes.map((venta) => ({
    venta,
    producto: catalogo.productos.find((producto) => producto.id === venta.productId) ?? null,
  }));

  return (
    <>
      <section className="section" id="novedades">
        <div className="section-head">
          <div><h2>NOVEDADES Y NUEVOS LANZAMIENTOS</h2><p>Catálogo actual · precios de la tienda</p></div>
          <Link className="textlink" href="/productos">Ver todos los productos</Link>
        </div>
        <SelectOrden valor={orden} cambia={setOrden} />
        <Rail productos={ordenar(candidatos, orden)} cliente={cliente} favoritos={favoritos} />
      </section>

      <section className="section" id="flash" aria-labelledby="flash-title">
        <div className="section-head">
          <div><div className="eyebrow">Ofertas Paleta</div><h2 id="flash-title">Para los más rápidos</h2><p>Descuentos del catálogo · las tarjetas «EJEMPLO VISUAL» son ilustrativas</p></div>
        </div>
        <SelectOrden valor={ordenFlash} cambia={setOrdenFlash} />
        <div className="rail flash-rail">
          {ofertasFlash.length ? ofertasFlash.map((producto, indice) => <TarjetaProducto key={producto.id + (producto.ejemplo ? "-demo" : "") + indice} producto={producto} cliente={cliente} favorito={favoritos.includes(producto.id)} ofertaVista />) : <div className="empty">Aún no hay ofertas activas.</div>}
        </div>
      </section>

      <section className="section" id="ultimas-ventas" aria-labelledby="latest-sales-title">
        <div className="section-head">
          <div><h2 id="latest-sales-title">ÚLTIMAS VENTAS</h2><p>Lo último que ha encontrado un nuevo coleccionista.</p><p className="sales-demo-note">Ventas reales del servidor de la maqueta, con ejemplos visuales para completar la vista.</p></div>
        </div>
        <div className="rail flash-rail sales-rail">
          {ventas.length ? ventas.map(({ venta, producto }) => (
            <article className="product sold-product" key={venta.nombre + venta.fechaISO}>
              <div className="p-art">
                {producto?.imagenUrl ? <img className="product-image" src={producto.imagenUrl} alt={venta.nombre} loading="lazy" /> : producto ? <div className="no-product-image">📦<span>Sin imagen</span></div> : null}
                <em>{venta.ejemplo ? "VENTA DE EJEMPLO" : "VENDIDO"}</em>
              </div>
              <div className="p-body">
                {venta.ejemplo ? <span className="sample-label">EJEMPLO VISUAL</span> : null}
                <div className="tag">{producto?.categoria || "Coleccionable"}{producto?.set ? " · " + producto.set : ""}</div>
                <h3>{venta.nombre}</h3>
                <span className="condition">{venta.ejemplo ? "Vista previa de venta" : "Vendido el " + new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).format(new Date(venta.fechaISO))}</span>
                {producto ? <Link className="textlink" href="/productos">Ver productos similares</Link> : null}
              </div>
            </article>
          )) : <div className="sales-empty"><strong>Las próximas ventas aparecerán aquí</strong><p>Cuando se registre una venta física o un pedido online, verás aquí los productos vendidos.</p></div>}
        </div>
      </section>
    </>
  );
}
