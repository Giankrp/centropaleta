import Link from "next/link";
import { articulosCarrito, contarCarrito } from "../../../lib/carrito.ts";
import { leerSesion } from "../../../lib/sesion-servidor.ts";
import { ensureSchema } from "../../../lib/inventario/bd.ts";
import { loadInventory } from "../../../lib/inventario/servicio.ts";
import { precioUnidadCents, formatearCents } from "../../../lib/precios.ts";
import { quitarArticuloAccion, ajustarCantidadAccion, vaciarCarritoAccion } from "../acciones";
import { CarritoCheckoutForm } from "./formulario-checkout";

type ProductoInventario = {
  id: number;
  name: string;
  price: number;
  stock: number;
  image?: string | null;
  photo?: string | null;
  cat: string;
  set: string;
  offerActive?: boolean | null;
  offerPercent?: number | null;
};

function imagenDe(producto: ProductoInventario) {
  if (producto.photo) return `/api/photo/${producto.id}`;
  if (producto.image) return `/assets/${producto.image}.webp`;
  return null;
}

export default async function PaginaCarrito({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  await ensureSchema();
  const sesion = await leerSesion();
  const estado = (await loadInventory()) as { state: { products: ProductoInventario[] } };
  if (!sesion || !(await contarCarrito(sesion.u))) {
    return (
      <main className="wrap" style={{ minHeight: "60vh", paddingBottom: 70 }}>
        <nav className="catalog-breadcrumb" aria-label="Ruta">
          <Link href="/">Inicio</Link>
          <span aria-hidden="true">/</span>
          <span>Carrito</span>
        </nav>
        <div className="catalog-head">
          <h1>Carrito</h1>
        </div>
        <div className="empty">
          Tu carrito está vacío 🛒<br />
          <small>Explora el catálogo y añade tus cartas favoritas.</small>
        </div>
        <p style={{ textAlign: "center", marginTop: 20 }}>
          <Link className="btn" href="/#productos">
            Explorar catálogo
          </Link>
        </p>
      </main>
    );
  }
  const articulos = await articulosCarrito(sesion.u);
  const lineasDecoradas = articulos
    .map((articulo) => {
      const producto = estado.state.products.find((p) => p.id === articulo.productId);
      if (!producto) return null;
      const unidad = precioUnidadCents(producto);
      return { producto, unidades: articulo.qty, unidadCents: unidad };
    })
    .filter((linea): linea is NonNullable<typeof linea> => linea !== null);

  return (
    <main className="wrap" style={{ paddingBottom: 70 }}>
      <nav className="catalog-breadcrumb" aria-label="Ruta">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>Carrito</span>
      </nav>
      <div className="catalog-head">
        <div>
          <h1>Carrito</h1>
          <p>El pago es simulado; se registra un pedido real en el servidor de la maqueta.</p>
        </div>
      </div>
      {error ? (
        <p className="import-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="modal static-modal">
        {lineasDecoradas.map(({ producto, unidades, unidadCents }) => (
          <div className="cartline" key={producto.id}>
            <div className="miniart product-thumb">
              {imagenDe(producto) ? (
                <img src={imagenDe(producto)!} alt={producto.name} loading="lazy" />
              ) : (
                <span className="missing-thumb">Sin imagen</span>
              )}
            </div>
            <div className="desc">
              <b>{producto.name}</b>
              <small>{formatearCents(unidadCents)}</small>
            </div>
            <div className="qty">
              <form action={ajustarCantidadAccion}>
                <input type="hidden" name="productId" value={producto.id} />
                <input type="hidden" name="delta" value="-1" />
                <button aria-label="Quitar una unidad" disabled={unidades <= 1}>
                  −
                </button>
              </form>
              <span>{unidades}</span>
              <form action={ajustarCantidadAccion}>
                <input type="hidden" name="productId" value={producto.id} />
                <input type="hidden" name="delta" value="1" />
                <button aria-label="Añadir una unidad" disabled={unidades >= producto.stock}>
                  ＋
                </button>
              </form>
            </div>
            <form action={quitarArticuloAccion}>
              <input type="hidden" name="productId" value={producto.id} />
              <button className="close" aria-label="Quitar del carrito">
                ✕
              </button>
            </form>
          </div>
        ))}
        <CarritoCheckoutForm
          lineas={lineasDecoradas.map((linea) => ({
            productId: linea.producto.id,
            nombre: linea.producto.name,
            unidades: linea.unidades,
            precioUnidadCents: linea.unidadCents,
          }))}
        />
        <form action={vaciarCarritoAccion}>
          <button className="outline">Vaciar carrito</button>
        </form>
      </div>
    </main>
  );
}
