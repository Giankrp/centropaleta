"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";

export function AvisoError() {
  const parametros = useSearchParams();
  const ruta = usePathname();
  const error = parametros.get("error");
  if (!error) return null;
  return (
    <div className="aviso-error" role="alert">
      <span>{error}</span>
      <Link className="textlink" href={ruta}>
        Cerrar
      </Link>
    </div>
  );
}
