import { getPool } from "./bd.ts";
import { ensureSchema } from "./bd.ts";
import type { PoolClient } from "pg";
import { descuento, estiloVenta, ventaEsquema, datosZod } from "./dominio.ts";
type SolicitudMutacion = { operation: string; args: unknown[]; requestId: string; productVersion?: number };

export type VentaInventario = {
  id: string;
  token: string;
  date: string;
  channel: string;
  payment: string;
  customerId: string | null;
  customerProfile: unknown;
  lines: LineaVenta[];
  subtotal: number;
  shippingCents: number;
  deliveryMethod: string | null;
  total: number;
  received: number | null;
  change: number | null;
};

export type LineaVenta = { id: number; name: string; qty: number; cents: number };

async function siguienteCodigo(client: PoolClient): Promise<string> {
  const dato = await client.query("SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 4) AS integer)), 0) + 1 AS siguiente FROM sales");
  return estiloVenta(Number((dato.rows[0] as { siguiente: number }).siguiente));
}

export async function vender(solicitud: SolicitudMutacion): Promise<unknown | null> {
  const datos = ventaEsquema.safeParse({
    ticket: (solicitud.args[0] ?? {}) as unknown,
    channel: solicitud.args[1],
    payment: solicitud.args[2],
    received: typeof solicitud.args[3] === "number" ? solicitud.args[3] : null,
    token: solicitud.args[4],
    customerId: (solicitud.args[5] ?? null) as unknown,
    customerProfile: (solicitud.args[6] ?? null) as unknown,
    delivery: (solicitud.args[7] ?? null) as unknown,
  });
  if (!datos.success) throw new Error(datosZod(datos.error));
  const pedido = datos.data;
  if (!["Tienda física", "Online"].includes(pedido.channel)) throw new Error("La compra online sigue siendo de demostración y no registra pedidos en el inventario compartido");
  if (pedido.channel === "Online" && !pedido.delivery) throw new Error("Selecciona envío o recogida en tienda");
  await ensureSchema();
  const previa = await getPool().query("SELECT id, code, token, channel, payment, customer_id, customer_profile, delivery, subtotal_cents, shipping_cents, total_cents, received_cents, change_cents, created_at FROM sales WHERE token=$1", [pedido.token]);
  if (previa.rows.length) {
    const fila = previa.rows[0] as { id: number; code: string; token: string; channel: string; payment: string; customer_id: string | null; customer_profile: unknown; delivery: string | null; subtotal_cents: number; shipping_cents: number; total_cents: number; received_cents: number | null; change_cents: number | null; created_at: string };
    const lineasPrevias = await getPool().query("SELECT product_id, product_name, qty, unit_cents FROM sales_lines WHERE sale_id=$1", [fila.id]);
    return {
      id: fila.code,
      token: fila.token,
      date: new Date(fila.created_at).toISOString(),
      channel: fila.channel,
      payment: fila.payment,
      customerId: fila.customer_id,
      customerProfile: fila.customer_profile,
      lines: (lineasPrevias.rows as { product_id: number | null; product_name: string; qty: number; unit_cents: number }[]).map((linea) => ({ id: linea.product_id ?? 0, name: linea.product_name, qty: linea.qty, cents: linea.unit_cents })),
      subtotal: fila.subtotal_cents,
      shippingCents: fila.shipping_cents,
      deliveryMethod: fila.delivery,
      total: fila.total_cents,
      received: fila.received_cents,
      change: fila.change_cents,
    };
  }
  const client: PoolClient = await getPool().connect();
  try {
    for (let intento = 0; intento < 5; intento++) {
      await client.query("BEGIN");
      let resultado: VentaInventario | null;
      try {
        const productosSolicitados = Object.entries(pedido.ticket).map(([idStr]) => Number(idStr));
        await client.query("SELECT id, stock, name FROM productos WHERE id = ANY($1) ORDER BY id FOR UPDATE", [productosSolicitados]);
        const lineas: LineaVenta[] = [];
        let subtotal = 0;
        for (const [idStr, qty] of Object.entries(pedido.ticket)) {
          const linea = { id: Number(idStr), qty };
          const captura = await client.query("SELECT id, name, stock, price_cents, offer_active, offer_percent FROM productos WHERE id=$1", [linea.id]);
          if (!captura.rows.length) throw new Error("El producto ya no está disponible");
          const fila = captura.rows[0] as { id: number; name: string; stock: number; price_cents: number; offer_active: boolean; offer_percent: number | null };
          if (fila.stock < linea.qty) throw new Error("Stock insuficiente: " + fila.name);
          const unidad = Math.max(1, Math.round((fila.price_cents * (100 - descuento({ price: fila.price_cents / 100, offerActive: fila.offer_active, offerPercent: fila.offer_percent }))) / 100));
          subtotal += unidad * linea.qty;
          lineas.push({ id: fila.id, name: fila.name, qty: linea.qty, cents: unidad });
        }
        const envio = pedido.channel === "Tienda física" || pedido.delivery === "pickup" ? 0 : 499;
        const total = subtotal + envio;
        if (pedido.payment === "Efectivo" && (pedido.received == null || pedido.received < total)) throw new Error("El efectivo entregado no cubre el total");
        for (const linea of lineas) {
          await client.query("UPDATE productos SET stock=stock-$2 WHERE id=$1 AND stock>=$2", [linea.id, linea.qty]);
        }
        const code = await siguienteCodigo(client);
        const insertada = await client.query(
          "INSERT INTO sales(code, token, channel, payment, customer_id, customer_profile, delivery, subtotal_cents, shipping_cents, total_cents, received_cents, change_cents) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id",
          [
            code,
            pedido.token,
            pedido.channel,
            pedido.payment,
            pedido.customerId ?? null,
            pedido.customerProfile == null ? null : JSON.stringify(pedido.customerProfile),
            pedido.channel === "Tienda física" ? null : pedido.delivery,
            subtotal,
            envio,
            total,
            pedido.payment === "Efectivo" ? pedido.received ?? null : null,
            pedido.payment === "Efectivo" ? (pedido.received ?? 0) - total : null,
          ],
        );
        const saleId = Number((insertada.rows[0] as { id: string | number }).id);
        for (const linea of lineas) {
          await client.query("INSERT INTO sales_lines(sale_id, product_id, product_name, qty, unit_cents) VALUES($1,$2,$3,$4,$5)", [saleId, linea.id, linea.name, linea.qty, linea.cents]);
        }
        resultado = {
          id: code,
          token: pedido.token,
          date: new Date().toISOString(),
          channel: pedido.channel,
          payment: pedido.payment,
          customerId: pedido.customerId ?? null,
          customerProfile: pedido.customerProfile ?? null,
          lines: lineas,
          subtotal,
          shippingCents: envio,
          deliveryMethod: pedido.channel === "Tienda física" ? null : (pedido.delivery ?? null),
          total,
          received: pedido.payment === "Efectivo" ? pedido.received ?? null : null,
          change: pedido.payment === "Efectivo" ? (pedido.received ?? 0) - total : null,
        };
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        if ((error as { code?: string }).code === "23505") {
          resultado = null;
        } else {
          throw error;
        }
      }
      if (resultado) return resultado;
    }
    throw new Error("Otro dispositivo está actualizando el inventario. Inténtalo de nuevo.");
  } finally {
    client.release();
  }
}
