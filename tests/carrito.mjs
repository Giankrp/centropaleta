import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ensureSchema } from "../lib/inventario/bd.ts";
import { mutateInventory, loadInventory } from "../lib/inventario/servicio.ts";
import {
  agregarArticulo,
  ajustarCantidad,
  quitarArticulo,
  finalizarCarrito,
  articulosCarrito,
  contarCarrito,
} from "../lib/carrito.ts";
import { crearEncargo, cambiarEstadoEncargo } from "../lib/encargos.ts";
import { consultarPedido } from "../lib/pagos.ts";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

await ensureSchema();
const created = await mutateInventory({
  operation: "addProduct",
  args: [
    {
      name: "Carrito Visible",
      description: "test",
      cat: "Pokémon",
      type: "sellado",
      set: "151",
      code: `carr${Date.now()}`,
      price: 10,
      stock: 3,
      min: 1,
      target: 5,
    },
  ],
  requestId: crypto.randomUUID(),
});
const id = created.result.id;
const catalogo = { productos: [{ id, name: created.result.name, stock: 3, price: 10 }] };

const sesion = "pruebas-carrito-" + crypto.randomUUID().slice(0, 8);
await assert.rejects(() => agregarArticulo(sesion, catalogo, id, 0), /Cantidad/);
await assert.rejects(() => agregarArticulo(sesion, catalogo, 999999, 1), /disponible/);
await agregarArticulo(sesion, catalogo, id, 2);
assert.equal(await contarCarrito(sesion), 2);
await agregarArticulo(sesion, catalogo, id, 5);
assert.equal(await contarCarrito(sesion), 3);
await assert.rejects(() => ajustarCantidad(sesion, catalogo, id, 9), /insuficiente/);
await ajustarCantidad(sesion, catalogo, id, 2);
await quitarArticulo(sesion, id);
await agregarArticulo(sesion, catalogo, id, 3);
assert.deepEqual(await articulosCarrito(sesion), [{ productId: id, qty: 3 }]);

await assert.rejects(
  () => finalizarCarrito(sesion, { delivery: "shipping", address: "" }, crypto.randomUUID()),
  /direcci/,
);
const token = crypto.randomUUID();
const compra = await finalizarCarrito(
  sesion,
  { delivery: "shipping", address: "Calle Oeste 10" },
  token,
);
assert.match(compra.code, /^CP-\d+$/);
assert.equal(compra.totalCents, 30 * 100 + 499);
assert.equal(compra.repetido, false);
const compra2 = await finalizarCarrito(
  sesion,
  { delivery: "shipping", address: "Otra calle" },
  token,
);
assert.equal(compra2.code, compra.code);
assert.equal(compra2.repetido, true);
const estado = await loadInventory();
const vendido = estado.state.products.find((p) => p.id === id);
assert.equal(vendido.stock, 0);
const sale = estado.state.sales[0];
assert.equal(sale.channel, "Online");
assert.equal(sale.total, compra.totalCents);
assert.deepEqual(await articulosCarrito(sesion), []);
const pedido = await consultarPedido(compra.code);
assert.ok(pedido);
assert.equal(pedido.status, "Pagado");
assert.equal(pedido.payment, "Simulado");

const encargo = await crearEncargo({
  kind: "venta",
  product: "Mewtwo base set",
  universe: "Pokémon",
  priceCents: 25000,
  condition: "Excelente",
  fotos: ["data:image/png;base64,aGVsbG8="],
});
assert.match(encargo, /^ENC-/);
await cambiarEstadoEncargo(encargo, "Completado", "Contactado por WhatsApp");
await mutateInventory({
  operation: "deleteProduct",
  args: [id],
  requestId: crypto.randomUUID(),
  productVersion: vendido._version,
});
console.log(
  "PASS carrito server (límites, checkout idempotente, stock descontado, canal Online, pedido Pagado) y encargos en PostgreSQL",
);
