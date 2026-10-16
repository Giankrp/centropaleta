"use server";

import { cookies } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  createGuestSession,
  sessionFromCookieValue,
  verifyAdmin,
  createSession,
  seguroDesdeHeaders,
  opcionesCookie,
} from "../../lib/sesion.ts";
import { permitir, registrar, reiniciar, claveDe, type Limite } from "../../lib/limitador.ts";
import { logAviso, logError } from "../../lib/logger.ts";
import {
  agregarArticulo,
  ajustarCantidad,
  quitarArticulo,
  vaciarCarrito,
  finalizarCarrito,
} from "../../lib/carrito.ts";
import { crearEncargo } from "../../lib/encargos.ts";
import {
  registrarUsuario,
  autenticarUsuario,
  guardarPerfil,
  guardarAvatar,
  alternarFavorito,
  fusionarCuenta,
} from "../../lib/usuarios.ts";
import { headers } from "next/headers";
import { getPool } from "../../lib/inventario/bd.ts";
import { loadInventory } from "../../lib/inventario/servicio.ts";
import { redirect as redirige } from "next/navigation";

const LOGIN: Limite = { max: 5, ventanaMinutos: 15, bloqueoMinutos: 15 };
const REGISTRO: Limite = { max: 5, ventanaMinutos: 60, bloqueoMinutos: 60 };
const SOLICITUDES: Limite = { max: 5, ventanaMinutos: 60, bloqueoMinutos: 60 };

async function cookieSegura(options: { maxAge: number }) {
  return opcionesCookie(seguroDesdeHeaders(await headers()), options.maxAge);
}

async function ipDe(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") || "local").split(",")[0].trim() || "local";
}

export type EstadoAccion = { error?: string; exito?: string };

async function sesionOInvitado() {
  const store = await cookies();
  const actual = sessionFromCookieValue(store.get("cp_session")?.value);
  if (actual) return actual;
  const token = createGuestSession();
  store.set("cp_session", token, await cookieSegura({ maxAge: 604800 }));
  const creada = sessionFromCookieValue(token);
  if (!creada) throw new Error("No se pudo iniciar la sesión");
  return creada;
}

async function catalogoVivo() {
  const estado = (await loadInventory()) as {
    state: {
      products: {
        id: number;
        name: string;
        stock: number;
        price: number;
        offerActive?: boolean | null;
        offerPercent?: number | null;
      }[];
    };
  };
  return { productos: estado.state.products };
}

async function cantidadActual(session: string, productId: number): Promise<number> {
  const { rows } = (await getPool().query(
    "SELECT qty FROM cart_items WHERE cart=$1 AND product_id=$2",
    [session, productId],
  )) as { rows: { qty: number }[] };
  return rows.length ? Number(rows[0].qty) : 0;
}

export async function agregarArticuloAccion(formData: FormData) {
  const productId = Number(formData.get("productId"));
  const qty = Number(formData.get("qty") || 1);
  const origen = String(formData.get("origen") || "/");
  const base = origen.split("?")[0];
  try {
    const sesion = await sesionOInvitado();
    await agregarArticulo(sesion.u, await catalogoVivo(), productId, qty);
    revalidatePath("/", "layout");
    redirect(base);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(
      base +
        "?error=" +
        encodeURIComponent(error instanceof Error ? error.message : "No se pudo añadir"),
    );
  }
}

export async function ajustarCantidadAccion(formData: FormData) {
  const sesion = await sesionOInvitado();
  const delta = Number(formData.get("delta") || 0);
  const productId = Number(formData.get("productId"));
  const catalogo = await catalogoVivo();
  const objetivo = Math.max(0, (await cantidadActual(sesion.u, productId)) + delta);
  if (objetivo === 0) await quitarArticulo(sesion.u, productId);
  else await ajustarCantidad(sesion.u, catalogo, productId, objetivo);
  revalidatePath("/carrito.ts", "page");
  revalidatePath("/", "layout");
}

export async function quitarArticuloAccion(formData: FormData) {
  const sesion = await sesionOInvitado();
  await quitarArticulo(sesion.u, Number(formData.get("productId")));
  revalidatePath("/carrito.ts", "page");
  revalidatePath("/", "layout");
}

export async function vaciarCarritoAccion() {
  const sesion = await sesionOInvitado();
  await vaciarCarrito(sesion.u);
  revalidatePath("/carrito.ts", "page");
  revalidatePath("/", "layout");
}

export async function finalizarCompraAccion(
  prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const delivery =
    String(formData.get("delivery") || "pickup") === "shipping" ? "shipping" : "pickup";
  const address = String(formData.get("address") || "");
  try {
    const sesion = await sesionOInvitado();
    const resultado = await finalizarCarrito(
      sesion.u,
      { delivery, address: delivery === "shipping" ? address : null },
      crypto.randomUUID(),
    );
    updateTag("inventario");
    revalidatePath("/", "layout");
    redirige("/pedido/" + resultado.code);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    logError("checkout", error);
    return { error: error instanceof Error ? error.message : "No se pudo completar el pedido" };
  }
  return { exito: "Pedido registrado" };
}

export async function crearEncargoAccion(
  prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const claveSolicitud = claveDe(await ipDe(), "solicitudes");
  if (!(await permitir(claveSolicitud, SOLICITUDES))) {
    logAviso("solicitudes.limitado", {});
    return { error: "Has enviado demasiadas solicitudes. Espera un rato." };
  }
  await registrar(claveSolicitud, SOLICITUDES);
  try {
    const sesion = await sesionOInvitado();
    const fotos = await fotosDe(formData);
    const id = await crearEncargo({
      kind: "encargo",
      product: String(formData.get("product") || ""),
      universe: String(formData.get("universe") || "") || undefined,
      quantity: Number(formData.get("quantity") || 1),
      budgetCents: Math.round(Number(formData.get("budget") || 0) * 100),
      url: String(formData.get("url") || "") || undefined,
      notes: String(formData.get("notes") || "") || undefined,
      customer: sesion.role === "cliente" ? sesion.u : null,
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || "") || undefined,
      customerProfile: {
        session: sesion.u,
        name: String(formData.get("customerName") || "") || undefined,
      },
      fotos,
    });
    revalidatePath("/", "layout");
    return { exito: id };
  } catch (error) {
    logError("encargo.crear", error);
    return { error: error instanceof Error ? error.message : "No se pudo enviar la solicitud" };
  }
}

export async function crearPropuestaVentaAccion(
  prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const claveSolicitud = claveDe(await ipDe(), "solicitudes");
  if (!(await permitir(claveSolicitud, SOLICITUDES))) {
    logAviso("solicitudes.limitado", {});
    return { error: "Has enviado demasiadas solicitudes. Espera un rato." };
  }
  await registrar(claveSolicitud, SOLICITUDES);
  try {
    const sesion = await sesionOInvitado();
    const fotos = await fotosDe(formData);
    const id = await crearEncargo({
      kind: "venta",
      product: String(formData.get("name") || ""),
      universe: String(formData.get("universe") || "") || undefined,
      productType: String(formData.get("productType") || "") || undefined,
      setName: String(formData.get("set") || "") || undefined,
      condition: String(formData.get("condition") || "") || undefined,
      priceCents: Math.round(Number(formData.get("price") || 0) * 100),
      notes: String(formData.get("notes") || "") || undefined,
      customer: sesion.role === "cliente" ? sesion.u : null,
      customerProfile: { session: sesion.u },
      fotos,
    });
    revalidatePath("/", "layout");
    return { exito: id };
  } catch (error) {
    logError("venta.propuesta", error);
    return { error: error instanceof Error ? error.message : "No se pudo enviar la propuesta" };
  }
}

async function fotosDe(formData: FormData): Promise<string[]> {
  const fotos: string[] = [];
  for (const archivo of formData.getAll("photos")) {
    if (!(archivo instanceof File) || !archivo.size) continue;
    const bytes = Buffer.from(await archivo.arrayBuffer());
    fotos.push(`data:${archivo.type};base64,${bytes.toString("base64")}`);
  }
  return fotos;
}

export async function entrarAccion(prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const username = String(formData.get("username") || "");
  const password = String(formData.get("password") || "");
  if (!username || !password) return { error: "Rellena usuario y contraseña" };
  const clave = claveDe(await ipDe(), "login", username);
  if (!(await permitir(clave, LOGIN))) {
    logAviso("auth.limitado", { usuario: username.slice(0, 40) });
    return { error: "Demasiados intentos fallidos. Espera 15 minutos." };
  }
  const esAdmin = verifyAdmin(username, password);
  const perfil = await autenticarUsuario(username, password);
  if (!esAdmin && !perfil) {
    await registrar(clave, LOGIN);
    logAviso("auth.fallido", { usuario: username.slice(0, 40) });
    return { error: "Usuario o contraseña incorrectos" };
  }
  await reiniciar(clave);
  const store = await cookies();
  const previa = sessionFromCookieValue(store.get("cp_session")?.value);
  const nombreSesion = perfil ? perfil.username : username.trim().toLowerCase();
  if (previa?.role === "invitado") {
    try {
      await fusionarCuenta(previa.u, nombreSesion);
    } catch (error) {
      logError("auth.fusion", error);
    }
  }
  store.set(
    "cp_session",
    createSession(nombreSesion, esAdmin ? "admin" : "cliente"),
    await cookieSegura({ maxAge: 604800 }),
  );
  revalidatePath("/", "layout");
  redirige(esAdmin ? "/panel.html" : "/cuenta");
  return { exito: "Bienvenido" };
}

export async function registrarAccion(
  prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const clave = claveDe(await ipDe(), "registro");
  if (!(await permitir(clave, REGISTRO))) {
    logAviso("registro.limitado", {});
    return { error: "Demasiados registros desde esta conexión. Espera un rato." };
  }
  let perfil: Awaited<ReturnType<typeof registrarUsuario>>;
  try {
    perfil = await registrarUsuario(
      String(formData.get("username") || ""),
      String(formData.get("password") || ""),
      String(formData.get("confirm") || ""),
    );
  } catch (error) {
    await registrar(clave, REGISTRO);
    return { error: error instanceof Error ? error.message : "No se pudo crear la cuenta" };
  }
  await reiniciar(clave);
  const store = await cookies();
  const previa = sessionFromCookieValue(store.get("cp_session")?.value);
  if (previa?.role === "invitado") {
    try {
      await fusionarCuenta(previa.u, perfil.username);
    } catch (error) {
      logError("registro.fusion", error);
    }
  }
  store.set(
    "cp_session",
    createSession(perfil.username, "cliente"),
    await cookieSegura({ maxAge: 604800 }),
  );
  revalidatePath("/", "layout");
  redirige("/cuenta");
  return { exito: "Cuenta creada" };
}

export async function salirAccion(): Promise<void> {
  const store = await cookies();
  store.delete("cp_session");
  revalidatePath("/", "layout");
  redirige("/cuenta");
}

export async function guardarPerfilAccion(
  prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    const sesion = await sesionOInvitado();
    if (sesion.role !== "cliente") return { error: "Inicia sesión como cliente" };
    await guardarPerfil(sesion.u, {
      displayName: String(formData.get("displayName") || ""),
      contactEmail: String(formData.get("contactEmail") || ""),
      contactPhone: String(formData.get("contactPhone") || ""),
      address: String(formData.get("address") || ""),
    });
    revalidatePath("/cuenta", "page");
    return { exito: "Perfil guardado" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar el perfil" };
  }
}

export async function guardarAvatarAccion(formData: FormData): Promise<void> {
  const sesion = await sesionOInvitado();
  if (sesion.role !== "cliente") return;
  await guardarAvatar(sesion.u, String(formData.get("avatar") || "coral"));
  revalidatePath("/cuenta", "page");
  revalidatePath("/", "layout");
}

export async function alternarFavoritoAccion(formData: FormData): Promise<void> {
  const sesion = await sesionOInvitado();
  if (sesion.role !== "cliente" && sesion.role !== "invitado") return;
  const productId = Number(formData.get("productId"));
  if (!Number.isSafeInteger(productId) || productId < 1) return;
  await alternarFavorito(sesion.u, productId);
  revalidatePath("/", "layout");
}
