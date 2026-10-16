import Link from "next/link";
import { obtenerCatalogo } from "../../lib/catalogo.ts";
import { leerSesion } from "../../lib/sesion-servidor.ts";
import { favoritosDe } from "../../lib/usuarios.ts";
import { CatalogoCliente } from "./catalogo-cliente";
import { FormularioEncargo } from "./formulario-encargo";
import { FormularioVenta } from "./formulario-venta";

export default async function PaginaHome() {
  const catalogo = await obtenerCatalogo();
  const sesion = await leerSesion();
  const cliente = sesion?.role === "cliente";
  const favoritos = cliente ? await favoritosDe(sesion.u) : [];
  return (
    <>
      <div className="wrap banner-shell">
        <section className="hero" aria-label="Tu tienda de cartas coleccionables">
          <Link href="/productos" className="hero-banner">
            <img
              src="/assets/hero-etiqueta-bordada.png"
              alt="Tu tienda de coleccionables. Pokémon, One Piece, Lorcana, Dragon Ball y Naruto. Colecciona, intercambia, disfruta."
            />
          </Link>
        </section>
      </div>
      <div className="wrap" style={{ marginTop: 18, marginBottom: -4 }}>
        <div className="universe-picker">
          <Link className="universe-tile all-universes-tile" href="/productos">
            <span>VER TODOS</span>
            <small>Todos los universos</small>
          </Link>
          <Link className="universe-tile pokemon-tile" href="/productos/pokemon">
            <span>POKÉMON</span>
          </Link>
          <Link className="universe-tile one-piece-tile" href="/productos/one-piece">
            <span>ONE PIECE</span>
          </Link>
          <Link className="universe-tile lorcana-tile" href="/productos/lorcana">
            <span>LORCANA</span>
          </Link>
          <Link className="universe-tile dragon-ball-tile" href="/productos/dragon-ball">
            <span>DRAGON BALL</span>
          </Link>
          <Link className="universe-tile naruto-tile" href="/productos/naruto">
            <span>NARUTO</span>
          </Link>
        </div>
      </div>
      <div className="wrap menu-shell">
        <nav className="nav" aria-label="Navegación principal">
          <a className="active" href="/">
            Inicio
          </a>
          <a href="/productos">Productos</a>
          <a href="/productos?tipo=mistery-packs">Mystery Pack</a>
          <a href="/#valoracion">Vende tu producto</a>
          <a href="/#flash">Ofertas Paleta</a>
          <a href="/#encargos">Encargos</a>
          <a href="/#comunidad">Comunidad</a>
          <a href="/#quienes-somos">Quiénes somos</a>
          <a href="/#contacto">Contacto</a>
        </nav>
      </div>
      <main className="wrap" id="home-view">
        <div className="section-page-head" aria-hidden="true" />
        <CatalogoCliente catalogo={catalogo} cliente={cliente} favoritos={favoritos} />

        <section className="section" id="valoracion">
          <div className="value">
            <div>
              <div className="eyebrow">Compra · Venta · Intercambio</div>
              <h2>Dale una nueva vida a tu colección.</h2>
              <p>
                Envíanos sus datos y fotografías. Revisaremos tu propuesta y te contactaremos con la
                valoración.
              </p>
              <p style={{ color: "#dce1ed" }}>
                ✦ Valoración revisada
                <br />✦ Trato directo y transparente
                <br />✦ Entrega presencial a coordinar
              </p>
            </div>
            <div className="home-sale-cta">
              <a className="btn" href="#valoracion">
                Vende tu producto <span aria-hidden="true">→</span>
              </a>
            </div>
            <div style={{ width: "100%" }}>
              <FormularioVenta />
            </div>
          </div>
        </section>

        <FormularioEncargo />

        <div className="trust">
          <div>
            <span>🛡️</span>
            <b>Compra con confianza</b>
            <small>Información clara del producto</small>
          </div>
          <div>
            <span>📦</span>
            <b>Cartas protegidas</b>
            <small>Enfoque en el coleccionista</small>
          </div>
          <div>
            <span>🤝</span>
            <b>Trato cercano</b>
            <small>Comunidad de aficionados</small>
          </div>
          <div>
            <span>💬</span>
            <b>Atención personal</b>
            <small>Estamos aquí para ayudarte</small>
          </div>
        </div>

        <section
          className="section home-service-section"
          id="home-encargos"
          aria-labelledby="home-encargos-title"
        >
          <div className="home-service-card">
            <div>
              <div className="eyebrow">ENCARGOS · DIRECTOS DE JAPÓN</div>
              <h2 id="home-encargos-title">
                De Japón, calentitos
                <br />
                para tu colección.
              </h2>
              <p>
                ¿Hay un producto TCG que no puedes quitarte de la cabeza? Lo buscamos en Japón y te
                ayudamos a traerlo a tu colección. Cuéntanos qué sueñas conseguir: nuestro equipo te
                informará de la disponibilidad y las condiciones.
              </p>
            </div>
            <div className="home-service-action">
              <a className="btn" href="#encargos">
                Encarga tu producto <span aria-hidden="true">→</span>
              </a>
              <span>Tu próxima aventura empieza con un encargo.</span>
            </div>
          </div>
        </section>

        <section className="section" id="comunidad">
          <div
            className="deal-card blue community-coming"
            style={{ textAlign: "center", padding: 30 }}
          >
            <div className="eyebrow">Centro Paleta · Comunidad TCG</div>
            <h3>Próximamente…</h3>
          </div>
        </section>

        <section className="section info-section" id="quienes-somos" aria-labelledby="about-title">
          <div className="section-head">
            <h2 id="about-title">Quiénes somos</h2>
          </div>
          <div className="info-panel">
            <p>
              Centro Paleta es un espacio para aficionados a las cartas y al coleccionismo. Pokémon,
              One Piece, Lorcana, Dragon Ball y Naruto forman parte de nuestros universos.
            </p>
            <p>
              Queremos dar una segunda vida a tus cartas y ayudarte a encontrar la próxima pieza de
              tu colección.
            </p>
          </div>
          <section
            className="section contact-within-about"
            id="contacto"
            aria-labelledby="contact-title"
          >
            <div className="section-head">
              <h2 id="contact-title">Contacto</h2>
            </div>
            <div className="visit-panel">
              <div className="visit-address">
                <div className="eyebrow">TE ESPERAMOS EN MANISES</div>
                <h3>
                  Tu próxima colección
                  <br />
                  empieza aquí.
                </h3>
                <address>
                  Calle Oeste 10, bajo 0<br />
                  46940 Manises, Valencia
                </address>
                <a
                  className="btn"
                  href="https://www.google.com/maps/search/?api=1&query=Calle+Oeste+10,+46940+Manises,+Valencia"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir en Google Maps
                </a>
              </div>
              <div className="visit-details">
                <div className="opening-hours">
                  <h3>Horario de tienda</h3>
                  <dl>
                    <div>
                      <dt>Lunes a sábado</dt>
                      <dd>
                        11:00–14:00 <span>y</span> 17:00–20:00
                      </dd>
                    </div>
                    <div>
                      <dt>Domingos</dt>
                      <dd>Cerrado, excepto torneos</dd>
                    </div>
                  </dl>
                </div>
                <div className="digital-contact">
                  <h3>Hablamos contigo</h3>
                  <a className="contact-number" href="tel:+34694930316">
                    694 930 316
                  </a>
                  <p className="digital-note">
                    La atención digital se realiza en horario comercial.
                  </p>
                  <div className="contact-actions">
                    <a
                      className="btn whatsapp-cta"
                      href="https://wa.me/34694930316"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                    <a
                      className="textlink"
                      href="https://www.instagram.com/centro.paleta/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Instagram · @centro.paleta
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <section
          className="section arrival-section"
          id="como-llegar"
          aria-labelledby="arrival-title"
        >
          <div className="section-head">
            <h2 id="arrival-title">Cómo llegar</h2>
          </div>
          <div className="arrival-panel">
            <div className="arrival-copy">
              <span className="metro-badge">METRO · ROSAS</span>
              <h3>
                Baja en Rosas.
                <br />
                Ven a Centro Paleta.
              </h3>
              <p>
                Estamos junto al metro de Rosas, en Manises. Desde la estación puedes llegar a pie a
                nuestro local en Calle Oeste 10, bajo 0.
              </p>
              <div
                className="walking-diagram"
                role="img"
                aria-label="Esquema orientativo: estación de metro Rosas, recorrido a pie, Centro Paleta"
              >
                <div>
                  <b>Ⓜ</b>
                  <span>Metro Rosas</span>
                </div>
                <span className="walking-line">A PIE</span>
                <div>
                  <b>⌂</b>
                  <span>Centro Paleta</span>
                </div>
              </div>
              <p className="route-note">
                Esquema orientativo. Consulta el recorrido exacto en Google Maps.
              </p>
              <a
                className="btn"
                href="https://www.google.com/maps/dir/?api=1&origin=Estaci%C3%B3n+de+metro+Rosas,+Manises,+Valencia&destination=Calle+Oeste+10,+46940+Manises,+Valencia,+Espa%C3%B1a&travelmode=walking"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver ruta a pie desde Rosas
              </a>
            </div>
            <div className="arrival-map">
              <iframe
                title="Mapa de Centro Paleta en Calle Oeste 10, Manises"
                src="https://maps.google.com/maps?q=Calle+Oeste+10,+46940+Manises,+Valencia,+Espa%C3%B1a&z=17&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              <a
                href="https://www.google.com/maps/dir/?api=1&origin=Estaci%C3%B3n+de+metro+Rosas,+Manises,+Valencia&destination=Calle+Oeste+10,+46940+Manises,+Valencia,+Espa%C3%B1a&travelmode=walking"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir recorrido desde el metro
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
