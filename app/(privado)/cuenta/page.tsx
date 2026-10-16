import Link from "next/link";
import { leerSesion } from "../../../lib/sesion-servidor.ts";
import { perfilDe, favoritosDe } from "../../../lib/usuarios.ts";
import { ensureSchema, getPool } from "../../../lib/inventario/bd.ts";
import { obtenerCatalogo } from "../../../lib/catalogo.ts";
import { formatearCents } from "../../../lib/precios.ts";
import { alternarFavoritoAccion, salirAccion } from "../../(tienda)/acciones";
import { CuentaAcceso } from "./formularios";
import { EditorPerfil, SelectorAvatar } from "./perfil";
import "./cuenta.css";
import type { ReactNode } from "react";

type PedidoFila = {
  code: string;
  status: string;
  channel: string;
  total_cents: number;
  created_at: string | Date;
};

type EncargoFila = {
  id: string;
  kind: string;
  product: string;
  status: string;
  created_at: string | Date;
  price_cents: number | null;
};

function CabeceraPrivada({ seccion, titulo }: { seccion: string; titulo: string }) {
  return (
    <header className="panel-top">
      <Link href="/" className="brand">
        <img src="/assets/logo.webp" alt="Centro Paleta" />
      </Link>
      <div>
        <span className="overline">{seccion}</span>
        <h1>{titulo}</h1>
      </div>
      <Link className="outline" href="/">
        Volver a la tienda
      </Link>
    </header>
  );
}

function Tarjeta({ children }: { children: ReactNode }) {
  return <section className="account-card">{children}</section>;
}

export default async function PaginaCuenta() {
  await ensureSchema();
  const sesion = await leerSesion();

  if (!sesion || sesion.role === "invitado") {
    return (
      <>
        <CabeceraPrivada seccion="CENTRO PALETA" titulo="Mi cuenta" />
        <div className="demo-banner">
          <strong>Acceso de la tienda</strong>
          <span>
            El administrador entra con su usuario. La cuenta de cliente es personal tuya al
            registrarte.
          </span>
        </div>
        <main className="account-wrap">
          <CuentaAcceso />
        </main>
      </>
    );
  }

  if (sesion.role === "admin") {
    return (
      <>
        <CabeceraPrivada seccion="CENTRO PALETA" titulo="Panel privado" />
        <main className="account-wrap">
          <div className="cuenta-layout">
            <Tarjeta>
              <span className="overline">ADMINISTRACIÓN</span>
              <h2>{sesion.u}</h2>
              <p>Gestiona inventario, ventas y pedidos desde el panel privado.</p>
              <div className="account-actions">
                <Link className="primary finish" href="/panel">
                  Abrir panel privado
                </Link>
                <form action={salirAccion}>
                  <button className="outline">Cerrar sesión</button>
                </form>
              </div>
            </Tarjeta>
          </div>
        </main>
      </>
    );
  }

  const perfil = await perfilDe(sesion.u);
  if (!perfil) {
    return (
      <>
        <CabeceraPrivada seccion="CENTRO PALETA" titulo="Mi cuenta" />
        <div className="demo-banner">
          <strong>Sesión no válida</strong>
          <span>Tu cuenta ya no existe en el servidor. Vuelve a entrar.</span>
        </div>
        <main className="account-wrap">
          <CuentaAcceso />
        </main>
      </>
    );
  }
  const favoritos = await favoritosDe(sesion.u);
  const catalogo = await obtenerCatalogo();
  const { rows: pedidos } = (await getPool().query(
    "SELECT code, status, channel, total_cents, created_at FROM orders WHERE customer=$1 ORDER BY id DESC LIMIT 20",
    [sesion.u],
  )) as { rows: PedidoFila[] };
  const { rows: solicitudes } = (await getPool().query(
    "SELECT id, kind, product, status, created_at, price_cents FROM encargos WHERE customer=$1 ORDER BY created_at DESC LIMIT 30",
    [sesion.u],
  )) as { rows: EncargoFila[] };

  const nombreMostrado = perfil.displayName || perfil.username;

  return (
    <>
      <CabeceraPrivada seccion="CENTRO PALETA" titulo={"Hola, " + nombreMostrado} />
      <div className="cuenta-layout">
        <aside className="cuenta-identidad" aria-label="Tu identidad">
          <SelectorAvatar perfil={perfil} />
          <p className="cuenta-nombre">{nombreMostrado}</p>
          <p className="cuenta-usuario">@{perfil.username}</p>
          <div className="cuenta-stats">
            <div>
              <b>{pedidos.length}</b>
              <small>Pedidos</small>
            </div>
            <div>
              <b>{favoritos.length}</b>
              <small>Favoritos</small>
            </div>
            <div>
              <b>{solicitudes.length}</b>
              <small>Solicitudes</small>
            </div>
          </div>
          <form action={salirAccion} style={{ width: "100%" }}>
            <button className="outline" style={{ width: "100%" }}>
              Cerrar sesión
            </button>
          </form>
        </aside>
        <div className="cuenta-secciones">
          <EditorPerfil perfil={perfil} />
          <Tarjeta>
            <span className="overline">MIS PEDIDOS</span>
            <h3>Pedidos registrados</h3>
            {pedidos.length ? (
              pedidos.map((pedido) => (
                <article className="history-row" key={pedido.code}>
                  <header>
                    <div>
                      <h3>{pedido.code}</h3>
                      <small>
                        {new Intl.DateTimeFormat("es-ES", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "Europe/Madrid",
                        }).format(new Date(pedido.created_at))}
                      </small>
                    </div>
                    <strong>{formatearCents(Number(pedido.total_cents))}</strong>
                  </header>
                  <p>
                    <small>
                      {pedido.channel === "Online" ? "Compra online" : "Tienda física"} ·{" "}
                      {pedido.status}
                    </small>
                  </p>
                  <div className="order-row-actions">
                    <Link className="outline" href={`/pedido/${pedido.code}`}>
                      Ver detalle
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty">
                Aún no tienes pedidos. Explora el catálogo y completa tu primera compra.
              </p>
            )}
          </Tarjeta>
          <Tarjeta>
            <span className="overline">MIS FAVORITOS</span>
            <h3>Guardados</h3>
            {favoritos.length ? (
              favoritos.map((productId) => {
                const producto = catalogo.productos.find((p) => p.id === productId);
                return (
                  <article className="history-row wishlist-row" key={productId}>
                    <div>
                      <b>{producto ? producto.nombre : "Producto eliminado"}</b>
                      {producto ? (
                        <small>{formatearCents(producto.precioUnidadCents)}</small>
                      ) : null}
                    </div>
                    <form action={alternarFavoritoAccion}>
                      <input type="hidden" name="productId" value={productId} />
                      <button className="close" aria-label="Quitar de favoritos">
                        ✕
                      </button>
                    </form>
                  </article>
                );
              })
            ) : (
              <p className="empty">
                Todavía no has guardado favoritos. Toca el corazón en cualquier producto.
              </p>
            )}
          </Tarjeta>
          <Tarjeta>
            <span className="overline">MIS SOLICITUDES</span>
            <h3>Encargos y propuestas</h3>
            {solicitudes.length ? (
              solicitudes.map((solicitud) => (
                <article className="history-row" key={solicitud.id}>
                  <div>
                    <b>
                      {solicitud.id} · {solicitud.product}
                    </b>
                    <small>
                      {solicitud.kind === "venta" ? "Propuesta de venta" : "Encargo Japón"}
                    </small>
                  </div>
                  <span className="wishlist-state">{solicitud.status}</span>
                </article>
              ))
            ) : (
              <p className="empty">
                Sin solicitudes todavía: envía una propuesta en «Vende tu producto» o encarga algo
                desde Japón.
              </p>
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
