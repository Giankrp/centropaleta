import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGuestSession, createSession, isAdmin, readToken } from "../lib/sesion.ts";
import { ensureSchema } from "../lib/inventario/bd.ts";
import { mutateInventory } from "../lib/inventario/servicio.ts";
import { GET as photoGet } from "../app/api/photo/[id]/route.ts";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4z8AAAAMBAQCc479ZAAAAAElFTkSuQmCC";

assert.throws(() => createSession("x", "superadmin"), /Rol/);
const guest = readToken(createGuestSession());
assert.equal(guest.role, "invitado");
assert.match(guest.u, /^invitado-/);
const adminCookie = `cp_session=${createSession("centropaleta")}`;
const guestCookie = `cp_session=${createGuestSession()}`;
assert.equal(isAdmin(new Request("http://x/", { headers: { cookie: adminCookie } })), true);
assert.equal(isAdmin(new Request("http://x/", { headers: { cookie: guestCookie } })), false);
assert.equal(readToken(adminCookie.slice(11) + "x"), null);

await ensureSchema();
const created = await mutateInventory({
  operation: "addProduct",
  args: [
    {
      name: "Producto con foto",
      description: "test",
      cat: "Pokémon",
      type: "cartas",
      set: "T1",
      code: `fot${Date.now()}`,
      price: 1.5,
      stock: 1,
      min: 1,
      target: 2,
      photo: PHOTO,
    },
  ],
  requestId: crypto.randomUUID(),
});
const id = String(created.result.id);
const ok = await photoGet(new Request(`http://x/api/photo/${id}`), {
  params: Promise.resolve({ id }),
});
assert.equal(ok.status, 200);
assert.equal(ok.headers.get("content-type"), "image/webp");
assert.match(ok.headers.get("cache-control"), /immutable/);
assert.match(ok.headers.get("cache-control"), /s-maxage=31536000/);
const bytes = Buffer.from(await ok.arrayBuffer());
assert.ok(bytes.length > 0, "la foto servida no debería estar vacía");
const missing = await photoGet(new Request("http://x/api/photo/999999"), {
  params: Promise.resolve({ id: "999999" }),
});
assert.equal(missing.status, 404);
await mutateInventory({
  operation: "deleteProduct",
  args: [Number(id)],
  requestId: crypto.randomUUID(),
  productVersion: created.result._version,
});
console.log("PASS foto cacheado (bytes/type/immutable/404) y sesiones por rol");
