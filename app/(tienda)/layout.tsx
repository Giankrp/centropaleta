import Link from "next/link";
import type { ReactNode } from "react";
import "./base.css";
import "../../public/theme.css";
import "../../public/avatars.css";
import "../../public/upgrade.css";
import { leerSesion } from "../../lib/sesion.ts";
import { contarCarrito } from "../../lib/carrito.ts";
import { ensureSchema } from "../../lib/inventario/bd.ts";
import { BusquedaProveedor, BusquedaInput } from "./busqueda";

export default async function LayoutTienda({ children }: { children: ReactNode }) {
  await ensureSchema();
  const sesion = await leerSesion();
  let unidades = 0;
  if (sesion) {
    try {
      unidades = await contarCarrito(sesion.u);
    } catch {
      unidades = 0;
    }
  }
  return (
    <BusquedaProveedor>
      <a className="skip-link" href="#home-view">Saltar al contenido</a>
      <div className="announcement">ENVÍOS PROTEGIDOS · COLECCIONISMO CON CONFIANZA · NUEVAS CARTAS CADA SEMANA</div>
      <header><div className="wrap">
        <div className="head">
          <Link className="logo" href="/" aria-label="Centro Paleta, inicio"><img src="/assets/logo.webp" alt="Centro Paleta" /></Link>
          <BusquedaInput />
          <div className="head-actions">
            <Link className="iconbtn account-button" href={sesion?.role === "admin" ? "/panel" : "/cuenta"} title={sesion?.role === "admin" ? "Panel privado" : sesion?.role === "cliente" ? sesion.u : "Iniciar sesión"} aria-label="Mi cuenta"><span className="account-icon" aria-hidden="true">♙</span><span className="account-label">{sesion?.role === "admin" ? "Panel privado" : sesion?.role === "cliente" ? sesion.u : "Iniciar sesión"}</span></Link>
            <Link className="iconbtn" href="/carrito.ts" title="Carrito" aria-label="Carrito">🛒<i className="count">{unidades}</i></Link>
          </div>
        </div>
      </div></header>
      {children}
      <footer><div className="wrap foot"><div><b style={{ fontSize: 15, color: "white" }}>✦ CENTRO PALETA</b></div><nav className="footer-nav" aria-label="Navegación del pie de página"><Link href="/">Inicio</Link><Link href="/productos">Productos</Link><Link href="/#encargos">Encargos</Link><Link href="/#comunidad">Comunidad</Link><Link href="/#quienes-somos">Quiénes somos</Link></nav><div>© 2026 Centro Paleta · Demo de diseño</div></div></footer>
      <div className="sea-footer" aria-label="Barco pirata navegando sobre las olas">
        <div className="sea-label">Centro Paleta · Siempre rumbo a nuevas colecciones</div>
        <svg className="wave wave-back" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 42 C120 10 240 75 360 42 S600 10 720 42 S960 75 1080 42 S1320 10 1440 42 L1440 100 L0 100Z M1440 42 C1560 10 1680 75 1800 42 S2040 10 2160 42 S2400 75 2520 42 S2760 10 2880 42 L2880 100 L1440 100Z" /></svg>
        <svg className="wave wave-front" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 35 C140 75 230 8 370 35 S600 72 740 35 S970 8 1110 35 S1300 70 1440 35 L1440 100 L0 100Z M1440 35 C1580 75 1670 8 1810 35 S2040 72 2180 35 S2410 8 2550 35 S2740 70 2880 35 L2880 100 L1440 100Z" /></svg>
        <div className="pirate-route" aria-hidden="true"><img className="pirate-ship" src="/assets/pirate-ship-v2.png" alt="" width={200} height={200} /></div>
      </div>
    </BusquedaProveedor>
  );
}
