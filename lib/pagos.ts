import { getPool } from "./inventario/bd.ts";

export async function procesarPago(token: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    "UPDATE orders SET status='Pagado', payment='Simulado', updated_at=now() WHERE token=$1 AND status='Pendiente de pago'",
    [token],
  );
  return rowCount === 1;
}

type Pedido = {
  code: string;
  status: string;
  channel: string;
  payment: string;
  delivery: string;
  address: string | null;
  lines: unknown;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  created_at: string | Date;
};

export async function consultarPedido(code: string): Promise<Pedido | null> {
  const { rows } = await getPool().query(
    "SELECT code, status, channel, payment, delivery, address, lines, subtotal_cents, shipping_cents, total_cents, created_at FROM orders WHERE code=$1",
    [code],
  );
  return rows.length ? (rows[0] as Pedido) : null;
}
