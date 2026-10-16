export { ensureSchema, inventoryDb } from "../lib/pg-store.js";

export function getDb() {
  throw new Error("D1 ya no se usa. El inventario usa PostgreSQL mediante DATABASE_URL.");
}
