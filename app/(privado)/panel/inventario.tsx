"use client";

import { useState } from "react";
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
  cartas: "Cartas",
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

  async function muta(body: {
    operation: string;
    args: unknown[];
    productVersion?: number;
  }): Promise<boolean> {
    const resultado = await inventarioAccion(body);
    if (!resultado.ok) {
      setMsj(resultado.error);
      return false;
    }
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
        <div className="heading-actions">
          <a className="outline" href="/panel/descargas/inventario">
            Descargar CSV
          </a>
          <a className="outline" href="/panel/inventario-impreso" target="_blank" rel="noopener">
            Descargar PDF
          </a>
          <button className="primary" onClick={() => setAltaAbierta(true)}>
            Añadir producto
          </button>
        </div>
      </div>
      {msj ? (
        <p className="import-error" role="alert">
          {msj}
        </p>
      ) : null}
      <div className="section-label">
        <span>{productos.length} productos</span>
      </div>
      {productos.map((producto) => (
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
            <strong className={"inventory-stock" + (producto.stock <= producto.min ? " low" : "")}>
              {producto.stock}
              <span>unidades</span>
            </strong>
          </header>
          <form
            className="receive-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const unidades = form.elements.namedItem("units") as HTMLInputElement;
              const ok = await muta({
                operation: "replenish",
                args: [producto.id, Number(unidades.value)],
              });
              if (ok) form.reset();
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
                await muta({
                  operation: "deleteProduct",
                  args: [producto.id],
                  productVersion: producto.version,
                });
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
                  const ok = await muta({
                    operation: "associateCode",
                    args: [producto.id, codigo.value],
                  });
                  if (ok) form.reset();
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
      <label>Nombre del producto</label>
      <input
        value={form.nombre}
        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        required
      />
      <div className="form-pair">
        <div>
          <label>Universo</label>
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
          <label>Tipo</label>
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
          <label>Código de barras / QR{alta ? "" : ""}</label>
          <input
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            placeholder={alta ? "Automático si lo dejas vacío" : ""}
            maxLength={128}
          />
        </div>
        <div>
          <label>Precio (€)</label>
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
          <label>Unidades iniciales</label>
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
          <label>Stock mínimo</label>
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
        placeholder={form.tipo === "sellado" ? "Sellado" : "Raw, TG, NM…"}
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
