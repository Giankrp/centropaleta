import Link from "next/link";
import type { Metadata } from "next";
import { obtenerCatalogo } from "../../../lib/catalogo.ts";
import { leerSesion } from "../../../lib/sesion-servidor.ts";
import { favoritosDe } from "../../../lib/usuarios.ts";
import { VistaCatalogo } from "./vista-catalogo";
import { ensureSchema } from "../../../lib/inventario/bd.ts";

const TIPO_VALIDO = new Set(["", "cartas", "sellado", "mistery-packs"]);

export const metadata: Metadata = {
  title: "Todos los productos — Centro Paleta",
  description: "Catálogo completo de cartas y coleccionables: Pokémon, One Piece, Lorcana, Dragon Ball y Naruto.",
};

export default async function PaginaProductos({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  await ensureSchema();
  const { tipo } = await searchParams;
  const tipoFiltro = tipo && TIPO_VALIDO.has(tipo) && tipo !== "" ? tipo : null;
  const catalogo = await obtenerCatalogo();
  const filtrados = tipoFiltro ? catalogo.productos.filter((p) => p.tipo === tipoFiltro) : catalogo.productos;
  const sesion = await leerSesion();
  const cliente = sesion?.role === "cliente";
  const favoritos = cliente ? await favoritosDe(sesion.u) : [];
  const acotado = tipoFiltro ? " · " + ({ cartas: "Cartas", sellado: "Sellado", "mistery-packs": "Mystery Pack" }[tipoFiltro] ?? "") : "";

  return (
    <main className="wrap catalog-view" style={{ paddingBottom: 70 }} id="catalogo">
      <div className="catalog-head">
        <div>
          <div className="eyebrow">Centro Paleta · Catálogo</div>
          <h1 tabIndex={-1}>Todos los productos{acotado}</h1>
          <p>Elige un universo o filtra por tipo para ver lo guardado en la tienda.</p>
        </div>
      </div>
      <div className="universe-picker">
        <Link className="universe-tile all-universes-tile selected" href="/productos"><span>VER TODOS</span><small>Todos los universos</small></Link>
        {[["pokemon", "POKÉMON"], ["one-piece", "ONE PIECE"], ["lorcana", "LORCANA"], ["dragon-ball", "DRAGON BALL"], ["naruto", "NARUTO"]].map(([slug, texto]) => (
          <Link key={slug} className={"universe-tile " + slug + "-tile"} href={"/productos/" + slug}><span>{texto}</span></Link>
        ))}
      </div>
      <VistaCatalogo productos={filtrados} cliente={cliente} favoritos={favoritos} titulo={"Todos los productos" + acotado} subtitulo="Ajusta los filtros o contacta por encargo desde la portada." universo={null} tipo={tipoFiltro} baseHref="/productos" breadcrumb={[{ href: "/", texto: "Inicio" }]} />
    </main>
  );
}
