"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { inventarioAccion } from "./acciones";
import { formatearCents } from "../../../lib/precios.ts";

export type ProductoAdmin = {
  id: number;
  nombre: string;
  categoria: string;
  tipo: string;
  set: string;
  codigo: string;
  descripcion: string;
  estado: string;
  emblema: string | null;
  precioUnidadCents: number;
  precioBaseCents: number;
  descuento: number;
  stock: number;
  min: number;
  target: number;
  barcodes: string[];
  version: number;
  imagenUrl: string | null;
  photoActual: boolean;
};

const UNIVERSOS = ["Pokémon", "One Piece", "Lorcana", "Dragon Ball", "Naruto", "Otro TCG"];
const TIPOS: Record<string, string> = {
  "cartas-raw": "Cartas · Raw",
  "cartas-gradeada": "Cartas · Gradeada",
  sobres: "Sobres",
  sellado: "Sellado",
  "mistery-packs": "Mystery Packs",
};
type Formulario = {
  nombre: string;
  categoria: string;
  tipo: string;
  set: string;
  codigo: string;
  precio: string;
  stock: string;
  min: string;
  target: string;
  descripcion: string;
  estado: string;
  emblema: string;
  foto: File | null;
};

function vacio(): Formulario {
  return {
    nombre: "",
    categoria: "Pokémon",
    tipo: "sellado",
    set: "",
    codigo: "",
    precio: "",
    stock: "0",
    min: "3",
    target: "10",
    descripcion: "",
    estado: "",
    emblema: "",
    foto: null,
  };
}

function formatearPeso(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function leerImagen(file: File): Promise<string> {
  if (file.size > 15 * 1024 * 1024)
    throw new Error("La imagen supera el máximo de 15 MB. Prueba con una más pequeña.");
  return await new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(file);
  });
}

export function InventarioCliente({ productos }: { productos: ProductoAdmin[] }) {
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [editando, setEditando] = useState<ProductoAdmin | null>(null);
  const [msj, setMsj] = useState("");

  const parametros = useSearchParams();
  const [filtros, setFiltros] = useState(() => ({
    texto: parametros.get("q") ?? "",
    universo: parametros.get("u") ?? "",
    tipo: parametros.get("t") ?? "",
    estado: parametros.get("e") ?? "",
    precioMin: parametros.get("pmin") ?? "",
    precioMax: parametros.get("pmax") ?? "",
    stockMin: parametros.get("smin") ?? "",
    stockMax: parametros.get("smax") ?? "",
    vista: parametros.get("vista") ?? "",
    orden: parametros.get("orden") ?? "default",
  }));
  const estados = useMemo(
    () =>
      [...new Set(productos.map((p) => p.estado).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [productos],
  );

  function cambia(parte: Partial<typeof filtros>) {
    const siguientes = { ...filtros, ...parte };
    setFiltros(siguientes);
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(siguientes)) {
      if (valor && !(clave === "orden" && valor === "default")) params.set(clave, String(valor));
    }
    const consulta = params.toString();
    window.history.replaceState(
      null,
      "",
      "/panel?tab=inventario" + (consulta ? "&" + consulta : ""),
    );
  }

  const filtrados = useMemo(() => {
    const texto = filtros.texto.trim().toLowerCase();
    const aNumero = (valor: string, porDefecto: number) => {
      const numero = Number(valor.replace(",", "."));
      return valor !== "" && Number.isFinite(numero) ? numero : porDefecto;
    };
    const pmin = aNumero(filtros.precioMin, 0);
    const pmax = aNumero(filtros.precioMax, Infinity);
    const smin = aNumero(filtros.stockMin, -Infinity);
    const smax = aNumero(filtros.stockMax, Infinity);
    const lista = productos.filter((p) => {
      if (texto && !`${p.nombre} ${p.codigo} ${p.barcodes.join(" ")}`.toLowerCase().includes(texto))
        return false;
      if (filtros.universo && p.categoria !== filtros.universo) return false;
      if (filtros.tipo && p.tipo !== filtros.tipo) return false;
      if (filtros.estado && p.estado !== filtros.estado) return false;
      const precio = p.precioUnidadCents / 100;
      if (precio < pmin || precio > pmax) return false;
      if (p.stock < smin || p.stock > smax) return false;
      if (filtros.vista === "bajo-minimo" && !(p.stock > 0 && p.stock <= p.min)) return false;
      if (filtros.vista === "agotados" && p.stock !== 0) return false;
      if (filtros.vista === "en-oferta" && p.descuento <= 0) return false;
      if (filtros.vista === "sin-foto" && p.photoActual) return false;
      return true;
    });
    const ordenadores: Record<string, (a: ProductoAdmin, b: ProductoAdmin) => number> = {
      default: (a, b) => a.id - b.id,
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
      "precio-asc": (a, b) => a.precioUnidadCents - b.precioUnidadCents,
      "precio-desc": (a, b) => b.precioUnidadCents - a.precioUnidadCents,
      "stock-asc": (a, b) => a.stock - b.stock,
      "stock-desc": (a, b) => b.stock - a.stock,
      recientes: (a, b) => b.id - a.id,
    };
    return [...lista].sort(ordenadores[filtros.orden] ?? ordenadores.default);
  }, [productos, filtros]);

  const resumen = useMemo(() => {
    const unidades = filtrados.reduce((total, p) => total + p.stock, 0);
    const valor = filtrados.reduce((total, p) => total + p.precioUnidadCents * p.stock, 0);
    return { unidades, valor };
  }, [filtrados]);

  async function muta(body: {
    operation: string;
    args: unknown[];
    productVersion?: number;
  }): Promise<boolean> {
    const resultado = await inventarioAccion(body);
    if (!resultado.ok) throw new Error(resultado.error);
    setMsj("");
    return true;
  }

  async function enviaAlta(form: Formulario) {
    const patch: Record<string, unknown> = {
      name: form.nombre,
      cat: form.categoria,
      type: form.tipo,
      set: form.set,
      code: form.codigo,
      price: Number(form.precio.replace(",", ".")),
      stock: Number(form.stock),
      min: Number(form.min),
      target: Number(form.target),
      description: form.descripcion,
      condition: form.estado,
      badge: form.emblema || undefined,
    };
    if (form.foto) patch.photo = await leerImagen(form.foto);
    const ok = await muta({ operation: "addProduct", args: [patch] });
    if (ok) setAltaAbierta(false);
  }

  async function enviaEdicion(form: Formulario, producto: ProductoAdmin, quitarFoto: boolean) {
    const patch: Record<string, unknown> = {
      name: form.nombre,
      description: form.descripcion,
      set: form.set,
      code: form.codigo,
      price: Number(form.precio.replace(",", ".")),
      stock: Number(form.stock),
      min: Number(form.min),
      target: Number(form.target),
      condition: form.estado,
      badge: form.emblema || null,
    };
    if (quitarFoto) patch.photo = null;
    else if (form.foto) patch.photo = await leerImagen(form.foto);
    const ok = await muta({
      operation: "updateProduct",
      args: [producto.id, patch],
      productVersion: producto.version,
    });
    if (ok) setEditando(null);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="overline">INVENTARIO</span>
          <h2>Inventario</h2>
          <p>Recepción, fichas, códigos y ofertas.</p>
        </div>
        <button className="primary" onClick={() => setAltaAbierta(true)}>
          Añadir producto
        </button>
      </div>
      {msj ? (
        <p className="import-error" role="alert">
          {msj}
        </p>
      ) : null}
      <div className="inventario-filtros">
        <div className="filtros-fila">
          <input
            className="filtro-texto"
            placeholder="Buscar por nombre, código o código de barras…"
            value={filtros.texto}
            onChange={(e) => cambia({ texto: e.target.value })}
          />
          <label className="filtro-orden">
            Ordenar
            <select value={filtros.orden} onChange={(e) => cambia({ orden: e.target.value })}>
              <option value="default">Recomendado</option>
              <option value="nombre">Nombre A–Z</option>
              <option value="precio-asc">Precio: menor a mayor</option>
              <option value="precio-desc">Precio: mayor a menor</option>
              <option value="stock-asc">Stock: menor a mayor</option>
              <option value="stock-desc">Stock: mayor a menor</option>
              <option value="recientes">Más recientes</option>
            </select>
          </label>
        </div>
        <div className="filtros-fila">
          <label className="filtro-rango">
            Universo
            <select value={filtros.universo} onChange={(e) => cambia({ universo: e.target.value })}>
              <option value="">Todos</option>
              {UNIVERSOS.map((universo) => (
                <option key={universo} value={universo}>
                  {universo}
                </option>
              ))}
            </select>
          </label>
          <label className="filtro-rango">
            Tipo
            <select value={filtros.tipo} onChange={(e) => cambia({ tipo: e.target.value })}>
              <option value="">Todos</option>
              {Object.entries(TIPOS).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </label>
          <label className="filtro-rango">
            Estado
            <select value={filtros.estado} onChange={(e) => cambia({ estado: e.target.value })}>
              <option value="">Todos</option>
              {estados.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </label>
          <label className="filtro-rango">
            Vista
            <select value={filtros.vista} onChange={(e) => cambia({ vista: e.target.value })}>
              <option value="">Todas</option>
              <option value="bajo-minimo">Bajo mínimo</option>
              <option value="agotados">Agotados</option>
              <option value="en-oferta">En oferta</option>
              <option value="sin-foto">Sin foto</option>
            </select>
          </label>
          <label className="filtro-rango">
            Precio €
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="mín"
              value={filtros.precioMin}
              onChange={(e) => cambia({ precioMin: e.target.value })}
            />
            <span>–</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="máx"
              value={filtros.precioMax}
              onChange={(e) => cambia({ precioMax: e.target.value })}
            />
          </label>
          <label className="filtro-rango">
            Stock
            <input
              type="number"
              min="0"
              step="1"
              placeholder="mín"
              value={filtros.stockMin}
              onChange={(e) => cambia({ stockMin: e.target.value })}
            />
            <span>–</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="máx"
              value={filtros.stockMax}
              onChange={(e) => cambia({ stockMax: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="filtro-chip filtro-limpiar"
            onClick={() =>
              cambia({
                texto: "",
                universo: "",
                tipo: "",
                estado: "",
                precioMin: "",
                precioMax: "",
                stockMin: "",
                stockMax: "",
                vista: "",
              })
            }
          >
            Limpiar filtros
          </button>
        </div>
      </div>
      <div className="section-label inventario-resumen">
        <span>
          {filtrados.length} productos · {resumen.unidades} unidades ·{" "}
          {formatearCents(resumen.valor)} en stock
        </span>
      </div>
      {filtrados.length === 0 ? (
        <div className="empty">Ningún producto coincide con los filtros.</div>
      ) : null}
      {filtrados.map((producto) => (
        <article className="inventory-row" key={producto.id}>
          <header>
            {producto.imagenUrl ? (
              <img src={producto.imagenUrl} alt={producto.nombre} />
            ) : (
              <span className="inventory-placeholder">📦</span>
            )}
            <div className="inventory-title">
              <h3>{producto.nombre}</h3>
              <small>
                {producto.categoria} · {producto.codigo} ·{" "}
                {formatearCents(producto.precioUnidadCents)}
                {producto.descuento > 0 ? " (en oferta −" + producto.descuento + "%)" : ""}
              </small>
            </div>
            <div className="inventory-valor">
              <strong
                className={"inventory-stock" + (producto.stock <= producto.min ? " low" : "")}
              >
                {producto.stock}
                <span>unidades</span>
              </strong>
              <small>Valor: {formatearCents(producto.precioUnidadCents * producto.stock)}</small>
            </div>
          </header>
          <form
            className="receive-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const unidades = form.elements.namedItem("units") as HTMLInputElement;
              try {
                const ok = await muta({
                  operation: "replenish",
                  args: [producto.id, Number(unidades.value)],
                });
                if (ok) form.reset();
              } catch (error) {
                setMsj(error instanceof Error ? error.message : "No se pudo reponer");
              }
            }}
          >
            <label htmlFor={"receive-" + producto.id}>Añadir existencias</label>
            <div>
              <input
                id={"receive-" + producto.id}
                name="units"
                type="number"
                min={1}
                step={1}
                placeholder="Unidades recibidas"
                required
              />
              <button className="primary">+ Sumar stock</button>
            </div>
          </form>
          <div className="shipping-actions">
            <a
              className="outline"
              href={"/panel/etiquetas?ids=" + producto.id}
              target="_blank"
              rel="noopener"
            >
              Imprimir etiqueta
            </a>
            <button className="outline" type="button" onClick={() => setEditando(producto)}>
              Editar producto
            </button>
            <button
              className="outline"
              type="button"
              onClick={async () => {
                if (
                  !confirm("Eliminar " + producto.nombre + "? El historial de ventas se conserva.")
                )
                  return;
                try {
                  await muta({
                    operation: "deleteProduct",
                    args: [producto.id],
                    productVersion: producto.version,
                  });
                } catch (error) {
                  setMsj(error instanceof Error ? error.message : "No se pudo eliminar");
                }
              }}
            >
              Eliminar producto
            </button>
          </div>
          <details className="inventory-settings">
            <summary>Asociar códigos extra ({producto.barcodes.length})</summary>
            <div className="inventory-fields">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const codigo = form.elements.namedItem("barcode") as HTMLInputElement;
                  try {
                    const ok = await muta({
                      operation: "associateCode",
                      args: [producto.id, codigo.value],
                    });
                    if (ok) form.reset();
                  } catch (error) {
                    setMsj(error instanceof Error ? error.message : "No se pudo asociar");
                  }
                }}
              >
                <input
                  name="barcode"
                  placeholder="Código extra (EAN, QR…)"
                  maxLength={128}
                  required
                />
                <button className="primary">Asociar</button>
              </form>
              {producto.barcodes.map((codigo) => (
                <small key={codigo} className="barcode-chip">
                  {codigo}
                  <button
                    type="button"
                    className="link-danger"
                    title="Quitar código"
                    aria-label={"Quitar código " + codigo}
                    onClick={() =>
                      muta({ operation: "removeBarcode", args: [producto.id, codigo] })
                    }
                  >
                    ✕
                  </button>
                </small>
              ))}
            </div>
          </details>
        </article>
      ))}

      {altaAbierta ? (
        <div
          className="inventario-modal-overlay"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setAltaAbierta(false);
          }}
        >
          <div
            className="inventario-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Añadir producto"
          >
            <FichaProducto
              titulo="Añadir producto"
              datos={vacio()}
              alta
              fotoActual={false}
              onEnviar={enviaAlta}
              onCerrar={() => setAltaAbierta(false)}
            />
          </div>
        </div>
      ) : null}
      {editando ? (
        <div
          className="inventario-modal-overlay"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setEditando(null);
          }}
        >
          <div
            className="inventario-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Editar producto"
          >
            <FichaProducto
              titulo="Editar producto"
              datos={deDatos(editando)}
              alta={false}
              fotoActual={editando.photoActual}
              onEnviar={(form, quitar) => enviaEdicion(form, editando, quitar)}
              onCerrar={() => setEditando(null)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function deDatos(p: ProductoAdmin): Formulario {
  return {
    nombre: p.nombre,
    categoria: p.categoria,
    tipo: p.tipo,
    set: p.set,
    codigo: p.codigo,
    precio: (p.precioBaseCents / 100).toFixed(2),
    stock: String(p.stock),
    min: String(p.min),
    target: String(p.target),
    descripcion: p.descripcion,
    estado: p.estado,
    emblema: p.emblema ?? "",
    foto: null,
  };
}

function FichaProducto({
  titulo,
  datos,
  alta,
  fotoActual,
  onEnviar,
  onCerrar,
}: {
  titulo: string;
  datos: Formulario;
  alta: boolean;
  fotoActual: boolean;
  onEnviar: (form: Formulario, quitarFoto: boolean) => Promise<void>;
  onCerrar: () => void;
}) {
  const [form, setForm] = useState<Formulario>(datos);
  const [error, setError] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const [quitar, setQuitar] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPendiente(true);
    try {
      await onEnviar(form, quitar);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setPendiente(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="dialog-head">
        <h2>{titulo}</h2>
        <button type="button" className="outline" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
      <p className="nota-requeridos">Los campos con * son obligatorios</p>
      <label>Nombre del producto *</label>
      <input
        value={form.nombre}
        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        required
      />
      <div className="form-pair">
        <div>
          <label>Universo *</label>
          <select
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          >
            {UNIVERSOS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Tipo *</label>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            {Object.entries(TIPOS).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label>Descripción para el cliente</label>
      <textarea
        value={form.descripcion}
        onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        maxLength={5000}
        rows={4}
      />
      <label>Expansión</label>
      <input value={form.set} onChange={(e) => setForm({ ...form, set: e.target.value })} />
      <div className="form-pair">
        <div>
          <label>Número de referencia{alta ? " · automático si lo dejas vacío" : ""}</label>
          <input
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            placeholder={alta ? "Automático si lo dejas vacío" : ""}
            maxLength={128}
          />
        </div>
        <div>
          <label>Precio (€) *</label>
          <input
            value={form.precio}
            onChange={(e) => setForm({ ...form, precio: e.target.value })}
            type="number"
            min="0.01"
            step="0.01"
            required
          />
        </div>
      </div>
      <div className="form-pair">
        <div>
          <label>Unidades iniciales *</label>
          <input
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            type="number"
            min="0"
            step="1"
            required
          />
        </div>
        <div>
          <label>Stock mínimo *</label>
          <input
            value={form.min}
            onChange={(e) => setForm({ ...form, min: e.target.value })}
            type="number"
            min="0"
            step="1"
            required
          />
        </div>
      </div>
      <label>Objetivo de stock</label>
      <input
        value={form.target}
        onChange={(e) => setForm({ ...form, target: e.target.value })}
        type="number"
        min="0"
        step="1"
        required
      />
      <label>Estado</label>
      <input
        value={form.estado}
        onChange={(e) => setForm({ ...form, estado: e.target.value })}
        maxLength={100}
        placeholder={
          form.tipo === "sobres" || form.tipo === "sellado" || form.tipo === "mistery-packs"
            ? "Sellado"
            : form.tipo === "cartas-gradeada"
              ? "PSA 10, BGS 9.5…"
              : "Raw, TG, NM…"
        }
      />
      <label>
        Imagen del producto (JPG, PNG, WebP o GIF · máx. 15 MB)
        {alta ? "" : " · dejar vacío para conservar la actual"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          onChange={(e) => setForm({ ...form, foto: e.target.files?.[0] ?? null })}
        />
      </label>
      <p className="note">Se optimiza automáticamente al guardar (WebP, máx. 1200 px).</p>
      <label>Etiqueta destacada (badge)</label>
      <input
        value={form.emblema}
        onChange={(e) => setForm({ ...form, emblema: e.target.value })}
        maxLength={20}
      />
      {form.foto ? (
        <p className="note">
          Imagen seleccionada: {form.foto.name} ({formatearPeso(form.foto.size)})
        </p>
      ) : null}
      {!alta && fotoActual && !form.foto ? (
        <label className="check-row">
          <input type="checkbox" checked={quitar} onChange={(e) => setQuitar(e.target.checked)} />
          Quitar la foto actual
        </label>
      ) : null}
      {error ? (
        <p className="import-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary finish" disabled={pendiente}>
        {pendiente ? "Guardando…" : alta ? "Añadir al inventario" : "Guardar cambios"}
      </button>
    </form>
  );
}
