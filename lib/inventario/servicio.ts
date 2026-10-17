import { desc, eq, sql as plantilla } from "drizzle-orm";
import sharp from "sharp";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
import { getPool, ensureSchema } from "./bd.ts";
import {
  moves,
  photos,
  products as productos,
  sales,
  salesLines,
  mutationResults,
} from "../../db/schema.ts";

import {
  cuentaPrefix,
  condicionPorDefecto,
  datosZod,
  productoEsquema,
  productoEdicionEsquema,
} from "./dominio.ts";
import { vender, type VentaInventario } from "./venta.ts";
export type ProductoInventario = {
  id: number;
  name: string;
  description: string;
  cat: string;
  type: string;
  set: string;
  code: string;
  price: number;
  stock: number;
  min: number;
  target: number;
  condition: string;
  badge: string | null;
  art: string;
  image: string | null;
  photo: string | null;
  photoActual: boolean;
  barcodes: string[];
  offerActive: boolean;
  offerPercent: number | null;
  _version: number;
  createdAt: string;
  updatedAt: string;
};

export type MovimientoInventario = {
  date: string;
  name: string;
  qty: number;
  kind: string;
  token?: string | null;
  productId?: number | null;
};

export type EstadoInventario = {
  state: {
    products: ProductoInventario[];
    sales: VentaInventario[];
    moves: MovimientoInventario[];
  };
  revision: number;
};

type FilasBasicas = { rows: Record<string, unknown>[]; rowCount: number | null };

let base: NodePgDatabase | undefined;

function drz(): NodePgDatabase {
  if (!base) base = drizzle(getPool());
  return base;
}

type Ejecutor = (sql: string, valores?: unknown[]) => Promise<FilasBasicas>;

async function transaccion<T>(trabajo: (query: Ejecutor) => Promise<T>): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query("BEGIN");
    let resultado: T;
    try {
      const query: Ejecutor = async (sql: string, values: unknown[] = []) => {
        const dato = await client.query(sql, values);
        return { rows: dato.rows as Record<string, unknown>[], rowCount: dato.rowCount };
      };
      resultado = await trabajo(query);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    return resultado;
  } finally {
    client.release();
  }
}

type FilaProducto = typeof productos.$inferSelect;
type FilaVenta = typeof sales.$inferSelect;
type FilaLinea = typeof salesLines.$inferSelect;
type FilaMovimiento = typeof moves.$inferSelect;

function dtoDeFila(
  fila: Record<string, unknown>,
  fotoUrl: string | null,
  fotoActual = Boolean(fotoUrl),
): ProductoInventario {
  const fecha = (valor: unknown) => (valor instanceof Date ? valor.toISOString() : String(valor));
  const imageBruto = (fila.imageUrl ?? fila.image_url) as string | null;
  const image =
    imageBruto && imageBruto.startsWith("/assets/")
      ? imageBruto.replace(/^\/assets\//, "").replace(/\.webp$/, "")
      : null;
  const priceCents = Number((fila.priceCents ?? fila.price_cents) as number);
  return {
    id: Number(fila.id),
    name: String(fila.name),
    description: String(fila.description ?? ""),
    cat: String(fila.category ?? fila.cat),
    type: String(fila.type),
    set: String(fila.setName ?? fila.set ?? ""),
    code: String(fila.code),
    price: priceCents / 100,
    stock: Number(fila.stock ?? 0),
    min: Number(fila.minStock ?? fila.min_stock ?? 0),
    target: Number(fila.targetStock ?? fila.target_stock ?? 0),
    condition: String(fila.condition ?? ""),
    badge: (fila.badge as string | null) ?? null,
    art: String(fila.art ?? "📦"),
    image,
    photo: fotoUrl,
    photoActual: fotoActual,
    barcodes: (fila.barcodes as string[] | undefined) ?? [],
    offerActive: Boolean(fila.offerActive ?? fila.offer_active),
    offerPercent: (fila.offerPercent ?? fila.offer_percent) as number | null,
    _version: Number(fila.version ?? fila._version ?? 1),
    createdAt: fecha(fila.createdAt ?? fila.created_at),
    updatedAt: fecha(fila.updatedAt ?? fila.updated_at),
  };
}

function ventaDto(fila: FilaVenta, lineas: FilaLinea[]): VentaInventario {
  const fecha =
    fila.createdAt instanceof Date ? fila.createdAt.toISOString() : String(fila.createdAt);
  return {
    id: fila.code,
    token: fila.token,
    date: fecha,
    channel: fila.channel,
    payment: fila.payment,
    customerId: fila.customerId,
    customerProfile: fila.customerProfile,
    lines: lineas.map((linea) => ({
      id: linea.productId ?? 0,
      name: linea.productName,
      qty: linea.qty,
      cents: linea.unitCents,
    })),
    subtotal: fila.subtotalCents,
    shippingCents: fila.shippingCents,
    deliveryMethod: fila.delivery,
    total: fila.totalCents,
    received: fila.receivedCents,
    change: fila.changeCents,
  };
}

function movimientoDto(fila: FilaMovimiento): MovimientoInventario {
  return {
    date: fila.createdAt.toISOString(),
    name: fila.productName,
    qty: fila.qty,
    kind: fila.kind,
    token: fila.token,
    productId: fila.productId,
  };
}

export async function loadInventory(): Promise<EstadoInventario> {
  await ensureSchema();
  const base = drz();
  const [filasProductos, filasFotos, filasVentas, filasLineas, filaMovimientos] = await Promise.all(
    [
      base.select().from(productos).orderBy(productos.id),
      base.select({ id: photos.id, productId: photos.productId }).from(photos),
      base.select().from(sales).orderBy(desc(sales.createdAt), desc(sales.id)),
      base.select().from(salesLines),
      base.select().from(moves).orderBy(desc(moves.createdAt), desc(moves.id)),
    ],
  );
  const fotosPorProducto = new Set<number>();
  for (const fila of filasFotos) fotosPorProducto.add(fila.productId);
  const lineasPorVenta = new Map<number, FilaLinea[]>();
  for (const linea of filasLineas) {
    const lista = lineasPorVenta.get(linea.saleId) ?? [];
    lista.push(linea);
    lineasPorVenta.set(linea.saleId, lista);
  }
  const productosEstado = filasProductos.map((fila) =>
    dtoDeFila(fila as unknown as Record<string, unknown>, null, fotosPorProducto.has(fila.id)),
  );
  const ventasEstado = filasVentas.map((fila) => ventaDto(fila, lineasPorVenta.get(fila.id) ?? []));
  const movimientos = filaMovimientos.map(movimientoDto);
  return {
    state: { products: productosEstado, sales: ventasEstado, moves: movimientos },
    revision: 0,
  };
}

const METODO_MUTACION = new Set([
  "addProduct",
  "updateProduct",
  "deleteProduct",
  "configure",
  "replenish",
  "describe",
  "configureOffer",
  "removeOffer",
  "associateCode",
  "receive",
  "sale",
  "importProducts",
  "removeBarcode",
]);

export type SolicitudMutacion = {
  operation: string;
  args: unknown[];
  requestId: string;
  productVersion?: number;
};

type Intencion = { result: unknown };

function entero(v: unknown): number {
  const valor = Number(v);
  if (!Number.isSafeInteger(valor)) throw new Error("Niveles de inventario inválidos");
  return valor;
}

function valoresProducto(patch: Record<string, unknown>): Record<string, unknown> | null {
  const permitidos = [
    "name",
    "description",
    "cat",
    "type",
    "set",
    "code",
    "price",
    "stock",
    "min",
    "target",
    "condition",
    "badge",
    "photo",
    "offerActive",
    "offerPercent",
  ];
  const salida: Record<string, unknown> = {};
  for (const clave of permitidos) if (patch[clave] !== undefined) salida[clave] = patch[clave];
  return Object.keys(salida).length ? salida : null;
}

async function fotoDe(id: number, query: Ejecutor): Promise<string | null> {
  const { rows } = await query("SELECT mime, data FROM photos WHERE product_id=$1", [id]);
  return rows.length ? `data:${rows[0].mime};base64,${rows[0].data}` : null;
}

async function productoPorId(id: number): Promise<FilaProducto | null> {
  const filas = await drz().select().from(productos).where(eq(productos.id, id)).limit(1);
  return (filas[0] as FilaProducto) ?? null;
}

async function productoFresh(id: number, query?: Ejecutor): Promise<ProductoInventario> {
  if (query) {
    const { rows } = await query("SELECT * FROM productos WHERE id=$1", [id]);
    const fila = rows[0];
    if (!fila) throw new Error("El producto ya no existe");
    return dtoDeFila(fila, await fotoDe(id, query));
  }
  const fila = await productoPorId(id);
  if (!fila) throw new Error("El producto ya no existe");
  const fotos = await drz().select().from(photos).where(eq(photos.productId, id)).limit(1);
  const foto = fotos[0];
  return dtoDeFila(fila, foto ? `data:${foto.mime};base64,${foto.data}` : null);
}

const MAX_FOTO_BYTES = 15 * 1024 * 1024;

async function convertirFoto(valor: unknown): Promise<{ mime: string; data: string } | null> {
  if (valor == null) return null;
  const texto = String(valor);
  if (texto.length > (MAX_FOTO_BYTES * 4) / 3 + 1024)
    throw new Error("La imagen supera el máximo de 15 MB");
  const match = /^data:image\/(jpeg|jpg|png|webp|gif|avif);base64,([A-Za-z0-9+/=]+)$/.exec(texto);
  if (!match) throw new Error("Imagen inválida o formato no soportado");
  const original = Buffer.from(match[2], "base64");
  const webp = await sharp(original)
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return { mime: "image/webp", data: webp.toString("base64") };
}

function extraerId(v: unknown): number {
  const id = Number(v);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Identificador de producto inválido");
  return id;
}

function asignaColumnas(parcial: Record<string, unknown>): {
  claves: string[];
  valores: unknown[];
  asignaciones: string[];
} {
  const minutos: Record<string, string> = {
    name: "name",
    description: "description",
    cat: "category",
    type: "type",
    set: "set_name",
    code: "code",
    price: "price_cents",
    stock: "stock",
    min: "min_stock",
    target: "target_stock",
    condition: "condition",
    badge: "badge",
    offerActive: "offer_active",
    offerPercent: "offer_percent",
  };
  const claves: string[] = [];
  const valores: unknown[] = [];
  const asignaciones: string[] = [];
  let indice = 0;
  for (const clave of Object.keys(parcial)) {
    const columna = minutos[clave];
    if (!columna) continue;
    let valor = parcial[clave];
    if (valor === undefined) continue;
    indice++;
    if (clave === "price") valor = Math.round(Number(valor) * 100);
    claves.push(columna);
    valores.push(valor);
    asignaciones.push(`${columna}=$${indice}`);
  }
  if (!claves.length) throw new Error("No hay cambios que guardar");
  return { claves, valores, asignaciones };
}

async function validaCodigoUnico(
  id: number | null,
  code: string,
  barcodes: string[],
  query: Ejecutor,
): Promise<void> {
  for (const codigo of [code, ...barcodes]) {
    const { rows } = await query(
      "SELECT id FROM productos WHERE id <> COALESCE($1, -1) AND (code=$2 OR $2=ANY(barcodes)) LIMIT 1",
      [id, codigo],
    );
    if (rows.length) throw new Error("Ese código ya pertenece a otro producto");
  }
}

export async function mutateInventory(
  solicitud: SolicitudMutacion,
): Promise<{ result: unknown } & EstadoInventario> {
  await ensureSchema();
  if (
    !METODO_MUTACION.has(solicitud.operation) ||
    !Array.isArray(solicitud.args) ||
    solicitud.args.length > 10
  )
    throw new Error("Solicitud inválida");
  if (
    typeof solicitud.requestId !== "string" ||
    !/^[a-zA-Z0-9-]{10,100}$/.test(solicitud.requestId)
  )
    throw new Error("Solicitud inválida");
  const previa = await drz()
    .select()
    .from(mutationResults)
    .where(eq(mutationResults.id, solicitud.requestId))
    .limit(1);
  if (previa.length) {
    const fila = previa[0] as typeof mutationResults.$inferSelect;
    return { result: fila.result, ...(await loadInventory()) };
  }
  const { result } = await ejecutar(solicitud);
  await drz()
    .insert(mutationResults)
    .values({
      id: solicitud.requestId,
      result: result === undefined ? {} : JSON.parse(JSON.stringify(result)),
    })
    .onConflictDoNothing();
  if (Math.random() < 0.05) {
    await drz().execute(
      plantilla`DELETE FROM mutation_results WHERE created_at < now() - interval '7 days'`,
    );
  }
  return { result: result ?? null, ...(await loadInventory()) };
}

async function ejecutar(solicitud: SolicitudMutacion): Promise<Intencion> {
  const { operation, args } = solicitud;
  switch (operation) {
    case "sale":
      return { result: await vender(solicitud) };
    case "addProduct":
      return { result: await alta(args[0]) };
    case "updateProduct":
      return {
        result: await actualizar(
          extraerId(args[0]),
          (args[1] ?? {}) as Record<string, unknown>,
          solicitud.productVersion,
        ),
      };
    case "deleteProduct":
      return { result: await borrar(extraerId(args[0]), solicitud.productVersion) };
    case "configure":
      return {
        result: await ajustar(
          extraerId(args[0]),
          entero(args[1]),
          entero(args[2]),
          entero(args[3]),
          String(args[4] ?? "").trim(),
        ),
      };
    case "replenish":
      return { result: await reponer(extraerId(args[0]), entero(args[1])) };
    case "describe":
      return { result: await describir(extraerId(args[0]), String(args[1] ?? "")) };
    case "configureOffer":
      return { result: await ofrecer(extraerId(args[0]), Boolean(args[1]), entero(args[2])) };
    case "removeOffer":
      return { result: await ofrecerDesactivada(extraerId(args[0])) };
    case "associateCode":
      return { result: await codigoExtra(extraerId(args[0]), String(args[1] ?? "").trim()) };
    case "removeBarcode":
      return { result: await quitarBarcode(extraerId(args[0]), String(args[1] ?? "").trim()) };
    case "receive":
      return {
        result: await recepcion(
          extraerId(args[0]),
          entero(args[1]),
          String(args[2] ?? ""),
          String(args[3] ?? ""),
          (args[4] ?? null) as unknown,
        ),
      };
    case "importProducts":
      return { result: await importar((args[0] ?? []) as unknown[]) };
    default:
      throw new Error("Solicitud inválida");
  }
}

async function alta(datos: unknown): Promise<ProductoInventario> {
  return await transaccion(async (query) => {
    await query("SELECT next_product_id FROM inventory_meta WHERE id=1 FOR UPDATE");
    const { rows: conteoMax } = await query("SELECT COALESCE(MAX(id),0) AS maximo FROM productos");
    const compatible = productoEsquema.safeParse((datos ?? {}) as unknown);
    if (!compatible.success) throw new Error(datosZod(compatible.error));
    const producto = compatible.data as Omit<typeof compatible.data, "code"> & { code?: string };
    const actual = Math.max(Number((conteoMax[0] as { maximo: number }).maximo) + 1, 1);
    const { rows: meta } = await query("SELECT next_product_id FROM inventory_meta WHERE id=1");
    const nextPrevio = meta.length
      ? Number((meta[0] as { next_product_id: number }).next_product_id)
      : 1;
    const id = Math.max(actual, nextPrevio);
    const code = String(producto.code || "").trim() || cuentaPrefix(id);
    const condition = producto.condition || condicionPorDefecto(producto.type);
    await validaCodigoUnico(null, code, producto.barcodes ?? [], query);
    const imageUrl = producto.image ? `/assets/${producto.image}.webp` : null;
    await query(
      "INSERT INTO productos(id, name, description, category, type, set_name, code, price_cents, stock, min_stock, target_stock, condition, badge, art, image_url, offer_active, offer_percent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,false,NULL)",
      [
        id,
        producto.name,
        producto.description,
        producto.cat,
        producto.type,
        producto.set,
        code,
        Math.round(producto.price * 100),
        producto.stock,
        producto.min,
        producto.target,
        condition,
        producto.badge ?? null,
        producto.art || "📦",
        imageUrl,
      ],
    );
    const foto = await convertirFoto(producto.photo ?? null);
    if (foto)
      await query(
        "INSERT INTO photos(product_id, mime, data) VALUES($1,$2,$3) ON CONFLICT (product_id) DO UPDATE SET mime=EXCLUDED.mime, data=EXCLUDED.data",
        [id, foto.mime, foto.data],
      );
    await query(
      "INSERT INTO moves(kind, product_name, qty, product_id) VALUES('Alta de producto',$2,$3,$1)",
      [id, producto.name, producto.stock],
    );
    await query(
      "INSERT INTO inventory_meta(id, next_product_id) VALUES(1,$1) ON CONFLICT (id) DO UPDATE SET next_product_id=EXCLUDED.next_product_id",
      [id + 1],
    );
    return await productoFresh(id, query);
  });
}

async function quitarBarcode(id: number, codigo: string): Promise<ProductoInventario> {
  if (!codigo) throw new Error("Selecciona un código para quitar");
  return await transaccion(async (query) => {
    const { rows } = await query("SELECT id FROM productos WHERE id=$1 FOR UPDATE", [id]);
    if (!rows.length) throw new Error("Selecciona un producto");
    await query(
      "UPDATE productos SET barcodes=array_remove(COALESCE(barcodes, '{}'), $2) WHERE id=$1",
      [id, codigo],
    );
    return await productoFresh(id, query);
  });
}

async function actualizar(
  id: number,
  crudo: Record<string, unknown>,
  versionEsperada?: number,
): Promise<ProductoInventario> {
  return await transaccion(async (query) => {
    const { rows } = await query(
      "SELECT id, version, stock FROM productos WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!rows.length) throw new Error("El producto ya no existe");
    const version = Number((rows[0] as { version: number }).version);
    if (versionEsperada !== undefined && versionEsperada !== version)
      throw new Error(
        "Este producto cambió en otro dispositivo. Actualiza los datos antes de guardar.",
      );
    const parcial = valoresProducto(crudo);
    if (!parcial) throw new Error("No hay cambios que guardar");
    const compatible = productoEdicionEsquema.safeParse({
      ...parcial,
      price: parcial.price !== undefined ? Number(parcial.price) : undefined,
      stock: parcial.stock !== undefined ? entero(parcial.stock) : undefined,
      min: parcial.min !== undefined ? entero(parcial.min) : undefined,
      target: parcial.target !== undefined ? entero(parcial.target) : undefined,
    });
    if (!compatible.success) throw new Error(datosZod(compatible.error));
    const objetivo = compatible.data as Record<string, unknown>;
    const { claves, valores, asignaciones } = asignaColumnas(objetivo);
    await query(
      `UPDATE productos SET ${asignaciones.join(", ")}, version=version+1, updated_at=now() WHERE id=$${claves.length + 1}`,
      [...valores, id],
    );
    const foto = await convertirFoto(parcial.photo);
    if (parcial.photo !== undefined) {
      if (foto)
        await query(
          "INSERT INTO photos(product_id, mime, data) VALUES($1,$2,$3) ON CONFLICT (product_id) DO UPDATE SET mime=EXCLUDED.mime, data=EXCLUDED.data",
          [id, foto.mime, foto.data],
        );
      else await query("DELETE FROM photos WHERE product_id=$1", [id]);
    }
    await query(
      "INSERT INTO moves(kind, product_name, qty, product_id) SELECT 'Modificación de producto', name, 0, $1 FROM productos WHERE id=$1",
      [id],
    );
    return await productoFresh(id, query);
  });
}

async function borrar(id: number, versionEsperada?: number): Promise<{ id: number; name: string }> {
  return await transaccion(async (query) => {
    const { rows } = await query(
      "SELECT id, name, version, stock FROM productos WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!rows.length) throw new Error("El producto ya no existe");
    const fila = rows[0] as { id: number; name: string; version: number; stock: number };
    if (versionEsperada !== undefined && versionEsperada !== fila.version)
      throw new Error(
        "Este producto cambió en otro dispositivo. Actualiza los datos antes de guardar.",
      );
    await query(
      "INSERT INTO moves(kind, product_name, qty, product_id) VALUES('Eliminación de producto',$2,$3,$1)",
      [id, fila.name, -fila.stock],
    );
    await query("DELETE FROM productos WHERE id=$1", [id]);
    await query(
      "UPDATE inventory_meta SET next_product_id = GREATEST(next_product_id, $1) WHERE id=1",
      [id + 1],
    );
    return { id, name: fila.name };
  });
}

async function ajustar(
  id: number,
  stock: number,
  min: number,
  target: number,
  code: string,
): Promise<ProductoInventario> {
  if (target < min)
    throw new Error("Usa unidades enteras y un objetivo igual o superior al mínimo");
  if (!code) throw new Error("Introduce un código de producto");
  return await transaccion(async (query) => {
    const { rows } = await query("SELECT id, name, stock FROM productos WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    if (!rows.length) throw new Error("Producto desconocido");
    await validaCodigoUnico(id, code, [], query);
    const filas = rows[0] as { id: number; name: string; stock: number };
    const diferencia = stock - filas.stock;
    await query(
      "UPDATE productos SET stock=$2, min_stock=$3, target_stock=$4, code=$5 WHERE id=$1",
      [id, stock, min, target, code],
    );
    if (diferencia !== 0)
      await query(
        "INSERT INTO moves(kind, product_name, qty, product_id) VALUES('Ajuste',$2,$3,$1)",
        [id, filas.name, diferencia],
      );
    return await productoFresh(id, query);
  });
}

async function reponer(id: number, qty: number): Promise<ProductoInventario> {
  if (!Number.isSafeInteger(qty) || qty < 1) throw new Error("Introduce al menos una unidad");
  if (qty > 100000) throw new Error("Cantidad demasiado grande");
  return await transaccion(async (query) => {
    const { rows } = await query("SELECT id, name, stock FROM productos WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    if (!rows.length) throw new Error("Producto desconocido");
    const fila = rows[0] as { id: number; name: string; stock: number };
    if (!Number.isSafeInteger(fila.stock + qty)) throw new Error("Cantidad demasiado grande");
    await query("UPDATE productos SET stock=stock+$2 WHERE id=$1", [id, qty]);
    await query(
      "INSERT INTO moves(kind, product_name, qty, product_id) VALUES('Reposición',$2,$3,$1)",
      [id, fila.name, qty],
    );
    return await productoFresh(id, query);
  });
}

async function describir(id: number, descripcionRaw: string): Promise<ProductoInventario> {
  const descripcion = String(descripcionRaw || "").trim();
  if (descripcion.length > 5000) throw new Error("La descripción admite hasta 5000 caracteres");
  return await transaccion(async (query) => {
    const { rows } = await query("SELECT id FROM productos WHERE id=$1 FOR UPDATE", [id]);
    if (!rows.length) throw new Error("Producto desconocido");
    await query("UPDATE productos SET description=$2 WHERE id=$1", [id, descripcion]);
    return await productoFresh(id, query);
  });
}

async function ofrecer(id: number, activo: boolean, percent: number): Promise<ProductoInventario> {
  if (typeof activo !== "boolean" || !Number.isInteger(percent) || percent < 1 || percent > 99)
    throw new Error("Introduce un descuento entero entre 1 y 99 %");
  return await transaccion(async (query) => {
    const { rows } = await query("SELECT id FROM productos WHERE id=$1 FOR UPDATE", [id]);
    if (!rows.length) throw new Error("Producto desconocido");
    await query("UPDATE productos SET offer_active=$2, offer_percent=$3 WHERE id=$1", [
      id,
      activo,
      percent,
    ]);
    return await productoFresh(id, query);
  });
}

async function ofrecerDesactivada(id: number): Promise<ProductoInventario> {
  return await transaccion(async (query) => {
    const { rows } = await query("SELECT id FROM productos WHERE id=$1 FOR UPDATE", [id]);
    if (!rows.length) throw new Error("Producto desconocido");
    await query("UPDATE productos SET offer_active=false, offer_percent=NULL WHERE id=$1", [id]);
    return await productoFresh(id, query);
  });
}

async function codigoExtra(id: number, codigo: string): Promise<ProductoInventario> {
  if (!codigo || codigo.length > 128)
    throw new Error("Introduce un código válido, hasta 128 caracteres");
  return await transaccion(async (query) => {
    const { rows } = await query("SELECT id FROM productos WHERE id=$1 FOR UPDATE", [id]);
    if (!rows.length) throw new Error("Selecciona un producto");
    await validaCodigoUnico(id, codigo, [], query);
    await query(
      "UPDATE productos SET barcodes=array_append(COALESCE(barcodes, '{}'), $2) WHERE id=$1",
      [id, codigo],
    );
    return await productoFresh(id, query);
  });
}

async function recepcion(
  id: number,
  qty: number,
  descripcionRaw: string,
  token: string,
  fotoCruda: unknown,
): Promise<{ product: ProductoInventario; duplicate: boolean } | { duplicate: true }> {
  if (!token) throw new Error("Falta la referencia de recepción");
  const descripcion = String(descripcionRaw || "").trim();
  if (descripcion.length > 5000) throw new Error("La descripción admite hasta 5000 caracteres");
  if (!Number.isSafeInteger(qty) || qty < 1)
    throw new Error("Introduce unidades enteras, al menos una");
  if (qty > 100000) throw new Error("Cantidad demasiado grande");
  return await transaccion(async (query) => {
    const { rows: anterior } = await query("SELECT 1 FROM moves WHERE token=$1 LIMIT 1", [token]);
    if (anterior.length) return { duplicate: true } as const;
    const { rows } = await query("SELECT id, name, stock FROM productos WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    if (!rows.length) throw new Error("Producto desconocido");
    const fila = rows[0] as { id: number; name: string; stock: number };
    if (!Number.isSafeInteger(fila.stock + qty)) throw new Error("Cantidad demasiado grande");
    await query("UPDATE productos SET stock=stock+$2, description=$3 WHERE id=$1", [
      id,
      qty,
      descripcion,
    ]);
    const foto = await convertirFoto(fotoCruda);
    if (foto)
      await query(
        "INSERT INTO photos(product_id, mime, data) VALUES($1,$2,$3) ON CONFLICT (product_id) DO UPDATE SET mime=EXCLUDED.mime, data=EXCLUDED.data",
        [id, foto.mime, foto.data],
      );
    await query(
      "INSERT INTO moves(kind, product_name, qty, product_id, token) VALUES('Recepción escaneada',$2,$3,$1,$4)",
      [id, fila.name, qty, token],
    );
    return { product: await productoFresh(id, query), duplicate: false } as const;
  });
}

async function importar(lista: unknown[]): Promise<{ imported: number }> {
  if (!Array.isArray(lista) || !lista.length || lista.length > 100)
    throw new Error("Importa entre 1 y 100 productos por vez");
  return await transaccion(async (query) => {
    const { rows: conteo } = await query("SELECT count(*) AS total FROM productos");
    if (Number((conteo[0] as { total: number }).total) > 0)
      throw new Error(
        "La importación inicial requiere un catálogo vacío para no sobrescribir productos",
      );
    await query("SELECT next_product_id FROM inventory_meta WHERE id=1 FOR UPDATE");
    const { rows: meta } = await query("SELECT next_product_id FROM inventory_meta WHERE id=1");
    let next = meta.length ? Number((meta[0] as { next_product_id: number }).next_product_id) : 1;
    let maximoId = await query("SELECT COALESCE(MAX(id),0) AS maximo FROM productos").then((r) =>
      Number((r.rows[0] as { maximo: number }).maximo),
    );
    let codigoAutoMax = maximoId;
    for (const crudo of lista) {
      const compatible = productoEsquema.safeParse(crudo as unknown);
      if (!compatible.success) throw new Error(datosZod(compatible.error));
      const producto = compatible.data;
      const id = producto.id ?? 0;
      if (id < 1) throw new Error("Identificador de producto inválido");
      if (!producto.code) throw new Error("Revisa nombre, código y precio");
      maximoId = Math.max(maximoId, id);
      const code = producto.code;
      const condition = producto.condition || condicionPorDefecto(producto.type);
      await validaCodigoUnico(null, code, producto.barcodes ?? [], query);
      const imageUrl = producto.image ? `/assets/${producto.image}.webp` : null;
      await query(
        "INSERT INTO productos(id, name, description, category, type, set_name, code, price_cents, stock, min_stock, target_stock, condition, badge, art, image_url, offer_active, offer_percent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
        [
          id,
          producto.name,
          producto.description,
          producto.cat,
          producto.type,
          producto.set,
          code,
          Math.round(producto.price * 100),
          producto.stock,
          producto.min,
          producto.target,
          condition,
          producto.badge ?? null,
          producto.art || "📦",
          imageUrl,
          producto.offerActive === true,
          producto.offerActive === true && Number.isInteger(producto.offerPercent)
            ? producto.offerPercent
            : null,
        ],
      );
      const foto = await convertirFoto(producto.photo ?? null);
      if (foto)
        await query("INSERT INTO photos(product_id, mime, data) VALUES($1,$2,$3)", [
          id,
          foto.mime,
          foto.data,
        ]);
      next = Math.max(next, id + 1);
    }
    await query(
      "INSERT INTO inventory_meta(id, next_product_id) VALUES(1,$1) ON CONFLICT (id) DO UPDATE SET next_product_id=EXCLUDED.next_product_id",
      [Math.max(next, codigoAutoMax + 1)],
    );
    await query(
      "INSERT INTO moves(kind, product_name, qty) VALUES('Importación inicial','Importación inicial',$1)",
      [lista.length],
    );
    return { imported: lista.length };
  });
}
