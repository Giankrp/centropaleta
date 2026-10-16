import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { obtenerCatalogo } from "../../../../lib/catalogo.ts";
import { leerSesion } from "../../../../lib/sesion-servidor.ts";
import { favoritosDe } from "../../../../lib/usuarios.ts";
import { ensureSchema } from "../../../../lib/inventario/bd.ts";
import { VistaCatalogo } from "../vista-catalogo";

const NOMBRES: Record<string, string> = {
  pokemon: "Pokémon",
  "one-piece": "One Piece",
  lorcana: "Lorcana",
  "dragon-ball": "Dragon Ball",
  naruto: "Naruto",
};
const TIPO_VALIDO = new Set([undefined, "", "cartas", "sellado", "mistery-packs"]);
const ETIQUETA_TIPO: Record<string, string> = {
  cartas: "Cartas",
  sellado: "Sellado",
  "mistery-packs": "Mystery Pack",
};

type Props = { params: Promise<{ universo: string }>; searchParams: Promise<{ tipo?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { universo } = await params;
  const { tipo } = await searchParams;
  const nombre = NOMBRES[universo];
  if (!nombre) return { title: "Universo no encontrado — Centro Paleta" };
  const sufijo = tipo && ETIQUETA_TIPO[tipo] ? " · " + ETIQUETA_TIPO[tipo] : "";
  return {
    title: nombre + sufijo + " — Centro Paleta",
    description:
      "Productos de " +
      nombre +
      " en Centro Paleta: cartas, sellados y mystery packs con precios actualizados.",
  };
}

export default async function PaginaUniverso({ params, searchParams }: Props) {
  const { universo } = await params;
  const { tipo } = await searchParams;
  const nombre = NOMBRES[universo];
  if (!nombre) notFound();
  const tipoFiltro = tipo && TIPO_VALIDO.has(tipo) && tipo !== "" ? tipo : null;
  await ensureSchema();
  const catalogo = await obtenerCatalogo();
  const filtrados = catalogo.productos.filter(
    (p) => p.categoria === nombre && (!tipoFiltro || p.tipo === tipoFiltro),
  );
  const sesion = await leerSesion();
  const cliente = sesion?.role === "cliente";
  const favoritos = cliente ? await favoritosDe(sesion.u) : [];
  const acotado = tipoFiltro ? " · " + ETIQUETA_TIPO[tipoFiltro] : "";

  return (
    <main className="wrap catalog-view" style={{ paddingBottom: 70 }} id="catalogo">
      <div className="catalog-head">
        <div>
          <div className="eyebrow">Catálogo · {nombre}</div>
          <h1 tabIndex={-1}>{nombre + acotado}</h1>
          <p>
            {tipoFiltro
              ? "El resto del catálogo de " + nombre + " está sin este filtro."
              : "Los precios son los guardados en el servidor, con las ofertas activas."}
          </p>
        </div>
        <Link className="catalog-back" href="/productos">
          Volver a los universos
        </Link>
      </div>
      <VistaCatalogo
        productos={filtrados}
        cliente={cliente}
        favoritos={favoritos}
        titulo={nombre + acotado}
        subtitulo="Actualiza los filtros o contacta por encargo."
        universo={nombre}
        tipo={tipoFiltro}
        baseHref={"/productos/" + universo}
        breadcrumb={[
          { href: "/", texto: "Inicio" },
          { href: "/productos", texto: "Productos" },
          { href: "/productos/" + universo, texto: nombre },
        ]}
      />
    </main>
  );
}
