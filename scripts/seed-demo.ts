import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureSchema } from "../lib/inventario/bd.ts";
import { loadInventory, mutateInventory } from "../lib/inventario/servicio.ts";
import { products } from "../lib/demo-products.ts";

for (const line of readFileSync(join(process.cwd(), ".env"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL en .env o en el entorno");
  process.exit(1);
}

const stocks = [20, 20, 15, 4, 6],
  mins = [5, 5, 5, 3, 3],
  targets = [24, 24, 20, 8, 10];
const items = products.map((p, i) => ({
  ...p,
  stock: stocks[i] ?? 10,
  min: mins[i] ?? 3,
  target: targets[i] ?? 10,
  code: "CP-" + String(p.id).padStart(3, "0"),
}));

await ensureSchema();
const result = await mutateInventory({
  operation: "importProducts",
  args: [items],
  requestId: crypto.randomUUID(),
});
const state = (await loadInventory()).state;
console.log(
  `Importados ${(result.result as { imported?: number } | null)?.imported ?? 0} productos de prueba. Total en catálogo: ${state.products.length}`,
);
if (state.products.length !== items.length) {
  console.error("El catálogo no quedó igual al del seed; revisa si no estaba vacío al ejecutar");
  process.exit(1);
}
