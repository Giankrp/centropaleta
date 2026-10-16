import Link from "next/link";
import { leerSesion } from "../../../lib/sesion";
import { perfilDe, favoritosDe } from "../../../lib/usuarios";
import { ensureSchema, getPool } from "../../../lib/pg-store.js";
import { obtenerCatalogo } from "../../../lib/catalogo";
import { formatearCents } from "../../../lib/precios";
import { alternarFavoritoAccion, salirAccion } from "../acciones";
import { CuentaAcceso } from "./formularios";
import { EditorPerfil } from "./perfil";
import { notFound } from "next/navigation";

type PedidoFila = { code: string; status: string; channel: string; total_cents: number; created_at: string | Date };

type EncargoFila = { id: string; kind: string; product: string; status: string; created_at: string | Date; price_cents: number | null };

export default async function PaginaCuenta() {
  await ensureSchema();
  const sesion = await leerSesion();
  const cabecera = (
    <div className="page-heading">
      <div><span className="overline">MI CUENTA · CENTRO PALETA</span><h1 style={{ fontSize: 26 }}>{sesion?.role === "admin" ? "Panel privado" : sesion?.role === "cliente" ? "Bienvenido, " + (await nombreMostrado(sesion.u)) : "Mi cuenta"}</h1></div>
    </div>
  );

  if (!sesion) {
    return (
      <main className="account-wrap">
        {cabecera}
        <CuentaAcceso />
      </main>
    );
  }
  if (sesion.role === "admin") {
    return (
      <main className="account-wrap">
        {cabecera}
        <div className="account-card">
          <span className="overline">ADMINISTRACIÓN</span>
          <h2>{sesion.u}</h2>
          <p>Gestiona inventario, ventas y pedidos desde el panel privado.</p>
          <Link className="primary finish" href="/panel.html">Abrir panel privado</Link>
          <form action={salirAccion}><button className="outline" style={{ marginTop: 12 }}>Cerrar sesión</button></form>
        </div>
      </main>
    );
  }
  const perfil = await perfilDe(sesion.u);
  if (!perfil) notFound();
  const favoritos = await favoritosDe(sesion.u);
  const catalogo = await obtenerCatalogo();
  const { rows: pedidos } = (await getPool().query("SELECT code, status, channel, total_cents, created_at FROM orders WHERE customer=$1 ORDER BY id DESC LIMIT 20", [sesion.u])) as { rows: PedidoFila[] };
  const { rows: solicitudes } = (await getPool().query("SELECT id, kind, product, status, created_at, price_cents FROM encargos WHERE customer=$1 ORDER BY created_at DESC LIMIT 30", [sesion.u])) as { rows: EncargoFila[] };

  return (
    <main className="account-wrap">
      {cabecera}
      <div>
        <EditorPerfil perfil={perfil} />
        <section className="account-card">
          <span className="overline">MIS PEDIDOS</span>
          <h3>Pedidos registrados</h3>
          {pedidos.length ? pedidos.map((pedido) => (
            <article className="history-row" key={String(pedido.code)}>
              <header>
                <div>
                  <h3>{String(pedido.code)}</h3>
                  <small>{new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(pedido.created_at))}</small>
                </div>
                <strong>{formatearCents(Number(pedido.total_cents))}</strong>
              </header>
              <p><small>{pedido.channel === "Online" ? "Compra online" : "Tienda física"} · {pedido.status}</small></p>
              <Link className="outline" href={`/pedido/${pedido.code}`}>Ver detalle</Link>
            </article>
          )) : <p className="empty">Aún no tienes pedidos. Explora el catálogo y completa tu primera compra.</p>}
        </section>
        <section className="account-card">
          <span className="overline">MIS FAVORITOS</span>
          <h3>Guardados</h3>
          {favoritos.length ? favoritos.map((productId) => {
            const producto = catalogo.productos.find((p) => p.id === productId);
            return (
              <article className="history-row wishlist-row" key={productId}>
                <div><b>{producto ? producto.nombre : "Producto eliminado"}</b>{producto ? <small>{formatearCents(producto.precioUnidadCents)}</small> : null}</div>
                <form action={alternarFavoritoAccion}>
                  <input type="hidden" name="productId" value={productId} />
                  <button className="close" aria-label="Quitar de favoritos">✕</button>
                </form>
              </article>
            );
          }) : <p className="empty">Todavía no has guardado favoritos. Toca el corazón en cualquier producto.</p>}
        </section>
        <section className="account-card">
          <span className="overline">MIS SOLICITUDES</span>
          <h3>Encargos y propuestas</h3>
          {solicitudes.length ? solicitudes.map((solicitud) => (
            <article className="history-row" key={String(solicitud.id)}>
              <div>
                <b>{String(solicitud.id)} · {solicitud.product}</b>
                <small>{solicitud.kind === "venta" ? "Propuesta de venta" : "Encargo Japón"} · {solicitud.status}</small>
              </div>
              <span className="condition">{solicitud.status}</span>
            </article>
          )) : <p className="empty">Sin solicitudes todavía: envía una propuesta en «Vende tu producto» o encarga algo desde Japón.</p>}
        </section>
      </div>
      <form action={salirAccion}><button className="outline">Cerrar sesión</button></form>
    </main>
  );
}

async function nombreMostrado(username: string) {
  const perfil = await perfilDe(username);
  return perfil?.displayName || username;
}
