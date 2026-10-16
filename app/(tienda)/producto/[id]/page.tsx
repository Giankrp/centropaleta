import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { obtenerCatalogo, productoPorId } from "../../../../lib/catalogo.ts";
import { formatearCents, precioUnidadCents } from "../../../../lib/precios.ts";
import { agregarArticuloAccion } from "@/app/(tienda)/acciones";
import { leerSesion } from "../../../../lib/sesion-servidor.ts";
import { contarCarrito } from "../../../../lib/carrito.ts";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const catalogo = await obtenerCatalogo();
  const producto = productoPorId(catalogo, Number(id));
  return {
    title: producto ? producto.nombre + " — Centro Paleta" : "Producto no encontrado — Centro Paleta",
    description: producto?.descripcion || "Cartas y coleccionables de Centro Paleta",
  };
}

export default async function PaginaProducto({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const catalogo = await obtenerCatalogo();
  const producto = productoPorId(catalogo, Number(id));
  if (!producto) notFound();
  const sesion = await leerSesion();
  const enCarrito = sesion ? await contarCarrito(sesion.u) : 0;

  return (
    <main className="wrap" style={{ paddingBottom: 70 }}>
      <nav className="catalog-breadcrumb" aria-label="Ruta"><Link href="/">Inicio</Link><span aria-hidden="true">/</span><Link href="/productos">Productos</Link><span aria-hidden="true">/</span><span>{producto.nombre}</span></nav>
      <div className="quick" style={{ marginTop: 24 }}>
        <div className="p-art">
          {producto.imagenUrl ? <img className="product-image" src={producto.imagenUrl} alt={producto.nombre} /> : <div className="no-product-image">📦<span>Sin imagen</span></div>}
          {producto.descuento > 0 ? <em className="discount-badge"><span className="discount-value">−{producto.descuento}%</span></em> : producto.emblema ? <em>{producto.emblema}</em> : null}
        </div>
        <div>
          <div className="tag">{producto.categoria} · {producto.set}</div>
          <h1 style={{ fontSize: 26, margin: "8px 0" }}>{producto.nombre}</h1>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>Estado: {producto.estado}</p>
          <section className="product-description">
            <h4>Descripción</h4>
            <p>{producto.descripcion || "Descripción pendiente de añadir."}</p>
          </section>
          <div className="price" style={{ margin: "18px 0" }}>
            {formatearCents(producto.precioUnidadCents)}
            {producto.descuento > 0 ? <span className="old">{formatearCents(producto.precioBaseCents)}</span> : null}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>{producto.stock > 0 ? `Quedan ${producto.stock} unidades` : "Sin unidades disponibles"}</p>
          <form action={agregarArticuloAccion}>
            <input type="hidden" name="productId" value={producto.id} />
            <input type="hidden" name="origen" value={`/producto/${producto.id}`} />
            <div className="qty" style={{ marginBottom: 8 }}>
              <label htmlFor="qty-detalle">Cantidad</label>
              <input id="qty-detalle" name="qty" type="number" min={1} max={Math.max(1, producto.stock)} defaultValue={1} disabled={producto.stock === 0} style={{ width: 70 }} />
            </div>
            <button className="btn disabled" disabled={producto.stock === 0}>{producto.stock === 0 ? "Agotado" : "Añadir al carrito"}</button>
          </form>
          <p style={{ marginTop: 14 }}><Link className="outline" href="/carrito.ts">{enCarrito ? `Ir al carrito (${enCarrito})` : "Ver carrito"}</Link></p>
        </div>
      </div>
    </main>
  );
}
