export const PRECIO_ENVIO_CENTS = 499;

export type PrecioProducto = { price: number; offerActive?: boolean | null; offerPercent?: number | null };

export function descuentoPercent(p: PrecioProducto): number {
  return p.offerActive === true && Number.isInteger(p.offerPercent) === true && (p.offerPercent as number) >= 1 && (p.offerPercent as number) <= 99 ? (p.offerPercent as number) : 0;
}

export function precioUnidadCents(p: PrecioProducto): number {
  const base = Math.round(p.price * 100);
  return Math.max(1, Math.round((base * (100 - descuentoPercent(p))) / 100));
}

export function formatearCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}
