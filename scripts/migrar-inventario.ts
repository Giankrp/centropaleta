import { readFileSync } from "node:fs";
import { ensureSchema, getPool, consulta } from "../lib/inventario/bd.ts";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

await ensureSchema();
const pool = getPool();
await pool.query(
  "INSERT INTO inventory_meta(id, next_product_id) VALUES(1, 1) ON CONFLICT (id) DO NOTHING",
);

const legacy = await consulta<{ key: string; kind: string; payload: string }>(
  "SELECT key, kind, payload FROM inventory_records WHERE kind IN ('product','sale','move','request')",
);
let productos = 0,
  fotos = 0,
  ventas = 0,
  lineas = 0,
  movimientos = 0,
  resultados = 0;

for (const fila of legacy.rows) {
  const dato = JSON.parse(fila.payload);
  if (fila.kind === "product") {
    const precio = Math.round(dato.price * 100);
    const imageUrl = dato.photo ? null : dato.image ? "/assets/" + dato.image + ".webp" : null;
    await pool.query(
      `INSERT INTO productos(id, name, description, category, type, set_name, code, price_cents, stock, min_stock, target_stock, condition, badge, art, image_url, offer_active, offer_percent, version)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, category=EXCLUDED.category, type=EXCLUDED.type, set_name=EXCLUDED.set_name, code=EXCLUDED.code, price_cents=EXCLUDED.price_cents, stock=EXCLUDED.stock, min_stock=EXCLUDED.min_stock, target_stock=EXCLUDED.target_stock, condition=EXCLUDED.condition, badge=EXCLUDED.badge, art=EXCLUDED.art, image_url=EXCLUDED.image_url, offer_active=EXCLUDED.offer_active, offer_percent=EXCLUDED.offer_percent, version=EXCLUDED.version`,
      [
        dato.id,
        dato.name,
        dato.description || "",
        dato.cat,
        dato.type,
        dato.set || "",
        dato.code,
        precio,
        dato.stock,
        dato.min,
        dato.target,
        dato.condition || "",
        dato.badge ?? null,
        dato.art || "📦",
        imageUrl,
        dato.offerActive === true,
        dato.offerActive === true && Number.isInteger(dato.offerPercent) ? dato.offerPercent : null,
        (dato._version ?? 0) + 1,
      ],
    );
    productos++;
    if (dato.photo) {
      const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dato.photo);
      if (match) {
        await pool.query(
          "INSERT INTO photos(product_id, mime, data) VALUES($1,$2,$3) ON CONFLICT (product_id) DO UPDATE SET mime=EXCLUDED.mime, data=EXCLUDED.data",
          [dato.id, "image/" + match[1], match[2]],
        );
        fotos++;
      }
    }
  }
  if (fila.kind === "sale") {
    const insertada = await pool.query(
      `INSERT INTO sales(code, token, channel, payment, customer_id, customer_profile, delivery, subtotal_cents, shipping_cents, total_cents, received_cents, change_cents, created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (token) DO NOTHING RETURNING id`,
      [
        dato.id,
        dato.token,
        dato.channel,
        dato.payment,
        dato.customerId ?? null,
        dato.customerProfile ? JSON.stringify(dato.customerProfile) : null,
        dato.deliveryMethod ?? null,
        dato.subtotal,
        dato.shippingCents,
        dato.total,
        paymentNumber(dato.received),
        paymentNumber(dato.change),
        dato.date,
      ],
    );
    if (insertada.rows.length) {
      ventas++;
      for (const linea of dato.lines) {
        const existe = await pool.query("SELECT 1 FROM productos WHERE id=$1", [linea.id]);
        await pool.query(
          "INSERT INTO sales_lines(sale_id, product_id, product_name, qty, unit_cents) VALUES($1,$2,$3,$4,$5)",
          [
            insertada.rows[0].id,
            existe.rows.length ? linea.id : null,
            linea.name,
            linea.qty,
            linea.cents,
          ],
        );
        lineas++;
      }
    }
  }
  if (fila.kind === "move") {
    const yaExiste = await pool.query(
      "SELECT 1 FROM moves WHERE kind=$1 AND product_name=$2 AND qty=$3 AND created_at=$4 LIMIT 1",
      [dato.kind, dato.name, dato.qty, dato.date],
    );
    if (!yaExiste.rows.length) {
      await pool.query(
        "INSERT INTO moves(kind, product_name, qty, product_id, token, created_at) VALUES($1,$2,$3,$4,$5,$6)",
        [dato.kind, dato.name, dato.qty, dato.productId ?? null, dato.token ?? null, dato.date],
      );
      movimientos++;
    }
  }
  if (fila.kind === "request") {
    await pool.query(
      "INSERT INTO mutation_results(id, result) VALUES($1,$2) ON CONFLICT (id) DO NOTHING",
      [fila.key.replace(/^request:/, ""), fila.payload],
    );
    resultados++;
  }
}

const conteoNuevo = await pool.query(
  "SELECT (SELECT count(*) FROM productos) AS productos, (SELECT count(*) FROM sales) AS sales, (SELECT count(*) FROM moves) AS moves",
);
const legado = await pool.query(
  "SELECT (SELECT count(*) FROM inventory_records WHERE kind='product') AS productos, (SELECT count(*) FROM inventory_records WHERE kind='sale') AS sales, (SELECT count(*) FROM inventory_records WHERE kind='move') AS moves",
);
console.log("migrados:", { productos, fotos, ventas, lineas, movimientos, resultados });
console.log("nuevos:", conteoNuevo.rows[0], "legacy:", legado.rows[0]);

function paymentNumber(valor: unknown) {
  return Number.isSafeInteger(valor) ? valor : null;
}

process.exit(0);
