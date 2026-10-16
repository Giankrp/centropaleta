import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureSchema, getPool } from "../../../../lib/inventario/bd.ts";
import { formatearCents } from "../../../../lib/precios.ts";

type LineaPedido = {
  productId: number;
  nombre: string;
  unidades: number;
  precioUnidadCents: number;
};
type Pedido = {
  code: string;
  status: string;
  channel: string;
  payment: string;
  delivery: string;
  address: string | null;
  lines: LineaPedido[];
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  created_at: string | Date;
};

export default async function PaginaPedido({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[\w-]{3,80}$/.test(code)) notFound();
  await ensureSchema();
  const { rows } = await getPool().query(
    "SELECT code, status, channel, payment, delivery, address, lines, subtotal_cents, shipping_cents, total_cents, created_at FROM orders WHERE code=$1",
    [code],
  );
  if (!rows.length) notFound();
  const pedido = rows[0] as Pedido;
  const entregaLabel =
    pedido.delivery === "pickup" ? "Recogida en tienda · Gratis" : "Envío a domicilio";

  return (
    <main className="wrap" style={{ paddingBottom: 70 }}>
      <nav className="catalog-breadcrumb" aria-label="Ruta">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>Pedido {pedido.code}</span>
      </nav>
      <div className="order-success">
        <div className="order-success-content">
          <span className="success-seal" aria-hidden="true">
            ✓
          </span>
          <span className="success-eyebrow">BIENVENIDO A BORDO</span>
          <h3>¡Gracias por confiar en Centro Paleta!</h3>
          <p>
            Tu pedido ha quedado registrado en el servidor de la maqueta.
            <br />
            La aventura de tu colección continúa.
          </p>
          <div className="order-reference">
            <span>Referencia del pedido</span>
            <strong>{pedido.code}</strong>
          </div>
          <p>
            {entregaLabel} · {pedido.shipping_cents ? "4,99 €" : "Gratis"}
            <br />
            Total: <strong>{formatearCents(Number(pedido.total_cents))}</strong>
          </p>
          <p className="success-demo">
            Pago {pedido.payment} · Estado: {pedido.status}
          </p>
          {pedido.address ? (
            <p style={{ color: "var(--muted)", fontSize: 12 }}>Envío a: {pedido.address}</p>
          ) : null}
          <ul style={{ textAlign: "left", margin: "14px auto", maxWidth: 320 }}>
            {pedido.lines.map((linea) => (
              <li key={linea.productId}>
                {linea.unidades} × {linea.nombre} —{" "}
                {formatearCents(linea.precioUnidadCents * linea.unidades)}
              </li>
            ))}
          </ul>
          <div className="success-actions">
            <Link className="btn" href="/">
              Seguir explorando
            </Link>
            <Link className="btn ghost" href="/cuenta">
              Mi cuenta
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
