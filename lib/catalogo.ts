import { unstable_cache } from "next/cache";
import { ensureSchema } from "./inventario/bd.ts";
import { loadInventory } from "./inventario/servicio.ts";
import { descuentoPercent, precioUnidadCents } from "./precios.ts";

export type ProductoTienda = {
  id: number;
  nombre: string;
  categoria: string;
  tipo: string;
  set: string;
  codigo: string;
  descripcion: string;
  estado: string;
  emblema: string | null;
  arte: string;
  precioBaseCents: number;
  descuento: number;
  precioUnidadCents: number;
  stock: number;
  imagenUrl: string | null;
  enOferta: boolean;
};

export type VentaReciente = {
  productId: number | null;
  nombre: string;
  fechaISO: string;
  ejemplo: boolean;
};

export type Catalogo = {
  productos: ProductoTienda[];
  ventasRecientes: VentaReciente[];
};

type ProductoInventario = {
  id: number;
  name: string;
  cat: string;
  type: string;
  set: string;
  code: string;
  description: string;
  condition: string;
  badge?: string | null;
  art?: string | null;
  price: number;
  stock: number;
  image?: string | null;
  photo?: string | null;
};

function imagenUrlDe(p: ProductoInventario): string | null {
  if (p.photo) return `/api/photo/${p.id}`;
  if (p.image) return `/assets/${p.image}.webp`;
  return null;
}

async function construir(): Promise<Catalogo> {
  await ensureSchema();
  const estado = (await loadInventory()) as {
    state: {
      products: unknown[];
      sales: { date: string; lines: { id: number | null; name: string }[] }[];
    };
    revision: number;
  };
  const productos: ProductoTienda[] = estado.state.products.map((raw) => {
    const producto = raw as unknown as ProductoInventario;
    const descuento = descuentoPercent(producto);
    return {
      id: producto.id,
      nombre: producto.name,
      categoria: producto.cat,
      tipo: producto.type,
      set: producto.set,
      codigo: producto.code,
      descripcion: producto.description,
      estado: producto.condition,
      emblema: producto.badge ?? null,
      arte: producto.art || "📦",
      precioBaseCents: Math.round(producto.price * 100),
      descuento,
      precioUnidadCents: precioUnidadCents(producto),
      stock: producto.stock,
      imagenUrl: imagenUrlDe(producto),
      enOferta: descuento > 0,
    };
  });
  const ventas: VentaReciente[] = [];
  for (const venta of [...estado.state.sales].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  )) {
    for (const linea of venta.lines) {
      if (ventas.some((v) => v.productId === linea.id)) continue;
      if (linea.id == null) continue;
      if (ventas.length >= 12) break;
      ventas.push({
        productId: linea.id,
        nombre: linea.name,
        fechaISO: String(venta.date),
        ejemplo: false,
      });
    }
  }
  for (const producto of productos) {
    if (ventas.length >= 5) break;
    if (ventas.some((v) => v.productId === producto.id)) continue;
    ventas.push({
      productId: producto.id,
      nombre: producto.nombre,
      fechaISO: new Date().toISOString(),
      ejemplo: true,
    });
  }
  return { productos, ventasRecientes: ventas };
}

export const obtenerCatalogo = unstable_cache(construir, ["catalogo"], {
  tags: ["inventario"],
  revalidate: 3600,
});

export function productoPorId(catalogo: Catalogo, id: number): ProductoTienda | null {
  return catalogo.productos.find((producto) => producto.id === id) ?? null;
}
