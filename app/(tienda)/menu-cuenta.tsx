"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { salirAccion } from "./acciones";

export function MenuCuenta({
  nombre,
  avatarHtml,
  esAdmin,
}: {
  nombre: string;
  avatarHtml: string | null;
  esAdmin: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!abierto) return;
    const click = (evento: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(evento.target as Node))
        setAbierto(false);
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  return (
    <div className="menu-cuenta" ref={contenedor}>
      <button
        className="iconbtn account-button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        title={esAdmin ? "Panel privado" : "Mi cuenta"}
      >
        {avatarHtml ? (
          <span dangerouslySetInnerHTML={{ __html: avatarHtml }} />
        ) : (
          <span className="account-icon" aria-hidden="true">
            ♙
          </span>
        )}
        <span className="account-label">{esAdmin ? "Panel privado" : nombre}</span>
      </button>
      {abierto ? (
        <div className="menu-cuenta-panel" role="menu">
          <div className="menu-cuenta-cab">
            {avatarHtml ? (
              <span dangerouslySetInnerHTML={{ __html: avatarHtml }} />
            ) : (
              <span className="account-icon" aria-hidden="true">
                ♙
              </span>
            )}
            <div>
              <b>{nombre}</b>
              <small>{esAdmin ? "Administración" : "Cuenta de cliente"}</small>
            </div>
          </div>
          {esAdmin ? (
            <Link className="menu-cuenta-item" href="/panel" onClick={() => setAbierto(false)}>
              ⚙ Abrir panel privado
            </Link>
          ) : (
            <Link className="menu-cuenta-item" href="/cuenta" onClick={() => setAbierto(false)}>
              ♙ Mi perfil y pedidos
            </Link>
          )}
          <Link className="menu-cuenta-item" href="/carrito" onClick={() => setAbierto(false)}>
            🛒 Mi carrito
          </Link>
          <form action={salirAccion}>
            <button type="submit" className="menu-cuenta-item" style={{ width: "100%" }}>
              ⎋ Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
