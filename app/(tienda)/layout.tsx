import Link from "next/link";
import type { ReactNode } from "react";
import "./base.css";
import "../../public/theme.css";
import "../../public/avatars.css";
import "../../public/upgrade.css";
import { leerSesion } from "../../lib/sesion-servidor.ts";
import { contarCarrito } from "../../lib/carrito.ts";
import { ensureSchema } from "../../lib/inventario/bd.ts";
import { BusquedaProveedor, BusquedaInput } from "./busqueda";
import { AvisoError } from "./aviso-error";
import { MenuCuenta } from "./menu-cuenta";
import { perfilDe } from "../../lib/usuarios.ts";
import { avatarMarkup } from "../../lib/avatars.ts";
import "./tienda-extra.css";

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
      <a className="skip-link" href="#home-view">
        Saltar al contenido
      </a>
      <div className="announcement">
        ENVÍOS PROTEGIDOS · COLECCIONISMO CON CONFIANZA · NUEVAS CARTAS CADA SEMANA
      </div>
      <header>
        <div className="wrap">
          <div className="head">
            <Link className="logo" href="/" aria-label="Centro Paleta, inicio">
              <img src="/assets/logo.webp" alt="Centro Paleta" />
            </Link>
            <BusquedaInput />
            <div className="header-links">
              <a
                className="location-button maps-button"
                aria-label="Abrir ubicación de Centro Paleta en Google Maps"
                href="https://www.google.com/maps/search/?api=1&query=Calle+Oeste+10%2C+bajo+0%2C+46940+Manises%2C+Valencia%2C+Espa%C3%B1a"
                target="_blank"
                rel="noopener noreferrer"
                title="Calle Oeste 10, bajo 0, 46940 Manises, Valencia"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <defs>
                    <clipPath id="maps-pin-clip">
                      <path d="M12 1a8 8 0 0 0-8 8c0 5.7 6.2 10.8 7.1 13.4a.95.95 0 0 0 1.8 0C13.8 19.8 20 14.7 20 9a8 8 0 0 0-8-8Z" />
                    </clipPath>
                  </defs>
                  <g clip-path="url(#maps-pin-clip)">
                    <path fill="#4285F4" d="M0 0h24v24H0z" />
                    <path fill="#1A73E8" d="M0 0h12L0 12z" />
                    <path fill="#EA4335" d="m0 12 12-12h12L0 24z" />
                    <path fill="#FBBC04" d="m0 24 24-24v12L12 24z" />
                    <path fill="#34A853" d="m12 24 12-12v12z" />
                  </g>
                  <circle cx="12" cy="9" r="3" fill="white" />
                </svg>
                <span className="sr-only">Ubicación</span>
              </a>
              <a
                className="location-button instagram-button"
                aria-label="Abrir Instagram de Centro Paleta"
                href="https://www.instagram.com/centro.paleta/"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram de Centro Paleta"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
                </svg>
                <span className="sr-only">Instagram</span>
              </a>
              <a
                className="location-button whatsapp-button"
                aria-label="Abrir WhatsApp de Centro Paleta"
                href="https://wa.me/34694930316"
                target="_blank"
                rel="noopener noreferrer"
                title="Habla con Centro Paleta por WhatsApp"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.52 3.449A11.865 11.865 0 0 0 12.004 0C5.495 0 .199 5.296.196 11.806c0 2.08.543 4.11 1.574 5.9L.095 23.82l6.258-1.641a11.81 11.81 0 0 0 5.65 1.438h.005c6.507 0 11.805-5.296 11.808-11.807a11.87 11.87 0 0 0-3.296-8.361ZM12.008 21.62h-.004a9.8 9.8 0 0 1-4.997-1.368l-.358-.213-3.714.974.992-3.622-.233-.372a9.78 9.78 0 0 1-1.5-5.213c.002-5.41 4.405-9.812 9.818-9.812a9.75 9.75 0 0 1 6.94 2.876 9.76 9.76 0 0 1 2.872 6.944c-.003 5.411-4.405 9.806-9.816 9.806Zm5.384-7.343c-.295-.148-1.746-.862-2.017-.96-.27-.1-.467-.148-.664.147-.197.296-.763.961-.935 1.158-.172.197-.344.222-.639.074-.295-.148-1.247-.46-2.376-1.467-.878-.783-1.47-1.75-1.642-2.046-.172-.296-.018-.456.13-.603.133-.133.295-.345.443-.518.148-.172.197-.295.295-.493.099-.197.05-.369-.024-.517-.074-.148-.665-1.601-.911-2.192-.24-.576-.483-.498-.665-.507-.172-.009-.369-.01-.566-.01-.197 0-.517.074-.787.369-.27.296-1.033 1.01-1.033 2.463s1.058 2.857 1.206 3.054c.147.197 2.082 3.18 5.044 4.458.705.304 1.255.485 1.684.621.708.225 1.353.193 1.862.117.568-.085 1.747-.714 1.993-1.404.246-.689.246-1.28.172-1.404-.074-.123-.271-.197-.566-.345Z" />
                </svg>
                <span className="sr-only">WhatsApp</span>
              </a>
            </div>
            <div className="head-actions">
              {sesion && sesion.role !== "invitado" ? (
                <MenuCuenta
                  nombre={
                    sesion.role === "admin"
                      ? sesion.u
                      : (await perfilDe(sesion.u))?.displayName || sesion.u
                  }
                  avatarHtml={
                    sesion.role === "cliente"
                      ? avatarMarkup((await perfilDe(sesion.u))?.avatar ?? "coral")
                      : null
                  }
                  esAdmin={sesion.role === "admin"}
                />
              ) : (
                <Link
                  className="iconbtn account-button"
                  href="/cuenta"
                  title="Iniciar sesión"
                  aria-label="Iniciar sesión"
                >
                  <span className="account-icon" aria-hidden="true">
                    ♙
                  </span>
                  <span className="account-label">Iniciar sesión</span>
                </Link>
              )}
              <Link className="iconbtn" href="/carrito" title="Carrito" aria-label="Carrito">
                🛒<i className="count">{unidades}</i>
              </Link>
            </div>
          </div>
        </div>
      </header>
      <AvisoError />
      {children}
      <footer>
        <div className="wrap foot">
          <div>
            <b style={{ fontSize: 15, color: "white" }}>✦ CENTRO PALETA</b>
          </div>
          <nav className="footer-nav" aria-label="Navegación del pie de página">
            <Link href="/">Inicio</Link>
            <Link href="/productos">Productos</Link>
            <Link href="/#encargos">Encargos</Link>
            <Link href="/#comunidad">Comunidad</Link>
            <Link href="/#quienes-somos">Quiénes somos</Link>
          </nav>
          <div>© 2026 Centro Paleta · Demo de diseño</div>
        </div>
      </footer>
      <div className="sea-footer" aria-label="Barco pirata navegando sobre las olas">
        <div className="sea-label">Centro Paleta · Siempre rumbo a nuevas colecciones</div>
        <svg
          className="wave wave-back"
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 42 C120 10 240 75 360 42 S600 10 720 42 S960 75 1080 42 S1320 10 1440 42 L1440 100 L0 100Z M1440 42 C1560 10 1680 75 1800 42 S2040 10 2160 42 S2400 75 2520 42 S2760 10 2880 42 L2880 100 L1440 100Z" />
        </svg>
        <svg
          className="wave wave-front"
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 35 C140 75 230 8 370 35 S600 72 740 35 S970 8 1110 35 S1300 70 1440 35 L1440 100 L0 100Z M1440 35 C1580 75 1670 8 1810 35 S2040 72 2180 35 S2410 8 2550 35 S2740 70 2880 35 L2880 100 L1440 100Z" />
        </svg>
        <div className="pirate-route" aria-hidden="true">
          <img
            className="pirate-ship"
            src="/assets/pirate-ship-v2.png"
            alt=""
            width={200}
            height={200}
          />
        </div>
      </div>
    </BusquedaProveedor>
  );
}
