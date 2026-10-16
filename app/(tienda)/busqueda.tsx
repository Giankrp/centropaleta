"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const Contexto = createContext<{ consulta: string; cambia: (valor: string) => void }>({
  consulta: "",
  cambia: () => {},
});

export function BusquedaProveedor({ children }: { children: ReactNode }) {
  const [consulta, setConsulta] = useState("");
  return (
    <Contexto.Provider value={{ consulta, cambia: setConsulta }}>{children}</Contexto.Provider>
  );
}

export function useBusqueda() {
  return useContext(Contexto);
}

export function BusquedaInput() {
  const { consulta, cambia } = useContext(Contexto);
  return (
    <div className="search">
      <input
        id="search"
        placeholder="Busca cartas, colecciones o personajes..."
        aria-label="Buscar"
        value={consulta}
        onChange={(evento) => cambia(evento.target.value)}
      />
      <span>⌕</span>
    </div>
  );
}
