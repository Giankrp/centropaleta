import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getPool, ensureSchema } from "./inventario/bd.ts";

export type Perfil = {
  username: string;
  displayName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  avatar: string;
};

const PATRON_USUARIO = /^[a-zA-Z0-9._-]{3,30}$/;

export function hashDePassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}

export function verificarPassword(password: string, almacen: string): boolean {
  const [salt, hash] = almacen.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validarCredenciales(
  username?: string,
  password?: string,
  confirm?: string,
): string | null {
  if (!username || !PATRON_USUARIO.test(username.trim()))
    return "El nombre de usuario admite 3–30 caracteres entre letras, números, puntos, guiones y _";
  if (!password || password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password))
    return "La contraseña necesita 8+ caracteres con letras y números";
  if (confirm !== undefined && password !== confirm) return "Las contraseñas no coinciden";
  return null;
}

export async function registrarUsuario(
  username: string,
  password: string,
  confirm?: string,
): Promise<Perfil> {
  const problema = validarCredenciales(username, password, confirm);
  if (problema) throw new Error(problema);
  const nombre = username.trim().toLowerCase();
  await ensureSchema();
  try {
    await getPool().query("INSERT INTO users(username, password_hash) VALUES($1,$2)", [
      nombre,
      hashDePassword(password),
    ]);
  } catch {
    throw new Error("Ese nombre de usuario ya está en uso");
  }
  return {
    username: nombre,
    displayName: null,
    contactEmail: null,
    contactPhone: null,
    address: null,
    avatar: "coral",
  };
}

export async function autenticarUsuario(
  username: string,
  password: string,
): Promise<Perfil | null> {
  if (!username || !password) return null;
  await ensureSchema();
  const { rows } = await getPool().query("SELECT * FROM users WHERE username=$1", [
    username.trim().toLowerCase(),
  ]);
  if (!rows.length) return null;
  const fila = rows[0] as {
    username: string;
    password_hash: string;
    display_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    avatar: string | null;
  };
  if (!verificarPassword(password, fila.password_hash)) return null;
  return {
    username: fila.username,
    displayName: fila.display_name,
    contactEmail: fila.contact_email,
    contactPhone: fila.contact_phone,
    address: fila.address,
    avatar: fila.avatar || "coral",
  };
}

export async function perfilDe(username: string): Promise<Perfil | null> {
  await ensureSchema();
  const { rows } = await getPool().query("SELECT * FROM users WHERE username=$1", [
    username.trim().toLowerCase(),
  ]);
  if (!rows.length) return null;
  const fila = rows[0] as {
    username: string;
    display_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    avatar: string | null;
  };
  return {
    username: fila.username,
    displayName: fila.display_name,
    contactEmail: fila.contact_email,
    contactPhone: fila.contact_phone,
    address: fila.address,
    avatar: fila.avatar || "coral",
  };
}

export type DatosPerfil = {
  displayName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  avatar?: string;
};

export async function guardarPerfil(username: string, datos: DatosPerfil): Promise<Perfil> {
  if (datos.avatar != null) throw new Error("Guarda el avatar desde el perfil de la tienda");
  const nombre = String(datos.displayName || "").trim();
  if (nombre.length > 100) throw new Error("El nombre admite hasta 100 caracteres");
  const email = String(datos.contactEmail || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Correo electrónico inválido");
  const phone = String(datos.contactPhone || "").trim();
  if (phone.length > 40) throw new Error("El teléfono admite hasta 40 caracteres");
  const address = String(datos.address || "").trim();
  if (address.length > 300) throw new Error("La dirección admite hasta 300 caracteres");
  await getPool().query(
    `UPDATE users SET display_name=COALESCE($2, display_name), contact_email=$3, contact_phone=$4, address=$5, updated_at=now() WHERE username=$1`,
    [username.trim().toLowerCase(), nombre || null, email || null, phone || null, address || null],
  );
  const perfil = await perfilDe(username);
  if (!perfil) throw new Error("Perfil desconocido");
  return perfil;
}

async function fusionarCarrito(guest: string, username: string) {
  await ensureSchema();
  await getPool().query(
    "INSERT INTO carts(session, owner) VALUES($1,$2) ON CONFLICT (session) DO UPDATE SET owner=$2, updated_at=now()",
    [username, username],
  );
  await getPool().query(
    `INSERT INTO cart_items(cart, product_id, qty)
     SELECT $2, product_id, qty FROM cart_items WHERE cart=$1
     ON CONFLICT (cart, product_id) DO UPDATE SET qty = GREATEST(cart_items.qty, EXCLUDED.qty)`,
    [guest, username],
  );
  await getPool().query("DELETE FROM carts WHERE session=$1", [guest]);
}

async function fusionarSolicitudes(guest: string, username: string) {
  await getPool().query(
    "UPDATE encargos SET customer=$2, customer_profile=jsonb_set(COALESCE(customer_profile,'{}'::jsonb), '{session}', to_jsonb($2::text)) WHERE customer_profile->>'session'=$1",
    [guest, username],
  );
}

async function fusionarPedidos(guest: string, username: string) {
  await getPool().query(
    "UPDATE orders SET customer=$2 WHERE session=$1 AND (customer IS NULL OR customer='')",
    [guest, username],
  );
}

export async function fusionarCuenta(guestSession: string, username: string) {
  await fusionarCarrito(guestSession, username);
  await fusionarSolicitudes(guestSession, username);
  await fusionarPedidos(guestSession, username);
}

export async function guardarAvatar(username: string, avatar: string): Promise<Perfil> {
  await getPool().query("UPDATE users SET avatar=$2, updated_at=now() WHERE username=$1", [
    username.trim().toLowerCase(),
    avatar,
  ]);
  const perfil = await perfilDe(username);
  if (!perfil) throw new Error("Perfil desconocido");
  return perfil;
}

export async function favoritosDe(username: string): Promise<number[]> {
  await ensureSchema();
  const { rows } = await getPool().query("SELECT product_id FROM favorites WHERE username=$1", [
    username.trim().toLowerCase(),
  ]);
  return (rows as unknown as { product_id: number }[]).map((fila) => Number(fila.product_id));
}

export async function alternarFavorito(username: string, productId: number): Promise<boolean> {
  const { rows } = await getPool().query(
    "SELECT 1 AS existe FROM favorites WHERE username=$1 AND product_id=$2",
    [username, productId],
  );
  if (rows.length) {
    await getPool().query("DELETE FROM favorites WHERE username=$1 AND product_id=$2", [
      username,
      productId,
    ]);
    return false;
  }
  await getPool().query(
    "INSERT INTO favorites(username, product_id) VALUES($1,$2) ON CONFLICT (username, product_id) DO NOTHING",
    [username, productId],
  );
  return true;
}
