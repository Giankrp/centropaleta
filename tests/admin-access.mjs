import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSession, isAdmin, readToken, verifyAdmin } from "../lib/sesion.ts";
import { hashDePassword } from "../lib/usuarios.ts";
import { ensureSchema } from "../lib/inventario/bd.ts";
import { loadInventory, mutateInventory } from "../lib/inventario/servicio.ts";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

process.env.ADMIN_PASSWORD = "";
process.env.ADMIN_PASSWORD_HASH = hashDePassword("PruebaSegura1");
assert.equal(
  verifyAdmin(process.env.ADMIN_USERNAME, "incorrecta"),
  false,
  "contraseña incorrecta rechazada",
);
assert.equal(
  verifyAdmin(process.env.ADMIN_USERNAME, "PruebaSegura1"),
  true,
  "hash scrypt del admin aceptado",
);
assert.equal(
  verifyAdmin("otro", process.env.ADMIN_PASSWORD),
  false,
  "usuario incorrecto rechazado",
);

const cookieAdmin = `cp_session=${createSession(process.env.ADMIN_USERNAME || "centropaleta")}`;
assert.equal(
  isAdmin(new Request("http://localhost:8000/api/inventory", { headers: { cookie: cookieAdmin } })),
  true,
  "cookie admin reconocida",
);
assert.equal(
  isAdmin(new Request("http://localhost:8000/api/inventory")),
  false,
  "sin cookie no es admin",
);
assert.equal(readToken("a.b"), null, "token inválido rechazado");
assert.equal(readToken("x" + cookieAdmin.slice(11)), null, "firma alterada rechazada");

const anonimo = await fetch("http://127.0.0.1:8000/api/inventory");
const datos = await anonimo.json();
assert.equal(datos.admin, false, "GET público anónimo");
assert.ok(Array.isArray(datos.state.products), "GET público devuelve productos");

await ensureSchema();
const code = `adm${Date.now()}`;
const data = {
  name: "Producto admin",
  description: "Prueba",
  cat: "Pokémon",
  type: "sellado",
  set: "151",
  code,
  price: 12.5,
  stock: 3,
  min: 1,
  target: 8,
  condition: "Sellado",
};
const created = await mutateInventory({
  operation: "addProduct",
  args: [data],
  requestId: crypto.randomUUID(),
});
const id = created.result.id;
assert.equal(created.result.price, 12.5);
const updated = await mutateInventory({
  operation: "updateProduct",
  args: [id, { price: 18.75 }],
  requestId: crypto.randomUUID(),
  productVersion: created.result._version,
});
assert.equal(updated.result.price, 18.75);
await mutateInventory({
  operation: "deleteProduct",
  args: [id],
  requestId: crypto.randomUUID(),
  productVersion: updated.result._version,
});
assert.equal(
  (await loadInventory()).state.products.some((p) => p.id === id),
  false,
);
console.log("PASS admin: sesión scrypt/plan, guard por cookie, alta, cambio de precio y borrado");
