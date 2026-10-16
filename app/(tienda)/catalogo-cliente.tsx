"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Catalogo, VentaReciente } from "../../lib/catalogo";
import type { ProductoVista } from "./card-producto";
import { CardProducto, unidadCents } from "./card-producto";
import { useBusqueda } from "./busqueda";

const DESCUENTOS_EJEMPLO = [20, 15, 25, 10, 30];
const ORDENES = [
  ["default", "Orden recomendado"],
  ["price-asc", "Precio: menor a mayor"],
  ["price-desc", "Precio: mayor a menor"],
  ["name-asc", "Nombre: A–Z"],
  ["name-desc", "Nombre: Z–A"],
  ["newest", "Más recientes"],
] as const;

function ordenar(listado: ProductoVista[], orden: string): ProductoVista[] {
  const porNombre = (a: ProductoVista, b: ProductoVista) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true });
  const ordenadores: Record<string, (a: ProductoVista, b: ProductoVista) => number> = {
    "price-asc": (a, b) => unidadCents(a) - unidadCents(b) || porNombre(a, b),
    "price-desc": (a, b) => unidadCents(b) - unidadCents(a) || porNombre(a, b),
    "name-asc": porNombre,
    "name-desc": (a, b) => porNombre(b, a),
    newest: (a, b) => b.id - a.id,
  };
  return [...listado].sort(ordenadores[orden] ?? (() => 0));
}

function Rail({
  productos,
  cliente,
  favoritos,
}: {
  productos: ProductoVista[];
  cliente: boolean;
  favoritos: number[];
}) {
  return (
    <div className="rail">
      {productos.length ? (
        productos.map((producto) => (
          <CardProducto
            key={producto.id + (producto.ejemplo ? "-demo" : "")}
            producto={producto}
            cliente={cliente}
            favorito={favoritos.includes(producto.id)}
            origen="/"
          />
        ))
      ) : (
        <div className="empty">No hay cartas que coincidan con tu búsqueda.</div>
      )}
    </div>
  );
}

function SelectOrden({ valor, cambia }: { valor: string; cambia: (valor: string) => void }) {
  return (
    <label className="sort-control">
      <span>Ordenar por</span>
      <select value={valor} onChange={(evento) => cambia(evento.target.value)}>
        {ORDENES.map(([valorLista, texto]) => (
          <option key={valorLista} value={valorLista}>
            {texto}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CatalogoCliente({
  catalogo,
  cliente,
  favoritos,
}: {
  catalogo: Catalogo;
  cliente: boolean;
  favoritos: number[];
}) {
  const { consulta } = useBusqueda();
  const [orden, setOrden] = useState("default");
  const [ordenFlash, setOrdenFlash] = useState("default");

  const texto = consulta.toLowerCase();
  const candidatos = useMemo(
    () =>
      catalogo.productos
        .filter((producto) =>
          `${producto.nombre} ${producto.categoria} ${producto.set} ${producto.codigo}`
            .toLowerCase()
            .includes(texto),
        )
        .map((producto) => ({ ...producto })),
    [catalogo, texto],
  );

  const ofertasEjemplo: ProductoVista[] = useMemo(() => {
    const reales = catalogo.productos.filter((producto) => producto.enOferta);
    const lista: ProductoVista[] = [];
    for (const producto of catalogo.productos) {
      if (reales.length + lista.length >= 5) break;
      if (reales.some((real) => real.id === producto.id)) continue;
      lista.push({
        ...producto,
        descuentoDemo: DESCUENTOS_EJEMPLO[lista.length % DESCUENTOS_EJEMPLO.length],
        ejemplo: true,
      });
    }
    return lista;
  }, [catalogo]);

  const ofertasFlash = useMemo(
    () =>
      ordenar(
        [
          ...catalogo.productos
            .filter((producto) => producto.enOferta)
            .map((producto) => ({ ...producto })),
          ...ofertasEjemplo,
        ],
        ordenFlash,
      ),
    [catalogo, ofertasEjemplo, ordenFlash],
  );

  const ventas: { venta: VentaReciente; producto: ProductoVista | null }[] =
    catalogo.ventasRecientes.map((venta) => ({
      venta,
      producto: catalogo.productos.find((producto) => producto.id === venta.productId) ?? null,
    }));

  return (
    <>
      {candidatos.length ? (
        <section className="section" id="novedades">
          <div className="section-head">
            <div>
              <h2>NOVEDADES Y NUEVOS LANZAMIENTOS</h2>
              <p>Catálogo actual · precios de la tienda</p>
            </div>
            <Link className="textlink" href="/productos">
              Ver todos los productos
            </Link>
          </div>
          <SelectOrden valor={orden} cambia={setOrden} />
          <Rail productos={ordenar(candidatos, orden)} cliente={cliente} favoritos={favoritos} />
        </section>
      ) : null}

      {ofertasFlash.length ? (
        <section className="section" id="flash" aria-labelledby="flash-title">
          <div className="section-head">
            <div>
              <div className="eyebrow">Ofertas Paleta</div>
              <h2 id="flash-title">Para los más rápidos</h2>
              <p>Descuentos del catálogo · las tarjetas «EJEMPLO VISUAL» son ilustrativas</p>
            </div>
          </div>
          <SelectOrden valor={ordenFlash} cambia={setOrdenFlash} />
          <div className="rail flash-rail">
            {ofertasFlash.map((producto, indice) => (
              <CardProducto
                key={producto.id + (producto.ejemplo ? "-demo" : "") + indice}
                producto={producto}
                cliente={cliente}
                favorito={favoritos.includes(producto.id)}
                origen="/"
              />
            ))}
          </div>
        </section>
      ) : null}

      {ventas.length ? (
        <section className="section" id="ultimas-ventas" aria-labelledby="latest-sales-title">
          <div className="section-head">
            <div>
              <h2 id="latest-sales-title">ÚLTIMAS VENTAS</h2>
              <p>Lo último que ha encontrado un nuevo coleccionista.</p>
              <p className="sales-demo-note">
                Últimas ventas confirmadas de la tienda; con ejemplos visuales mientras la sección
                arranca.
              </p>
            </div>
          </div>
          <div className="rail flash-rail sales-rail">
            {ventas.map(({ venta, producto }) => (
              <article className="product sold-product" key={venta.nombre + venta.fechaISO}>
                <div className="p-art">
                  {producto?.imagenUrl ? (
                    <img
                      className="product-image"
                      src={producto.imagenUrl}
                      alt={venta.nombre}
                      loading="lazy"
                    />
                  ) : producto ? (
                    <div className="no-product-image">
                      📦<span>Sin imagen</span>
                    </div>
                  ) : null}
                  <em>{venta.ejemplo ? "VENTA DE EJEMPLO" : "VENDIDO"}</em>
                </div>
                <div className="p-body">
                  {venta.ejemplo ? <span className="sample-label">EJEMPLO VISUAL</span> : null}
                  <div className="tag">
                    {producto?.categoria || "Coleccionable"}
                    {producto?.set ? " · " + producto.set : ""}
                  </div>
                  <h3>{venta.nombre}</h3>
                  <span className="condition">
                    {venta.ejemplo
                      ? "Vista previa de venta"
                      : "Vendido el " +
                        new Intl.DateTimeFormat("es-ES", {
                          day: "numeric",
                          month: "short",
                          timeZone: "Europe/Madrid",
                        }).format(new Date(venta.fechaISO))}
                  </span>
                  {producto ? (
                    <Link className="textlink" href="/productos">
                      Ver productos similares
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
