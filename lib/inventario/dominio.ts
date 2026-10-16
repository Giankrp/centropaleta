import { z, ZodError } from "zod";

export const UNIVERSES = ["Pokémon", "One Piece", "Lorcana", "Dragon Ball", "Naruto", "Otro TCG"] as const;
export const TIPOS = ["cartas", "sellado", "mistery-packs"] as const;
export const CANALES = ["Tienda física", "Online"] as const;
export const ENTREGAS = ["shipping", "pickup"] as const;
export const PRECIO_ENVIO_CENTS = 499;
export const MAX_FOTO = 700000;

const patronImagen = /^[a-zA-Z0-9_-]{1,80}$/;
const patronFotografía = new RegExp(`^data:image\\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$`);

const foto = z.string().refine((valor) => patronFotografía.test(valor) && valor.length <= MAX_FOTO, "Imagen inválida o demasiado grande").nullable();

const imagenNombre = z.string().refine((valor) => patronImagen.test(valor), "Referencia de imagen inválida").nullish();

export const productoEsquema = z.object({
  name: z.string().trim().min(1, "Revisa nombre, código y precio").max(200, "Nombre, código o expansión demasiado largos"),
  description: z.string().max(5000, "La descripción admite hasta 5000 caracteres").default(""),
  cat: z.enum(UNIVERSES, { message: "Universo o tipo inválido" }),
  type: z.enum(TIPOS, { message: "Universo o tipo inválido" }),
  set: z.string().trim().max(200, "Nombre, código o expansión demasiado largos").default(""),
  code: z.string().trim().max(128, "Nombre, código o expansión demasiado largos").optional(),
  price: z.number().positive("Revisa nombre, código y precio").refine((valor) => Number.isSafeInteger(Math.round(valor * 100)), "Revisa nombre, código y precio"),
  stock: z.number().int("Niveles de inventario inválidos").min(0, "Niveles de inventario inválidos"),
  min: z.number().int().min(0),
  target: z.number().int().min(0),
  condition: z.string().max(100, "Estado inválido").optional(),
  badge: z.string().max(100, "Campo inválido: badge").optional(),
  art: z.string().max(20).optional(),
  image: imagenNombre,
  photo: foto.optional(),
  barcodes: z.array(z.string().trim().min(1).max(128)).max(100, "Códigos adicionales inválidos").optional(),
  offerActive: z.boolean().optional(),
  offerPercent: z.number().int().optional(),
  id: z.number().int().positive("Identificador de producto inválido").optional(),
});

export const ventaEsquema = z.object({
  ticket: z.record(z.string().min(1), z.number().int().positive()),
  channel: z.string().min(1),
  payment: z.string().min(1),
  received: z.number().int().nullable().optional(),
  token: z.string(),
  customerId: z.string().nullable().optional(),
  customerProfile: z.unknown().nullable().optional(),
  delivery: z.enum(ENTREGAS).nullable().optional(),
});

export const productoEdicionEsquema = productoEsquema.partial();

export type ProductoEscala = z.infer<typeof productoEsquema>;
export type VentaEscala = z.infer<typeof ventaEsquema>;

export type PrecioProducto = { price: number; offerActive?: boolean | null; offerPercent?: number | null };

export function descuento(p: PrecioProducto): number {
  return p.offerActive === true && Number.isInteger(p.offerPercent) && (p.offerPercent as number) >= 1 && (p.offerPercent as number) <= 99 ? (p.offerPercent as number) : 0;
}

export function unidadCents(p: PrecioProducto): number {
  const base = Math.round(p.price * 100);
  return Math.max(1, Math.round((base * (100 - descuento(p))) / 100));
}

export function formatearCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

export function datosZod(error: unknown): string {
  if (error instanceof ZodError) {
    const primer = error.issues[0];
    if (primer?.message) return primer.message;
    if (primer?.path?.length) return "Campo inválido: " + primer.path.join(".");
  }
  return error instanceof Error ? error.message : "Solicitud inválida";
}

export function condicionPorDefecto(tipo: string): string {
  if (tipo === "sellado") return "Sellado";
  if (tipo === "cartas") return "Raw";
  return "Mystery Pack";
}

export function estiloVenta(id: number): string {
  return "CP-" + String(id).padStart(5, "0");
}

export function cuentaPrefix(id: number): string {
  return "CP-" + String(id).padStart(3, "0");
}
