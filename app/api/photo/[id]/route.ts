import { ensureSchema, getPool } from "../../../../lib/inventario/bd.ts";
import { logError } from "../../../../lib/logger.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return new Response(null, { status: 404 });
    await ensureSchema();
    const { rows } = await getPool().query("SELECT mime, data FROM photos WHERE product_id=$1", [
      Number(id),
    ]);
    const foto = rows[0] as { mime: string; data: string } | undefined;
    if (!foto) return new Response(null, { status: 404 });
    return new Response(Buffer.from(foto.data, "base64"), {
      headers: {
        "Content-Type": foto.mime,
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable",
      },
    });
  } catch (error) {
    logError("foto.get", error);
    return new Response(null, { status: 404 });
  }
}
