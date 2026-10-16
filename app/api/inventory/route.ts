import { loadInventory, mutateInventory } from "../../../lib/inventory-service.js";
import { ensureSchema, inventoryDb } from "../../../lib/pg-store.js";
import { isAdmin, sameOrigin } from "../../../lib/session.js";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const admin = isAdmin(request);
    const result = await loadInventory(inventoryDb()) as {
      state: { products: Record<string, unknown>[]; sales: unknown[]; moves: unknown[]; nextProductId: number };
      revision: number;
    };
    if (!admin) {
      result.state = {
        products: result.state.products.map((p: Record<string, unknown>) => {
          const { min, target, barcodes, ...product } = p;
          return product;
        }),
        sales: [],
        moves: [],
        nextProductId: 0,
      };
    }
    return json({ ...result, admin });
  } catch {
    return json({ error: "No se puede cargar el inventario. Vuelve a intentarlo." }, 503);
  }
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return json({ error: "Accede con la cuenta propietaria de Centro Paleta para modificar el inventario." }, 403);
  if (!sameOrigin(request) || !request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Origen de solicitud inválido" }, 403);
  if (Number(request.headers.get("content-length")) > 12_000_000) return json({ error: "Solicitud demasiado grande" }, 413);
  try {
    const text = await request.text();
    if (text.length > 12_000_000) return json({ error: "Solicitud demasiado grande" }, 413);
    await ensureSchema();
    const result = await mutateInventory(inventoryDb(), JSON.parse(text));
    revalidateTag("inventario", "max");
    return json({ ...result, admin: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "No se pudo guardar" }, 400);
  }
}
