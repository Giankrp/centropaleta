"use server";

import { cookies } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { sessionFromCookieValue } from "../../../lib/sesion.ts";
import { mutateInventory } from "../../../lib/inventario/servicio.ts";
import { getPool } from "../../../lib/inventario/bd.ts";
import { cambiarEstadoEncargo } from "../../../lib/encargos.ts";
import { logError } from "../../../lib/logger.ts";

export type SesionActual = ReturnType<typeof sessionFromCookieValue>;

async function sesionAdmin() {
  const store = await cookies();
  const sesion = sessionFromCookieValue(store.get("cp_session")?.value);
  if (!sesion || sesion.role !== "admin") throw new Error("Accede con la cuenta de administración");
  return sesion;
}

async function trasMutacion() {
  updateTag("inventario");
  revalidatePath("/panel", "page");
  revalidatePath("/", "layout");
}

const OPERACIONES = new Set([
  "addProduct",
  "updateProduct",
  "deleteProduct",
  "configure",
  "replenish",
  "describe",
  "configureOffer",
  "removeOffer",
  "associateCode",
  "receive",
  "sale",
  "removeBarcode",
]);

export type MutacionInventario = { operation: string; args: unknown[]; productVersion?: number };

export async function inventarioAccion(
  body: MutacionInventario,
): Promise<{ ok: true; resultado: unknown } | { ok: false; error: string }> {
  try {
    if (!OPERACIONES.has(body.operation)) throw new Error("Operación no permitida");
    await sesionAdmin();
    const estado = await mutateInventory({
      operation: body.operation,
      args: body.args,
      requestId: crypto.randomUUID(),
      ...(body.productVersion !== undefined ? { productVersion: body.productVersion } : {}),
    });
    await trasMutacion();
    return { ok: true, resultado: estado.result };
  } catch (error) {
    logError("panel.inventario", error);
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo actualizar" };
  }
}

function parseCents(valor: string): number | null {
  const convertido = String(valor || "")
    .trim()
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(convertido)) return null;
  const parts = convertido.split(".");
  const total = Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0"));
  return Number.isSafeInteger(total) ? total : null;
}

export type CobroRequest = {
  ticket: Record<string, number>;
  payment: string;
  received: string;
  token: string;
};

export async function cobrarAccion(pedido: CobroRequest): Promise<
  | {
      ok: true;
      venta: {
        id: string;
        total: number;
        change: number | null;
        lines: { qty: number; name: string }[];
      };
    }
  | { ok: false; error: string }
> {
  try {
    await sesionAdmin();
    if (!pedido.ticket || typeof pedido.ticket !== "object") throw new Error("Ticket inválido");
    if (!pedido.token || !/^[a-zA-Z0-9-]{10,100}$/.test(pedido.token))
      throw new Error("Referencia de venta inválida");
    if (!["Efectivo", "Tarjeta", "Bizum", "Otro"].includes(pedido.payment))
      throw new Error("Selecciona forma de pago");
    const received = parseCents(pedido.received);
    const estado = await mutateInventory({
      operation: "sale",
      args: [pedido.ticket, "Tienda física", pedido.payment, received, pedido.token],
      requestId: pedido.token,
    });
    await trasMutacion();
    const venta = estado.result as {
      id: string;
      total: number;
      change: number | null;
      lines: { qty: number; name: string }[];
    };
    return { ok: true, venta };
  } catch (error) {
    logError("panel.cobro", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo registrar la venta",
    };
  }
}

export async function reponerFormAccion(formData: FormData): Promise<void> {
  try {
    await sesionAdmin();
    const id = Number(formData.get("productId"));
    const qty = Number(formData.get("qty"));
    await mutateInventory({
      operation: "replenish",
      args: [id, qty],
      requestId: crypto.randomUUID(),
    });
    await trasMutacion();
  } catch (error) {
    logError("panel.reponerForm", error);
    revalidatePath("/panel", "page");
  }
}

export async function oferecerFormAccion(formData: FormData): Promise<void> {
  try {
    await sesionAdmin();
    const id = Number(formData.get("productId"));
    const percent = Number(formData.get("percent"));
    const quitar = String(formData.get("quitar") || "") === "1";
    await mutateInventory({
      operation: quitar ? "removeOffer" : "configureOffer",
      args: quitar ? [id] : [id, true, percent],
      requestId: crypto.randomUUID(),
    });
    await trasMutacion();
  } catch (error) {
    logError("panel.reponerForm", error);
    revalidatePath("/panel", "page");
  }
}

export async function estadoEncargoFormAccion(formData: FormData): Promise<void> {
  try {
    await sesionAdmin();
    await cambiarEstadoEncargo(
      String(formData.get("id")),
      String(formData.get("status")),
      String(formData.get("notes") || ""),
    );
    revalidatePath("/panel", "page");
    revalidatePath("/", "layout");
  } catch (error) {
    logError("panel.reponerForm", error);
    revalidatePath("/panel", "page");
  }
}

const ESTADOS_PEDIDO = [
  "Pendiente de pago",
  "Pagado",
  "Preparado",
  "Enviado",
  "Entregado",
  "Recogido",
];

export async function estadoPedidoFormAccion(formData: FormData): Promise<void> {
  try {
    await sesionAdmin();
    const code = String(formData.get("code"));
    const status = String(formData.get("status"));
    if (!ESTADOS_PEDIDO.includes(status)) throw new Error("Estado inválido");
    await getPool().query("UPDATE orders SET status=$2, updated_at=now() WHERE code=$1", [
      code,
      status,
    ]);
    revalidatePath("/panel", "page");
  } catch (error) {
    logError("panel.reponerForm", error);
    revalidatePath("/panel", "page");
  }
}
