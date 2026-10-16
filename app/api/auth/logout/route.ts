import { clearCookie, sameOrigin } from "../../../../lib/session.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origen de solicitud inválido" }, { status: 403 });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": clearCookie(request) } });
}
