import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionFromCookieValue } from "../../../../lib/sesion.ts";
import { loadInventory } from "../../../../lib/inventario/servicio.ts";
import { EtiquetasCliente } from "./etiquetas-cliente";

export const dynamic = "force-dynamic";

export const metadata = { title: "Etiquetas · Centro Paleta" };

const ETIQUETAS_POR_FILA = 3;

export default async function Etiquetas({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; barcode?: string }>;
}) {
  const store = await cookies();
  const sesion = sessionFromCookieValue(store.get("cp_session")?.value);
  if (sesion?.role !== "admin") redirect("/cuenta");

  const { ids, barcode } = await searchParams;
  const solicitados = new Set(
    (ids ?? "")
      .split(",")
      .map((valor) => Number(valor.trim()))
      .filter((valor) => Number.isSafeInteger(valor) && valor > 0),
  );
  const productos = (await loadInventory()).state.products.filter((p) => solicitados.has(p.id));

  return (
    <>
      <style>{`
        body { background: #fff; color: #111; font: 12px/1.35 system-ui, sans-serif; margin: 20px; }
        .etiquetas-acciones { display: flex; gap: 14px; align-items: center; margin-bottom: 16px; }
        .etiquetas-acciones button { font: inherit; padding: 9px 16px; border-radius: 8px; border: 1px solid #ccc; background: #ffc928; font-weight: 700; cursor: pointer; }
        .etiqueta-opcion { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 650; }
        .hoja-etiquetas { display: grid; grid-template-columns: repeat(${ETIQUETAS_POR_FILA}, 1fr); gap: 6mm; }
        .etiqueta { border: 1px dashed #999; border-radius: 6px; padding: 4mm 5mm; break-inside: avoid; display: flex; flex-direction: column; gap: 1.5mm; }
        .etiqueta .codigo { font-size: 26px; font-weight: 900; letter-spacing: .06em; font-family: ui-monospace, monospace; }
        .etiqueta .nombre { font-size: 13px; font-weight: 700; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .etiqueta svg { width: 100%; height: 10mm; }
        .etiqueta .pie { display: flex; justify-content: space-between; align-items: end; gap: 4px; margin-top: auto; }
        .etiqueta .detalle { color: #555; font-size: 10.5px; }
        .etiqueta .precio { font-size: 17px; font-weight: 900; white-space: nowrap; }
        @media print {
          .etiquetas-acciones { display: none; }
          body { margin: 8mm; }
          .etiqueta { border-style: solid; border-color: #ddd; }
        }
      `}</style>
      {productos.length ? (
        <EtiquetasCliente
          productos={productos.map((producto) => ({
            id: producto.id,
            code: producto.code,
            name: producto.name,
            cat: producto.cat,
            condition: producto.condition,
            offerPercent:
              producto.offerActive && producto.offerPercent ? producto.offerPercent : null,
            price: producto.price,
          }))}
          conCodigoInicial={barcode === "1"}
        />
      ) : (
        <p>No hay productos para etiquetar.</p>
      )}
    </>
  );
}
