"use client";

import { useFormStatus } from "react-dom";

export function BotonCarrito({ agotado }: { agotado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="add" disabled={agotado || pending}>
      {agotado ? "Agotado" : pending ? "Añadiendo…" : "Añadir al carrito"}
    </button>
  );
}
