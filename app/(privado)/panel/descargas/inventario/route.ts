import { cookies } from "next/headers";
import { sessionFromCookieValue } from "../../../../../lib/sesion.ts";
import { loadInventory } from "../../../../../lib/inventario/servicio.ts";

export const dynamic = "force-dynamic";

const CABECERAS = [
  "Código",
  "Nombre",
  "Universo",
  "Tipo",
  "Expansión",
  "Estado",
  "Precio (€)",
  "Stock",
  "Mínimo",
  "Objetivo",
  "Oferta",
  "Códigos extra",
];

function celda(valor: unknown): string {
  const texto = String(valor ?? "");
  return /[";\n]/.test(texto) ? '"' + texto.replaceAll('"', '""') + '"' : texto;
}

export async function GET() {
  const store = await cookies();
  const sesion = sessionFromCookieValue(store.get("cp_session")?.value);
  if (sesion?.role !== "admin") {
    return new Response("Acceso restringido", { status: 403 });
  }

  const estado = await loadInventory();
  const lineas = [CABECERAS.join(";")];
  for (const producto of estado.state.products) {
    lineas.push(
      [
        producto.code,
        producto.name,
        producto.cat,
        producto.type,
        producto.set,
        producto.condition,
        producto.price.toFixed(2).replace(".", ","),
        producto.stock,
        producto.min,
        producto.target,
        producto.offerActive && producto.offerPercent ? "-" + producto.offerPercent + "%" : "",
        producto.barcodes.join(" · "),
      ]
        .map(celda)
        .join(";"),
    );
  }

  const fecha = new Date().toISOString().slice(0, 10);
  return new Response("\ufeff" + lineas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario-centro-paleta-${fecha}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
