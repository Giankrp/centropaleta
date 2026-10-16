import { createSession, sameOrigin, sessionCookie, verifyAdmin } from "../../../../lib/sesion.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(value: unknown, status = 200, cookie?: string) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return Response.json(value, { status, headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request) || !request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "Origen de solicitud inválido" }, 403);
  }
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Solicitud inválida" }, 400);
  }
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!verifyAdmin(username, password)) return json({ error: "Usuario o contraseña incorrectos" }, 401);
  try {
    const token = createSession(username);
    return json({ username: username.trim().toLowerCase(), role: "admin" }, 200, sessionCookie(token, request));
  } catch {
    return json({ error: "El acceso de administrador no está configurado" }, 503);
  }
}
