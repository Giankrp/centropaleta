"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

function CodigoBarras({ codigo }: { codigo: string }) {
  const svg = useRef<SVGSVGElement | null>(null);
  const [valido, setValido] = useState(true);

  useEffect(() => {
    if (!svg.current) return;
    try {
      JsBarcode(svg.current, codigo, {
        format: "CODE128",
        width: 1.7,
        height: 38,
        displayValue: false,
        margin: 0,
        background: "#ffffff",
      });
      setValido(true);
    } catch {
      setValido(false);
    }
  }, [codigo]);

  if (!valido) {
    return <span className="detalle">Código no imprimible como barras: {codigo}</span>;
  }
  return <svg ref={svg} />;
}

export type ProductoEtiqueta = {
  id: number;
  code: string;
  name: string;
  cat: string;
  condition: string;
  offerPercent: number | null;
  price: number;
};

export function EtiquetasCliente({
  productos,
  conCodigoInicial,
}: {
  productos: ProductoEtiqueta[];
  conCodigoInicial: boolean;
}) {
  const [conCodigo, setConCodigo] = useState(conCodigoInicial);

  useEffect(() => {
    const temporizador = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(temporizador);
  }, []);

  function alterna() {
    const siguiente = !conCodigo;
    setConCodigo(siguiente);
    const params = new URLSearchParams(window.location.search);
    if (siguiente) params.set("barcode", "1");
    else params.delete("barcode");
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (params.toString() ? "?" + params.toString() : ""),
    );
  }

  return (
    <>
      <div className="etiquetas-acciones">
        <button type="button" onClick={() => window.print()}>
          Imprimir ahora
        </button>
        <label className="etiqueta-opcion">
          <input type="checkbox" checked={conCodigo} onChange={alterna} />
          Incluir código de barras escaneable
        </label>
      </div>
      <div className="hoja-etiquetas">
        {productos.map((producto) => (
          <div className="etiqueta" key={producto.id}>
            <span className="codigo">{producto.code}</span>
            <span className="nombre">{producto.name}</span>
            {conCodigo ? <CodigoBarras codigo={producto.code} /> : null}
            <span className="detalle">
              {producto.cat} · {producto.condition}
              {producto.offerPercent ? " · Oferta -" + producto.offerPercent + "%" : ""}
            </span>
            <span className="pie">
              <span className="detalle">Centro Paleta</span>
              <span className="precio">{producto.price.toFixed(2).replace(".", ",")} €</span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
