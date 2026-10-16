import { getPool, ensureSchema } from "./inventario/bd.ts";
import { loadInventory, mutateInventory } from "./inventario/servicio.ts";
import { precioUnidadCents, PRECIO_ENVIO_CENTS } from "./precios.ts";
import { procesarPago } from "./pagos.ts";

export type LineaArticulo = { productId: number; qty: number };

export type LineaPedido = {
  productId: number;
  nombre: string;
  unidades: number;
  precioUnidadCents: number;
};

export type DatosEntrega = {
  delivery: "pickup" | "shipping";
  address: string | null;
  customer?: string | null;
};

export type ResultadoCompra = { code: string; totalCents: number; repetido: boolean };

type ProductoInventario = {
  id: number;
  name: string;
  stock: number;
  price: number;
  offerActive?: boolean | null;
  offerPercent?: number | null;
};

export async function contarCarrito(session: string): Promise<number> {
  const { rows } = await getPool().query(
    "SELECT COALESCE(SUM(qty),0) AS total FROM cart_items WHERE cart=$1",
    [session],
  );
  return Number((rows[0] as { total: string | number }).total);
}

export async function articulosCarrito(session: string): Promise<LineaArticulo[]> {
  const { rows } = await getPool().query(
    "SELECT product_id, qty FROM cart_items WHERE cart=$1 ORDER BY product_id",
    [session],
  );
  return (rows as unknown as { product_id: number; qty: number }[]).map((row) => ({
    productId: Number(row.product_id),
    qty: Number(row.qty),
  }));
}

async function asegurarCarrito(session: string) {
  await getPool().query(
    "INSERT INTO carts(session, owner) VALUES($1, $2) ON CONFLICT (session) DO UPDATE SET updated_at = now()",
    [session, null],
  );
}

function productoEn(catalogo: { productos: ProductoInventario[] }, productId: number) {
  return catalogo.productos.find((producto) => producto.id === productId) ?? null;
}

export async function agregarArticulo(
  session: string,
  catalogo: { productos: ProductoInventario[] },
  productId: number,
  qty: number,
) {
  if (!Number.isSafeInteger(qty) || qty < 1) throw new Error("Cantidad inválida");
  const producto = productoEn(catalogo, productId);
  if (!producto) throw new Error("El producto ya no está disponible");
  if (producto.stock < 1) throw new Error("Agotado");
  await asegurarCarrito(session);
  const { rows } = await getPool().query(
    "SELECT qty FROM cart_items WHERE cart=$1 AND product_id=$2",
    [session, productId],
  );
  const actual = rows.length ? Number((rows[0] as { qty: number }).qty) : 0;
  const objetivo = Math.min(actual + qty, producto.stock);
  await getPool().query(
    "INSERT INTO cart_items(cart, product_id, qty) VALUES($1,$2,$3) ON CONFLICT (cart, product_id) DO UPDATE SET qty=$3",
    [session, productId, objetivo],
  );
}

export async function ajustarCantidad(
  session: string,
  catalogo: { productos: ProductoInventario[] },
  productId: number,
  qty: number,
) {
  if (!Number.isSafeInteger(qty) || qty < 0) throw new Error("Cantidad inválida");
  if (qty === 0) return quitarArticulo(session, productId);
  const producto = productoEn(catalogo, productId);
  if (!producto) throw new Error("El producto ya no está disponible");
  if (qty > producto.stock) throw new Error("Stock insuficiente: " + producto.name);
  await asegurarCarrito(session);
  await getPool().query(
    "INSERT INTO cart_items(cart, product_id, qty) VALUES($1,$2,$3) ON CONFLICT (cart, product_id) DO UPDATE SET qty=$3",
    [session, productId, qty],
  );
}

export async function quitarArticulo(session: string, productId: number) {
  await getPool().query("DELETE FROM cart_items WHERE cart=$1 AND product_id=$2", [
    session,
    productId,
  ]);
}

export async function vaciarCarrito(session: string) {
  await getPool().query("DELETE FROM cart_items WHERE cart=$1", [session]);
}

export async function finalizarCarrito(
  session: string,
  datos: DatosEntrega,
  token: string,
): Promise<ResultadoCompra> {
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(token)) throw new Error("Referencia de compra inválida");
  if (datos.delivery === "shipping" && (!datos.address || !datos.address.trim()))
    throw new Error("Indica la dirección de envío");
  await ensureSchema();
  const existente = await getPool().query("SELECT code, total_cents FROM orders WHERE token=$1", [
    token,
  ]);
  if (existente.rows.length) {
    const fila = existente.rows[0] as { code: string; total_cents: number };
    return { code: fila.code, totalCents: Number(fila.total_cents), repetido: true };
  }
  const items = await articulosCarrito(session);
  if (!items.length) throw new Error("Tu carrito está vacío");
  const estado = await loadInventory();
  const lineas: LineaPedido[] = [];
  let subtotal = 0;
  for (const item of items) {
    const producto = estado.state.products.find((p) => p.id === item.productId);
    if (!producto) throw new Error("El producto ya no está disponible");
    if (producto.stock < item.qty) throw new Error("Stock insuficiente: " + producto.name);
    const unidad = precioUnidadCents(producto);
    subtotal += unidad * item.qty;
    lineas.push({
      productId: producto.id,
      nombre: producto.name,
      unidades: item.qty,
      precioUnidadCents: unidad,
    });
  }
  const envio = datos.delivery === "shipping" ? PRECIO_ENVIO_CENTS : 0;
  const total = subtotal + envio;
  const ticket: Record<string, number> = Object.fromEntries(
    items.map((item) => [String(item.productId), item.qty]),
  );
  const argsVenta = [ticket, "Online", "Simulado", null, token, null, null, datos.delivery];
  const generados = {
    session,
    token,
    delivery: datos.delivery,
    address: (datos.address ?? "").trim() || null,
    lineas: JSON.stringify(lineas),
    subtotal,
    envio,
    total,
  };
  const client = await getPool().connect();
  let provisional: number;
  try {
    await client.query("BEGIN");
    const insertado = await client.query(
      "INSERT INTO orders(token, code, channel, status, payment, customer, session, delivery, address, lines, subtotal_cents, shipping_cents, total_cents) VALUES($1,$2,'Online','Pendiente de pago','Simulado',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
      [
        generados.token,
        "pendiente-" + token.slice(0, 8),
        datos.customer ?? null,
        session,
        generados.delivery,
        generados.address,
        generados.lineas,
        generados.subtotal,
        generados.envio,
        generados.total,
      ],
    );
    provisional = Number((insertado.rows[0] as { id: string | number }).id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  try {
    await mutateInventory({
      operation: "sale",
      args: argsVenta,
      requestId: token,
    });
  } catch (error) {
    await getPool().query("DELETE FROM orders WHERE token=$1 AND status='Pendiente de pago'", [
      token,
    ]);
    throw error;
  }
  await vaciarCarrito(session);
  const codigo = await getPool().query(
    "UPDATE orders SET code=$2, updated_at=now() WHERE token=$1 RETURNING code",
    [token, "CP-" + String(10000 + provisional)],
  );
  await procesarPago(token);
  return {
    code: String((codigo.rows[0] as { code: string }).code),
    totalCents: total,
    repetido: false,
  };
}
