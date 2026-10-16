import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const COOKIE = "cp_session";
const WEEK = 60 * 60 * 24 * 7;
const ROLES = new Set(["admin", "cliente", "invitado"]);

function same(left, right) {
  const a = createHash("sha256").update(String(left)).digest();
  const b = createHash("sha256").update(String(right)).digest();
  return timingSafeEqual(a, b);
}

export function verifyAdmin(username, password) {
  const expectedUser = process.env.ADMIN_USERNAME || "";
  const expectedPass = process.env.ADMIN_PASSWORD || "";
  if (!expectedUser || !expectedPass || typeof username !== "string" || typeof password !== "string") return false;
  return same(username.trim().toLowerCase(), expectedUser.trim().toLowerCase()) && same(password, expectedPass);
}

export function createSession(username, role = "admin") {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está configurada");
  if (!ROLES.has(role)) throw new Error("Rol de sesión inválido");
  const body = Buffer.from(JSON.stringify({
    u: username.trim().toLowerCase(),
    role,
    exp: Date.now() + WEEK * 1000,
  })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function createGuestSession() {
  return createSession(`invitado-${randomUUID().replace(/-/g, "").slice(0, 12)}`, "invitado");
}

export function readToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!data || !ROLES.has(data.role) || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionFromRequest(request) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(/(?:^|;\s*)cp_session=([^;]+)/);
  if (!match) return null;
  return readToken(decodeURIComponent(match[1]));
}

export function sessionFromCookieValue(token) {
  if (!token || typeof token !== "string") return null;
  return readToken(token);
}

export function isAdmin(request) {
  return sessionFromRequest(request)?.role === "admin";
}

export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const proto = (request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")).split(",")[0].trim();
  return `${proto}://${host}` === origin;
}

function secure(request) {
  return new URL(request.url).protocol === "https:";
}

export function sessionCookie(token, request) {
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${WEEK}${secure(request) ? "; Secure" : ""}`;
}

export function clearCookie(request) {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure(request) ? "; Secure" : ""}`;
}
