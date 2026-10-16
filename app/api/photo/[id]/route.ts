import { ensureSchema, getPool } from "../../../../lib/pg-store.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return new Response(null, { status: 404 });
    await ensureSchema();
    const { rows } = (await getPool().query(
      "SELECT payload FROM inventory_records WHERE kind='product' AND key=$1",
      [`product:${id}`],
    )) as { rows: { payload: string }[] };
    const photo = rows.length ? (JSON.parse(rows[0].payload) as { photo?: string | null }).photo : null;
    if (!photo) return new Response(null, { status: 404 });
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(photo);
    if (!match) return new Response(null, { status: 404 });
    return new Response(Buffer.from(match[2], "base64"), {
      headers: {
        "Content-Type": `image/${match[1]}`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
