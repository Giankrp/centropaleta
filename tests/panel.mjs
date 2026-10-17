import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSession } from "../lib/sesion.ts";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const home = "http://127.0.0.1:8000";
const sinSesion = await fetch(`${home}/panel`, { redirect: "manual" });
assert.equal(sinSesion.status, 307, "sin sesión redirige a /cuenta");
assert.equal(sinSesion.headers.get("location"), "/cuenta");

const cookieAdmin =
  "cp_session=" + createSession(process.env.ADMIN_USERNAME || "centropaleta", "admin");
const panel = await fetch(`${home}/panel`, { headers: { cookie: cookieAdmin } });
assert.equal(panel.status, 200);
const html = await panel.text();
assert.ok(html.includes("GESTIÓN DE TIENDA"), "header del panel");
assert.ok(html.includes("Venta física"), "tab venta");
assert.ok(html.includes("pos-product") || html.includes("MOSTRADOR"), "POS visible");
assert.ok(html.includes("Venta física"), "pestaña del panel");

const otros = await Promise.all(
  ["inventario", "reposicion", "ofertas", "encargos", "pedidos", "historial"].map(async (tab) => {
    const respuesta = await fetch(`${home}/panel?tab=${tab}`, { headers: { cookie: cookieAdmin } });
    assert.equal(respuesta.status, 200, "tab " + tab);
    return tab;
  }),
);
assert.equal(otros.length, 6);
const pedidos = await (
  await fetch(`${home}/panel?tab=pedidos`, { headers: { cookie: cookieAdmin } })
).text();
assert.ok(pedidos.includes("Pedidos online"));
console.log("PASS panel: guard admin, tabs server-side (HTTP)");
