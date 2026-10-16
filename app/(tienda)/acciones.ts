"use server";

import { cookies } from "next/headers";
import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createGuestSession, sessionFromCookieValue } from "../../lib/session.js";
import { agregarArticulo, ajustarCantidad, quitarArticulo, vaciarCarrito, finalizarCarrito } from "../../lib/carrito.ts";
import { crearEncargo } from "../../lib/encargos.ts";
import { getPool, inventoryDb } from "../../lib/pg-store.js";
import { loadInventory } from "../../lib/inventory-service.js";
import { redirect as redirige } from "next/navigation";

export type EstadoAccion = { error?: string; exito?: string };

async function sesionOInvitado() {
  const store = await cookies();
  const actual = sessionFromCookieValue(store.get("cp_session")?.value);
  if (actual) return actual;
  const token = createGuestSession();
  store.set("cp_session", token, { httpOnly: true, path: "/", sameSite: "lax", maxAge: 604800 });
  const creada = sessionFromCookieValue(token);
  if (!creada) throw new Error("No se pudo iniciar la sesión");
  return creada;
}

async function catalogoVivo() {
  const estado = (await loadInventory(inventoryDb())) as { state: { products: { id: number; name: string; stock: number; price: number; offerActive?: boolean | null; offerPercent?: number | null }[] } };
  return { productos: estado.state.products };
}

async function cantidadActual(session: string, productId: number): Promise<number> {
  const { rows } = (await getPool().query("SELECT qty FROM cart_items WHERE cart=$1 AND product_id=$2", [session, productId])) as { rows: { qty: number }[] };
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
    redirect(base + "?error=" + encodeURIComponent(error instanceof Error ? error.message : "No se pudo añadir"));
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

export async function finalizarCompraAccion(prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const delivery = String(formData.get("delivery") || "pickup") === "shipping" ? "shipping" : "pickup";
  const address = String(formData.get("address") || "");
  try {
    const sesion = await sesionOInvitado();
    const resultado = await finalizarCarrito(sesion.u, { delivery, address: delivery === "shipping" ? address : null }, crypto.randomUUID());
    updateTag("inventario");
    revalidatePath("/", "layout");
    redirige("/pedido/" + resultado.code);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "No se pudo completar el pedido" };
  }
  return { exito: "Pedido registrado" };
}

export async function crearEncargoAccion(prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
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
      customer: String(formData.get("customerName") || ""),
      email: String(formData.get("email") || ""),
      phone: String(formData.get("phone") || "") || undefined,
      customerProfile: { session: sesion.u },
      fotos,
    });
    revalidatePath("/", "layout");
    return { exito: id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo enviar la solicitud" };
  }
}

export async function crearPropuestaVentaAccion(prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
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
      customerProfile: { session: sesion.u },
      fotos,
    });
    revalidatePath("/", "layout");
    return { exito: id };
  } catch (error) {
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
