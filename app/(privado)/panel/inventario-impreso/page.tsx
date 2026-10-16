import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionFromCookieValue } from "../../../../lib/sesion.ts";
import { loadInventory } from "../../../../lib/inventario/servicio.ts";
import { BotonImprimir } from "./boton-imprimir";

export const dynamic = "force-dynamic";

export const metadata = { title: "Inventario imprimible · Centro Paleta" };

export default async function InventarioImpreso() {
  const store = await cookies();
  const sesion = sessionFromCookieValue(store.get("cp_session")?.value);
  if (sesion?.role !== "admin") redirect("/cuenta");

  const estado = await loadInventory();
  const productos = estado.state.products;
  const fecha = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <>
      <style>{`
        body { background: #fff; color: #111; font: 13px/1.45 system-ui, sans-serif; margin: 24px; }
        .impresion-cabe { display: flex; justify-content: space-between; align-items: end; margin-bottom: 14px; }
        .impresion-cabe h1 { font-size: 20px; margin: 0; }
        .impresion-cabe p { margin: 2px 0 0; color: #555; font-size: 12px; }
        .impresion-acciones { display: flex; gap: 10px; margin-bottom: 16px; }
        .impresion-acciones button { font: inherit; padding: 9px 16px; border-radius: 8px; border: 1px solid #ccc; background: #ffc928; font-weight: 700; cursor: pointer; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #bbb; padding: 5px 7px; text-align: left; vertical-align: top; }
        thead th { background: #f0f0f0; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
        tbody tr:nth-child(even) { background: #fafafa; }
        td.num { text-align: right; white-space: nowrap; }
        @media print {
          .impresion-acciones { display: none; }
          body { margin: 0; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
      `}</style>
      <div className="impresion-cabe">
        <div>
          <h1>Inventario · Centro Paleta</h1>
          <p>
            {productos.length} productos · generado el {fecha}
          </p>
        </div>
      </div>
      <div className="impresion-acciones">
        <BotonImprimir />
      </div>
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Universo</th>
            <th>Estado</th>
            <th className="num">Precio</th>
            <th className="num">Stock</th>
            <th className="num">Mín</th>
            <th className="num">Objetivo</th>
            <th>Oferta</th>
            <th>Códigos extra</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((producto) => (
            <tr key={producto.id}>
              <td>{producto.code}</td>
              <td>{producto.name}</td>
              <td>{producto.cat}</td>
              <td>{producto.condition}</td>
              <td className="num">{producto.price.toFixed(2).replace(".", ",")} €</td>
              <td className="num">{producto.stock}</td>
              <td className="num">{producto.min}</td>
              <td className="num">{producto.target}</td>
              <td>
                {producto.offerActive && producto.offerPercent
                  ? "-" + producto.offerPercent + "%"
                  : ""}
              </td>
              <td>{producto.barcodes.join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
