import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { verificarPassword } from "./usuarios.ts";

export const COOKIE = "cp_session";
const SEMANA = 60 * 60 * 24 * 7;
const ROLES = new Set(["admin", "cliente", "invitado"]);

export type Sesion = { u: string; role: string; exp: number };

function same(left: string, right: string): boolean {
  const a = createHash("sha256").update(String(left)).digest();
  const b = createHash("sha256").update(String(right)).digest();
  return timingSafeEqual(a, b);
}

export function verifyAdmin(username: string | undefined, password: string | undefined): boolean {
  const usuario = process.env.ADMIN_USERNAME || "";
  const hash = process.env.ADMIN_PASSWORD_HASH || "";
  const plano = process.env.ADMIN_PASSWORD || "";
  if (!usuario || typeof username !== "string" || typeof password !== "string") return false;
  if (!same(username.trim().toLowerCase(), usuario.trim().toLowerCase())) return false;
  if (hash) return verificarPassword(password, hash);
  if (plano) return same(password, plano);
  return false;
}

export function createSession(username: string, role = "admin"): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está configurada");
  if (!ROLES.has(role)) throw new Error("Rol de sesión inválido");
  const body = Buffer.from(
    JSON.stringify({
      u: username.trim().toLowerCase(),
      role,
      exp: Date.now() + SEMANA * 1000,
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function createGuestSession(): string {
  return createSession(`invitado-${randomUUID().replace(/-/g, "").slice(0, 12)}`, "invitado");
}

export function readToken(token: unknown): Sesion | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const esperada = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const datos = JSON.parse(Buffer.from(body, "base64url").toString()) as Sesion;
    if (
      !datos ||
      typeof datos.u !== "string" ||
      !ROLES.has(datos.role) ||
      typeof datos.exp !== "number" ||
      datos.exp < Date.now()
    )
      return null;
    return datos;
  } catch {
    return null;
  }
}

export function sessionFromRequest(request: Request): Sesion | null {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(/(?:^|;\s*)cp_session=([^;]+)/);
  if (!match) return null;
  return readToken(decodeURIComponent(match[1]));
}

export function sessionFromCookieValue(token: string | undefined | null): Sesion | null {
  if (!token || typeof token !== "string") return null;
  return readToken(token);
}

export function isAdmin(request: Request): boolean {
  return sessionFromRequest(request)?.role === "admin";
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const proto = (request.headers.get("x-forwarded-proto") || url.protocol.replace(":", ""))
    .split(",")[0]
    .trim();
  return `${proto}://${host}` === origin;
}

export function seguroDesdeHeaders(headers: Headers): boolean {
  const proto = headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return process.env.NODE_ENV === "production";
}

export function opcionesCookie(seguro: boolean, maxAge: number) {
  return { httpOnly: true, path: "/", sameSite: "lax" as const, secure: seguro, maxAge };
}

export function sessionCookie(token: string, request: Request): string {
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SEMANA}${seguroDesdeHeaders(request.headers) ? "; Secure" : ""}`;
}

export function clearCookie(request: Request): string {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${seguroDesdeHeaders(request.headers) ? "; Secure" : ""}`;
}
