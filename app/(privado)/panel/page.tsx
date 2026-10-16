import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureSchema, getPool } from "../../../lib/inventario/bd.ts";
import { loadInventory } from "../../../lib/inventario/servicio.ts";
import { descuentoPercent, formatearCents, precioUnidadCents } from "../../../lib/precios.ts";
import { leerSesion } from "../../../lib/sesion-servidor.ts";
import { PosSkus, type Sku } from "./pos";
import { InventarioCliente, type ProductoAdmin } from "./inventario";
import { estadoEncargoFormAccion, estadoPedidoFormAccion, oferecerFormAccion, reponerFormAccion } from "./acciones";

type ProductoRaw = {
  id: number;
  name: string;
  cat: string;
  type: string;
  set: string;
  code: string;
  description: string;
  condition: string;
  badge?: string | null;
  price: number;
  stock: number;
  min: number;
  target: number;
  barcodes?: string[];
  offerActive?: boolean | null;
  offerPercent?: number | null;
  image?: string | null;
  photo?: string | null;
  _version?: number;
};

type EstadoInventario = { state: { products: ProductoRaw[]; sales: VentaRegistrada[]; moves: Movimiento[] } };
type VentaRegistrada = { id: string; date: string; channel: string; payment: string; total: number; lines: { id?: number; name: string; qty: number; cents: number }[]; change: number | null };
type Movimiento = { date: string; name: string; qty: number; kind: string };

const TABS: { id: string; texto: string; titulo: string; subtitulo: string }[] = [
  { id: "venta", texto: "Venta física", titulo: "Venta física", subtitulo: "Busca, suma al ticket y registra el cobro." },
  { id: "inventario", texto: "Inventario", titulo: "Inventario", subtitulo: "Recepción, fichas, códigos y borrados seguros." },
  { id: "reposicion", texto: "Reponer", titulo: "Reposiciones pendientes", subtitulo: "Actividad por debajo del mínimo." },
  { id: "ofertas", texto: "Ofertas Paleta", titulo: "Ofertas Paleta", subtitulo: "Los descuentos se reflejan en la tienda al instante." },
  { id: "encargos", texto: "Encargos", titulo: "Encargos y propuestas", subtitulo: "Solicitudes guardadas en el servidor." },
  { id: "pedidos", texto: "Pedidos y envíos", titulo: "Pedidos online", subtitulo: "Pedidos registrados por la tienda." },
  { id: "historial", texto: "Historial", titulo: "Historial", subtitulo: "Ventas y movimientos del inventario." },
];

function imagenDe(producto: ProductoRaw) {
  if (producto.photo) return `/api/photo/${producto.id}`;
  if (producto.image) return `/assets/${producto.image}.webp`;
  return null;
}

type EncargoFila = { id: string; kind: string; product: string; universe: string | null; quantity: number; budget_cents: number | null; price_cents: number | null; url: string | null; notes: string | null; customer: string | null; email: string | null; phone: string | null; status: string; admin_notes: string | null; created_at: string | Date; photos: string[] | null; customer_profile: { name?: string } | null };
type PedidoFila = { code: string; status: string; delivery: string; address: string | null; customer: string | null; lines: { productId: number; nombre: string; unidades: number; precioUnidadCents: number }[]; subtotal_cents: number; shipping_cents: number; total_cents: number; created_at: string | Date };

export default async function PaginaPanel({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sesion = await leerSesion();
  if (sesion?.role !== "admin") redirect("/cuenta");
  const { tab } = await searchParams;
  const activo = TABS.some((t) => t.id === tab) ? (tab as string) : "venta";
  await ensureSchema();
  const estado = await loadInventory();
  const productos = estado.state.products;
  const admin = productoElAdmin(productos);
  const skus = admin.map(adminASku);
  const reposicion = productos.filter((p) => p.stock <= p.min && p.stock < p.target);
  const ofertasActivas = productos.filter((p) => descuentoPercent(p) > 0);
  const encargos = (await getPool().query("SELECT * FROM encargos ORDER BY (status='Pendiente') DESC, created_at DESC LIMIT 60")).rows as unknown as EncargoFila[];
  const pedidos = (await getPool().query("SELECT code, status, delivery, address, customer, lines, subtotal_cents, shipping_cents, total_cents, created_at FROM orders WHERE channel='Online' ORDER BY id DESC LIMIT 40")).rows as unknown as PedidoFila[];
  const zona = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" });
  const hoy = zona.format(new Date());
  const ventasHoy = estado.state.sales.filter((venta) => zona.format(new Date(venta.date)) === hoy);
  const totalHoy = ventasHoy.reduce((suma, venta) => suma + venta.total, 0);
  const unidadesHoy = ventasHoy.reduce((suma, venta) => suma + venta.lines.reduce((n, line) => n + line.qty, 0), 0);
  const registros = [
    ...estado.state.sales.map((venta) => ({ kind: "Venta" as const, venta })),
    ...estado.state.moves.map((mov) => ({ kind: "Movimiento" as const, mov })),
  ].sort((a, b) => (a.kind === "Venta" ? a.venta.date : a.mov.date).localeCompare(b.kind === "Venta" ? b.venta.date : b.mov.date) * -1).slice(0, 40);

  const conteoTab: Record<string, number> = { reposicion: reposicion.length, encargos: encargos.filter((s) => s.status === "Pendiente").length };

  return (
    <>
      <header className="panel-top">
        <Link href="/" className="brand"><img src="/assets/logo.webp" alt="Centro Paleta" /></Link>
        <div><span className="overline">GESTIÓN DE TIENDA</span><h1>Panel privado</h1></div>
        <Link className="outline" href="/" aria-label="Ir al inicio">Ir al inicio</Link>
        <form action={salirPanelAccion}><button className="outline">Cerrar sesión</button></form>
      </header>
      <div className="demo-banner"><strong>Panel del servidor</strong><span>Toda la info viene de PostgreSQL; mutaciones con control de concurrencia. Pagos online: simulados.</span></div>
      <div className="panel-layout">
        <aside>
          <nav aria-label="Gestión">
            <Link className="panel-home-link" href="/">⌂ Inicio de la web</Link>
            {TABS.map((t) => (
              <Link key={t.id} href={`/panel?tab=${t.id}`} className={t.id === activo ? "active" : ""} aria-current={t.id === activo ? "page" : undefined}>
                {t.texto}
                {conteoTab[t.id] ? <span>{conteoTab[t.id]}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">Un inventario compartido para las ventas de tienda y las compras online.</div>
        </aside>
        <main>
          {TABS.filter((t) => t.id === activo).map((t) => (
            <section key={t.id}>
              <div className="page-heading">
                <div><span className="overline">GESTIÓN</span><h2>{t.titulo}</h2><p>{t.subtitulo}</p></div>
              </div>
              {t.id === "venta" ? <PosSkus skus={skus} /> : null}
              {t.id === "inventario" ? <InventarioCliente productos={admin} /> : null}
              {t.id === "reposicion" ? (
                reposicion.length ? reposicion.map((producto) => (
                  <div className="restock-row" key={producto.id}>
                    <div>
                      <h3>{producto.name}</h3>
                      <p>Quedan {producto.stock} · mínimo {producto.min} · objetivo {producto.target}</p>
                      <strong>Faltan {producto.target - producto.stock} unidades</strong>
                    </div>
                    <form className="restock-controls" action={reponerFormAccion}>
                      <input type="hidden" name="productId" value={producto.id} />
                      <div>
                        <label htmlFor={"rep-" + producto.id}>Unidades recibidas</label>
                        <input id={"rep-" + producto.id} name="qty" type="number" min={1} step={1} defaultValue={producto.target - producto.stock} required />
                      </div>
                      <button className="primary">Añadir al stock</button>
                    </form>
                  </div>
                )) : <p className="empty">Todo al día. Ningún producto necesita reposición.</p>
              ) : null}
              {t.id === "ofertas" ? (
                ofertasActivas.length || productos.length ? (
                  <div>
                    <div className="section-label"><span>{ofertasActivas.length} ofertas activas</span></div>
                    {productos.map((producto) => (
                      <article className="inventory-row offer-row" key={producto.id}>
                        <header>
                          <Miniatura producto={producto} />
                          <div className="inventory-title">
                            <h3>{producto.name}</h3>
                            <small>{producto.cat} · {producto.code}</small>
                          </div>
                          <span className={ofertaClase(producto)}>{descuentoPercent(producto) > 0 ? "En el carrusel" : "Fuera del carrusel"}</span>
                        </header>
                        <form className="offer-form" action={oferecerFormAccion}>
                          <input type="hidden" name="productId" value={producto.id} />
                          <div>
                            <label htmlFor={"desc-" + producto.id}>Descuento (%)</label>
                            <input id={"desc-" + producto.id} name="percent" type="number" min={1} max={99} step={1} defaultValue={producto.offerPercent ?? 10} required />
                          </div>
                          <div className="offer-price-preview">
                            <span>Precio habitual <b>{formatearCents(Math.round(producto.price * 100))}</b></span>
                            <strong>{formatearCents(precioUnidadCents(producto))}</strong>
                            <small>Precio con descuento</small>
                          </div>
                          <div className="offer-actions">
                            <button className="primary" type="submit">{descuentoPercent(producto) > 0 ? "Actualizar descuento" : "Añadir al carrusel"}</button>
                            <button className="outline offer-remove" type="submit" name="quitar" value="1" disabled={descuentoPercent(producto) === 0}>Quitar del carrusel</button>
                          </div>
                        </form>
                      </article>
                    ))}
                  </div>
                ) : <p className="empty">Añade productos para crear ofertas.</p>
              ) : null}
              {t.id === "encargos" ? (
                encargos.length ? encargos.map((solicitud) => (
                  <article className="inventory-row" key={solicitud.id}>
                    <header>
                      <div>
                        <span className="overline">{solicitud.id}</span>
                        <h3>{solicitud.product}</h3>
                        <small>{new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(solicitud.created_at))} · {solicitud.universe ?? "—"} · {solicitud.quantity} uds. · {solicitud.kind === "venta" ? "Propuesta de venta" : "Encargo Japón"}</small>
                      </div>
                      <span className={solicitud.status === "Pendiente" ? "offer-status enabled" : "offer-status"}>{solicitud.status}</span>
                    </header>
                    <div className="inventory-fields">
                      <div>
                        <h4>Cliente</h4>
                        <p><strong>{solicitud.customer_profile?.name || "Sin nombre"}</strong><br />{solicitud.email || "—"}{solicitud.phone ? " · " + solicitud.phone : ""}</p>
                      </div>
                      <div>
                        <h4>{solicitud.kind === "venta" ? "Precio propuesto" : "Presupuesto orientativo"}</h4>
                        <p>{formatearCents((solicitud.kind === "venta" ? solicitud.price_cents : solicitud.budget_cents) ?? NaN)}</p>
                        {solicitud.url ? <Link className="outline" href={solicitud.url} target="_blank" rel="noopener noreferrer">Abrir referencia</Link> : null}
                      </div>
                      <div>
                        <h4>Detalles</h4>
                        <p>{solicitud.notes || "—"}</p>
                        {solicitud.photos && solicitud.photos.length ? <p className="micro">{solicitud.photos.length} fotografía(s) adjunta(s)</p> : null}
                      </div>
                    </div>
                    <form action={estadoEncargoFormAccion}>
                      <input type="hidden" name="id" value={solicitud.id} />
                      <div className="inventory-fields">
                        <div>
                          <label htmlFor={"est-" + solicitud.id}>Estado</label>
                          <select id={"est-" + solicitud.id} name="status" defaultValue={solicitud.status}>
                            {["Pendiente", "En revisión", "Contactado", "Completado", "Cancelado"].map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div style={{ gridColumn: "span 3" }}>
                          <label htmlFor={"notas-" + solicitud.id}>Notas internas</label>
                          <input id={"notas-" + solicitud.id} name="notes" defaultValue={solicitud.admin_notes ?? ""} maxLength={3000} />
                        </div>
                      </div>
                      <button className="primary">Guardar</button>
                    </form>
                  </article>
                )) : <p className="empty">Sin encargos todavía.</p>
              ) : null}
              {t.id === "pedidos" ? (
                pedidos.length ? pedidos.map((pedido) => (
                  <article className="inventory-row" key={pedido.code}>
                    <header>
                      <div>
                        <span className="overline">{pedido.code}</span>
                        <h3>{formatearCents(Number(pedido.total_cents))}</h3>
                        <small>{new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(pedido.created_at))} · {pedido.customer || "Invitado"} · {pedido.delivery === "pickup" ? "Recogida" : "Envío"}{pedido.address ? " · " + pedido.address : ""}</small>
                      </div>
                      <span className={pedido.status === "Entregado" ? "offer-status enabled" : "offer-status"}>{pedido.status}</span>
                    </header>
                    <ul className="sale-summary-lines">
                      {pedido.lines.map((linea, indice) => <li key={indice}>{linea.unidades} × {linea.nombre} — {formatearCents(linea.precioUnidadCents * linea.unidades)}</li>)}
                    </ul>
                    <form action={estadoPedidoFormAccion} className="inventory-fields">
                      <input type="hidden" name="code" value={pedido.code} />
                      <div>
                        <label htmlFor={"ped-" + pedido.code}>Estado del pedido</label>
                        <select id={"ped-" + pedido.code} name="status" defaultValue={pedido.status}>
                          {["Pendiente de pago", "Pagado", "Preparado", "Enviado", "Entregado", "Recogido"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <button className="primary">Actualizar estado</button>
                    </form>
                  </article>
                )) : <p className="empty">Sin pedidos online todavía.</p>
              ) : null}
              {t.id === "historial" ? (
                <>
                  <div className="stats">
                    <div><span>Ventas hoy</span><b>{ventasHoy.length}</b></div>
                    <div><span>Total hoy</span><b>{formatearCents(totalHoy)}</b></div>
                    <div><span>Unidades vendidas hoy</span><b>{unidadesHoy}</b></div>
                  </div>
                  {registros.length ? registros.map((registro, indice) => registro.kind === "Venta" ? (
                    <article className="history-row" key={"v" + indice}>
                      <header>
                        <div><h3>{registro.venta.id} · {registro.venta.channel}</h3><small>{formatearFecha(registro.venta.date)} · {registro.venta.payment}</small></div>
                        <strong>{formatearCents(registro.venta.total)}</strong>
                      </header>
                      <ul>{registro.venta.lines.map((linea, li) => <li key={li}>{linea.qty} × {linea.name} — {formatearCents(linea.cents * linea.qty)}</li>)}</ul>
                      {registro.venta.change !== null ? <small>Entregado: {formatearCents(registro.venta.total + registro.venta.change)} · cambio: {formatearCents(registro.venta.change)}</small> : null}
                    </article>
                  ) : (
                    <article className="history-row" key={"m" + indice}>
                      <header>
                        <div><h3>{registro.mov.kind} · {registro.mov.name}</h3><small>{formatearFecha(registro.mov.date)}</small></div>
                        <strong>{registro.mov.qty > 0 ? "+" : ""}{registro.mov.qty} uds.</strong>
                      </header>
                    </article>
                  )) : <p className="empty">Todavía no hay ventas ni movimientos.</p>}
                </>
              ) : null}
            </section>
          ))}
        </main>
      </div>
    </>
  );
}

function Miniatura({ producto }: { producto: ProductoRaw }) {
  const url = imagenDe(producto);
  return url ? <img src={url} alt="" /> : <span className="inventory-placeholder">📦</span>;
}

function ofertaClase(producto: ProductoRaw) {
  return descuentoPercent(producto) > 0 ? "offer-status enabled" : "offer-status";
}

function formatearFecha(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(iso));
}

function productoElAdmin(productos: ProductoRaw[]): ProductoAdmin[] {
  return productos.map((producto) => ({
    id: producto.id,
    nombre: producto.name,
    categoria: producto.cat,
    tipo: producto.type,
    set: producto.set,
    codigo: producto.code,
    descripcion: producto.description,
    estado: producto.condition,
    emblema: producto.badge ?? null,
    precioBaseCents: Math.round(producto.price * 100),
    precioUnidadCents: precioUnidadCents(producto),
    descuento: descuentoPercent(producto),
    stock: producto.stock,
    min: producto.min,
    target: producto.target,
    barcodes: producto.barcodes ?? [],
    version: producto._version ?? 0,
    imagenUrl: imagenDe(producto),
    photoActual: !!producto.photo,
  }));
}

function adminASku(producto: ProductoAdmin): Sku {
  return {
    id: producto.id,
    nombre: producto.nombre,
    categoria: producto.categoria,
    set: producto.set,
    codigo: producto.codigo,
    unidadCents: producto.precioUnidadCents,
    precioCents: producto.precioBaseCents,
    stock: producto.stock,
    imagenUrl: producto.imagenUrl,
  };
}

async function salirPanelAccion() {
  "use server";
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  const store = await cookies();
  store.delete("cp_session");
  redirect("/cuenta");
}
