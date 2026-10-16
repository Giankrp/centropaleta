import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSession, isAdmin, readToken, verifyAdmin } from "../lib/sesion.ts";
import { ensureSchema } from "../lib/inventario/bd.ts";
import { loadInventory, mutateInventory } from "../lib/inventario/servicio.ts";
import { POST as login } from "../app/api/auth/login/route.ts";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

assert.equal(verifyAdmin("centropaleta", "no-es-la-clave"), false);
assert.equal(verifyAdmin(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD), true);
assert.equal(readToken(createSession("centropaleta"))?.role, "admin");
assert.equal(readToken("a.b"), null);

const origin = "http://127.0.0.1:3000";
const host = "127.0.0.1:3000";
const bad = await login(new Request(`${origin}/api/auth/login`, {
  method: "POST",
  headers: { origin, host, "content-type": "application/json" },
  body: JSON.stringify({ username: "centropaleta", password: "incorrecta" }),
}));
assert.equal(bad.status, 401);

const good = await login(new Request(`${origin}/api/auth/login`, {
  method: "POST",
  headers: { origin, host, "content-type": "application/json" },
  body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
}));
assert.equal(good.status, 200);
const cookie = good.headers.get("set-cookie");
assert.match(cookie, /HttpOnly/);
const token = cookie.split(";")[0];
assert.equal(isAdmin(new Request(`${origin}/api/inventory`, { headers: { cookie: token } })), true);

await ensureSchema();
const code = `adm${Date.now()}`;
const data = { name: "Producto admin", description: "Prueba", cat: "Pokémon", type: "sellado", set: "151", code, price: 12.5, stock: 3, min: 1, target: 8, condition: "Sellado" };
async function asAdmin(body) {
  return await mutateInventory({ ...body });
}
const created = await asAdmin({ operation: "addProduct", args: [data], requestId: crypto.randomUUID() });
const id = created.result.id;
assert.equal(created.result.price, 12.5);
const updated = await asAdmin({ operation: "updateProduct", args: [id, { price: 18.75 }], requestId: crypto.randomUUID(), productVersion: created.result._version });
assert.equal(updated.result.price, 18.75);
await asAdmin({ operation: "deleteProduct", args: [id], requestId: crypto.randomUUID(), productVersion: updated.result._version });
assert.equal((await loadInventory()).state.products.some((p) => p.id === id), false);
console.log("PASS admin login, alta, cambio de precio y borrado en PostgreSQL");
