"use client";

import { useEffect } from "react";

export function BotonImprimir() {
  useEffect(() => {
    const temporizador = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(temporizador);
  }, []);

  return (
    <button type="button" onClick={() => window.print()}>
      Guardar como PDF / Imprimir
    </button>
  );
}
