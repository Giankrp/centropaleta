import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ensureSchema, getPool } from "../lib/inventario/bd.ts";
import { mutateInventory, loadInventory } from "../lib/inventario/servicio.ts";
import {
  registrarUsuario,
  autenticarUsuario,
  validarCredenciales,
  guardarPerfil,
  guardarAvatar,
  favoritosDe,
  alternarFavorito,
  fusionarCuenta,
} from "../lib/usuarios.ts";
import { agregarArticulo, finalizarCarrito } from "../lib/carrito.ts";
import { crearEncargo } from "../lib/encargos.ts";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

assert.notEqual(validarCredenciales("ab", "Larga1234"), null);
assert.notEqual(validarCredenciales("usuario-válido", "Corto1"), null);
assert.notEqual(validarCredenciales("usuario", "sololetras"), null);
assert.equal(
  validarCredenciales("usuario-1", "Larga1234", "Diferente456"),
  "Las contraseñas no coinciden",
);
assert.equal(validarCredenciales("usuario-1", "Larga1234"), null);

await ensureSchema();
const usuario = "prueba-cliente-" + crypto.randomUUID().slice(0, 6);
const creado = await registrarUsuario(usuario, "Minimo8x1", "Minimo8x1");
assert.equal(creado.username, usuario);
await assert.rejects(() => registrarUsuario(usuario, "Minimo8x1"), /ya está en uso/);
const perfil = await autenticarUsuario(usuario.toUpperCase(), "Minimo8x1");
assert.ok(perfil);
assert.equal(await autenticarUsuario(usuario, "Incorrecta99"), null);

const actualizado = await guardarPerfil(usuario, {
  displayName: "Ana Pirata",
  contactEmail: "ana@test.es",
  contactPhone: "694930316",
  address: "Calle Oeste 10",
});
assert.equal(actualizado.displayName, "Ana Pirata");
const conAvatar = await guardarAvatar(usuario, "lila");
assert.equal(conAvatar.avatar, "lila");
assert.rejects(() => guardarPerfil(usuario, { displayName: "", avatar: "sol" }), /avatar/);

const alta = await mutateInventory({
  operation: "addProduct",
  args: [
    {
      name: "Fusión Test",
      description: "t",
      cat: "Pokémon",
      type: "cartas-raw",
      set: "T",
      code: `fus${Date.now()}`,
      price: 4,
      stock: 5,
      min: 1,
      target: 3,
    },
  ],
  requestId: crypto.randomUUID(),
});
const produit = alta.result.id;
const guest = "invitado-fusion" + crypto.randomUUID().slice(0, 8);
await agregarArticulo(guest, { productos: [alta.result] }, produit, 2);
const encargoGuest = await crearEncargo({
  kind: "encargo",
  product: "Caja fusion",
  email: "inv@test.es",
  customerProfile: { session: guest },
  fotos: [],
});
const pedidoGuest = await finalizarCarrito(
  guest,
  { delivery: "pickup", address: null },
  crypto.randomUUID(),
);
assert.match(pedidoGuest.code, /^CP-/);

await agregarArticulo(guest, { productos: [alta.result] }, produit, 2);
await fusionarCuenta(guest, usuario);

const favoritosNuevos = await alternarFavorito(usuario, produit);
assert.equal(favoritosNuevos, true);
assert.deepEqual(await favoritosDe(usuario), [produit]);
assert.equal(await alternarFavorito(usuario, produit), false);
assert.deepEqual(await favoritosDe(usuario), []);

const { rows: carritoFusionado } = await getPool().query(
  "SELECT product_id, qty FROM cart_items WHERE cart=$1",
  [usuario],
);
assert.equal(carritoFusionado.length, 1);
assert.equal(carritoFusionado[0].product_id, produit);
const { rows: pedidosFusion } = await getPool().query(
  "SELECT customer, code FROM orders WHERE code=$1",
  [pedidoGuest.code],
);
assert.equal(pedidosFusion[0].customer, usuario);
const { rows: encargoFusion } = await getPool().query("SELECT customer FROM encargos WHERE id=$1", [
  encargoGuest,
]);
assert.equal(encargoFusion[0].customer, usuario);

const estadoFinal = await loadInventory();
const versionActual = estadoFinal.state.products.find((p) => p.id === produit)._version;
await mutateInventory({
  operation: "deleteProduct",
  args: [produit],
  requestId: crypto.randomUUID(),
  productVersion: versionActual,
});
await getPool().query("DELETE FROM users WHERE username=$1", [usuario]);
console.log(
  "PASS cuenta: registro/login scrypt, perfil y avatar, fusión carrito/pedidos/encargos y favoritos",
);
