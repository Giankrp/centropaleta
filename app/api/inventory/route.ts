import { loadInventory } from "../../../lib/inventario/servicio.ts";
import { ensureSchema } from "../../../lib/inventario/bd.ts";
import { isAdmin } from "../../../lib/sesion.ts";
import { logError } from "../../../lib/logger.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    const admin = isAdmin(request);
    const inventario = await loadInventory();
    const state = admin
      ? inventario.state
      : {
          products: inventario.state.products.map((producto) => {
            const { min, target, barcodes, ...resto } = producto;
            void min;
            void target;
            void barcodes;
            return resto;
          }),
          sales: [],
          moves: [],
        };
    return json({ ...inventario, state, admin });
  } catch (error) {
    logError("inventario.get", error);
    return json({ error: "No se puede cargar el inventario. Vuelve a intentarlo." }, 503);
  }
}
