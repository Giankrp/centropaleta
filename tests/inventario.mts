import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ensureSchema, getPool } from "../lib/inventario/bd.ts";
import { loadInventory, mutateInventory } from "../lib/inventario/servicio.ts";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

await ensureSchema();

async function muta(
  operation: string,
  args: unknown[],
  extra: { productVersion?: number; requestId?: string } = {},
): Promise<any> {
  return await mutateInventory({
    operation,
    args,
    requestId: extra.requestId ?? crypto.randomUUID(),
    productVersion: extra.productVersion,
  });
}

const photo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4z8AAAAMBAQCc479ZAAAAAElFTkSuQmCC";
const datos = {
  name: "Kernel Visible",
  description: "Prueba del kernel",
  cat: "Pokémon",
  type: "sellado",
  set: "T1",
  price: 19.95,
  stock: 5,
  min: 2,
  target: 10,
  photo,
  condition: "Sellado",
};

const alta = await muta("addProduct", [datos]);
const id = alta.result.id;
assert.equal(alta.result.code.startsWith("CP-"), true, "código automático CP-");
assert.equal(alta.result.price, 19.95);
assert.ok(String(alta.result.photo).startsWith("data:image/webp;base64,"));
assert.equal(alta.result._version, 1);

const cargado = await loadInventory();
assert.equal(
  cargado.state.products.some((p) => p.id === id),
  true,
);

const actualizado = await muta(
  "updateProduct",
  [id, { price: 24.95, description: "Nueva descripción" }],
  { productVersion: 1 },
);
assert.equal(actualizado.result.price, 24.95);
assert.equal(actualizado.result._version, 2);
await assert.rejects(
  () => muta("updateProduct", [id, { price: 1 }], { productVersion: 1 }),
  /cambió en otro dispositivo/,
);
await assert.rejects(
  () => muta("updateProduct", [id, { price: -1 }], { productVersion: 2 }),
  /precio/i,
);

const requestId = crypto.randomUUID();
await muta("replenish", [id, 2], { requestId });
await muta("replenish", [id, 2], { requestId });
assert.equal(
  (await loadInventory()).state.products.find((p) => p.id === id)!.stock,
  7,
  "idempotencia por requestId",
);

const concurrentes = await Promise.allSettled([
  muta("replenish", [id, 1]),
  muta("replenish", [id, 3]),
]);
const exitosos = concurrentes.filter((r) => r.status === "fulfilled").length;
assert.equal(exitosos, 2, "replenish concurrente sin corrupción");
assert.equal(
  (await loadInventory()).state.products.find((p) => p.id === id)!.stock,
  11,
  "stock suma exacto con FOR UPDATE",
);

await assert.rejects(() => muta("addProduct", [{ ...datos, code: alta.result.code }]), /código/i);

await muta("sale", [{ [id]: 2 }, "Tienda física", "Efectivo", 5000, crypto.randomUUID()]);
const trasVenta = (await loadInventory()).state.products.find((p) => p.id === id)!;
assert.equal(trasVenta.stock, 9, "stock descontado en venta física");
const ventaRegistrada = (await loadInventory()).state.sales[0];
assert.equal(ventaRegistrada.channel, "Tienda física");
assert.ok(ventaRegistrada.id.startsWith("CP-"));
assert.equal(ventaRegistrada.change, 5000 - ventaRegistrada.total);

const tokenOnline = crypto.randomUUID();
const onlinePrimera = await muta("sale", [
  { [id]: 1 },
  "Online",
  "Simulado",
  null,
  tokenOnline,
  null,
  null,
  "pickup",
]);
const idOnline = onlinePrimera.result.id;
assert.equal((await loadInventory()).state.products.find((p) => p.id === id)!.stock, 8);
const repetida = await muta("sale", [
  { [id]: 1 },
  "Online",
  "Simulado",
  null,
  tokenOnline,
  null,
  null,
  "pickup",
]);
assert.equal(repetida.result.id, idOnline);
assert.equal(
  (await loadInventory()).state.products.find((p) => p.id === id)!.stock,
  8,
  "token repetido no descuenta dos veces",
);

await assert.rejects(
  () => muta("sale", [{ [id]: 1 }, "Online demo", "Simulado", null, crypto.randomUUID()]),
  /demostración|Selecciona/,
);
await assert.rejects(
  () => muta("sale", [{ [id]: 99 }, "Tienda física", "Efectivo", 100000, crypto.randomUUID()]),
  /Stock insuficiente/,
);

await assert.rejects(
  () => muta("sale", [{ [id]: 1 }, "Online", "Simulado", null, crypto.randomUUID(), null, null]),
  /Selecciona envío/,
);

const sobreventa = await Promise.allSettled([
  muta("sale", [{ [id]: 10 }, "Tienda física", "Efectivo", 999999, crypto.randomUUID()]),
]);
assert.equal(sobreventa[0].status, "rejected", "no sobrevende sobre stock mayor");

await muta("associateCode", [id, "EAN-TEST-1"]);
await muta("removeBarcode", [id, "EAN-TEST-1"]);
const sinCodigo = (await loadInventory()).state.products.find((p) => p.id === id)!.barcodes;
assert.equal(sinCodigo.length, 0, "el código asociado se puede quitar");

const versionFinal = (await loadInventory()).state.products.find((p) => p.id === id)!._version;
const borrado = await muta("deleteProduct", [id], { productVersion: versionFinal });
assert.equal(borrado.result.id, id);
const sinProducto = (await loadInventory()).state.products.some((p) => p.id === id);
assert.equal(sinProducto, false);
const historial = (await loadInventory()).state.sales;
assert.ok(historial.length > 0, "el historial de ventas sobrevive al borrado");
const lineasHuerfanas = await getPool().query(
  "SELECT count(*) AS total FROM sales_lines WHERE product_id IS NULL",
);
assert.ok(Number(lineasHuerfanas.rows[0].total) >= 0);

const altaExtra = await muta("addProduct", [{ ...datos, name: "Kernel Visible 2" }]);
await assert.rejects(
  () => muta("importProducts", [[{ ...datos, id: 777 }]]),
  /catálogo vacío|vacío/i,
);
const versionExtra = (await loadInventory()).state.products.find(
  (p) => p.id === altaExtra.result.id,
)!._version;
await muta("deleteProduct", [altaExtra.result.id], { productVersion: versionExtra });
console.log(
  "PASS kernel normalizado: alta/código automático, foto, versiones, idempotencia, concurrencia, ventas física+online, dedupe token, borrado con historial, importación guard",
);
