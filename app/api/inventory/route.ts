import { loadInventory, mutateInventory } from "../../../lib/inventario/servicio.ts";
import { ensureSchema } from "../../../lib/inventario/bd.ts";
import { isAdmin, sameOrigin } from "../../../lib/sesion.ts";
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
    const inventario = await loadInventory();
    const state = admin ? inventario.state : {
      products: inventario.state.products.map((producto) => {
        const { min, target, barcodes, ...resto } = producto;
        void min; void target; void barcodes;
        return resto;
      }),
      sales: [],
      moves: [],
    };
    return json({ ...inventario, state, admin });
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
    const result = await mutateInventory(JSON.parse(text) as Parameters<typeof mutateInventory>[0]);
    revalidateTag("inventario", "max");
    return json({ ...result, admin: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "No se pudo guardar" }, 400);
  }
}
