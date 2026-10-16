import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureSchema, inventoryDb } from "../lib/pg-store.js";
import { loadInventory, mutateInventory } from "../lib/inventory-service.js";

for (const line of readFileSync(join(process.cwd(), ".env"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL en .env o en el entorno");
  process.exit(1);
}

const source = readFileSync(join(process.cwd(), "public/products.js"), "utf8");
const CPProducts = new Function(`${source};return CPProducts`)();
const stocks = [20, 20, 15, 4, 6], mins = [5, 5, 5, 3, 3], targets = [24, 24, 20, 8, 10];
const items = CPProducts.map((p, i) => ({ ...p, stock: stocks[i] ?? 10, min: mins[i] ?? 3, target: targets[i] ?? 10, code: "CP-" + String(p.id).padStart(3, "0") }));

await ensureSchema();
const db = inventoryDb();
const result = await mutateInventory(db, { operation: "importProducts", args: [items], requestId: crypto.randomUUID() });
const state = (await loadInventory(db)).state;
console.log(`Importados ${result.result?.imported ?? 0} productos de prueba. Total en catálogo: ${state.products.length}`);
if (state.products.length !== items.length) {
  console.error("El catálogo no quedó igual al del seed; revisa si no estaba vacío al ejecutar");
  process.exit(1);
}
