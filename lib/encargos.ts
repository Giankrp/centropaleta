import { randomUUID } from "node:crypto";
import { getPool, ensureSchema } from "./pg-store.js";

export type FormularioEncargo = {
  kind: "encargo" | "venta";
  product: string;
  universe?: string;
  quantity?: number;
  budgetCents?: number | null;
  productType?: string;
  setName?: string;
  condition?: string;
  priceCents?: number | null;
  url?: string;
  notes?: string;
  customer?: string;
  email?: string;
  phone?: string;
  customerProfile?: unknown;
  fotos: string[];
};

const LIMITE_FOTO = 700000;

function setCentsS(value: unknown): number | null {
  const patron = String(value == null ? "" : value).trim().replace(",", ".");
  if (!patron) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(patron)) return null;
  const cents = Math.round(Number(patron) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export async function crearEncargo(input: FormularioEncargo): Promise<string> {
  if (input.kind !== "encargo" && input.kind !== "venta") throw new Error("Tipo de solicitud inválido");
  const product = String(input.product || "").trim();
  if (!product || product.length > 180) throw new Error("Describe el producto (máximo 180 caracteres)");
  const quantity = Number.isSafeInteger(input.quantity) && (input.quantity as number) >= 1 && (input.quantity as number) <= 999 ? input.quantity : 1;
  if (input.notes && String(input.notes).length > 2000) throw new Error("Los detalles admiten hasta 2000 caracteres");
  if (input.url && String(input.url).length > 1000) throw new Error("El enlace es demasiado largo");
  if (input.url && !/^https?:\/\//.test(String(input.url))) throw new Error("El enlace debe empezar por http(s)");
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email))) throw new Error("Correo electrónico inválido");
  if (input.fotos.length > 6) throw new Error("Añade como máximo 6 fotografías");
  for (const foto of input.fotos) {
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(foto)) throw new Error("Hay una imagen con formato inválido");
    if (foto.length > LIMITE_FOTO) throw new Error("Una de las imágenes es demasiado grande");
  }
  const email = input.email ? String(input.email).trim() : null;
  const phone = input.phone ? String(input.phone).trim() : null;
  if (input.kind === "encargo" && !email) throw new Error("Indica tu correo electrónico para poder contactarte");
  await ensureSchema();
  const id = "ENC-" + randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  await getPool().query(
    `INSERT INTO encargos(id, kind, product, universe, quantity, product_type, set_name, condition, budget_cents, price_cents, url, notes, customer, email, phone, customer_profile, photos, status)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'Pendiente')`,
    [id, input.kind, product, input.universe ?? null, quantity, input.productType ?? null, input.setName ?? null, input.condition ?? null, input.budgetCents ?? null, input.priceCents ?? null, input.url ?? null, input.notes ?? null, input.customer ?? null, email, phone, input.customerProfile ? JSON.stringify(input.customerProfile) : null, JSON.stringify(input.fotos)],
  );
  return id;
}

export async function cambiarEstadoEncargo(id: string, status: string, adminNotes: string): Promise<void> {
  if (!["Pendiente", "En revisión", "Contactado", "Completado", "Cancelado"].includes(status)) throw new Error("Estado inválido");
  if (adminNotes.length > 3000) throw new Error("Las notas admiten hasta 3000 caracteres");
  await getPool().query("UPDATE encargos SET status=$2, admin_notes=$3, updated_at=now() WHERE id=$1", [id, status, adminNotes]);
}
