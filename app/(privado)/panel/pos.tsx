"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cobrarAccion } from "./acciones";

const PAGOS = ["Efectivo", "Tarjeta", "Bizum", "Otro"];
const ORDENES: Record<string, (a: Sku, b: Sku) => number> = {
  "price-asc": (a, b) => a.unidadCents - b.unidadCents || a.nombre.localeCompare(b.nombre, "es"),
  "price-desc": (a, b) => b.unidadCents - a.unidadCents || a.nombre.localeCompare(b.nombre, "es"),
  "name-asc": (a, b) => a.nombre.localeCompare(b.nombre, "es"),
  "name-desc": (a, b) => b.nombre.localeCompare(a.nombre, "es"),
  newest: (a, b) => b.id - a.id,
};

export type Sku = {
  id: number;
  nombre: string;
  categoria: string;
  set: string;
  codigo: string;
  unidadCents: number;
  precioCents: number;
  stock: number;
  imagenUrl: string | null;
};

function moneda(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

function parseCents(valor: string): number | null {
  const convertido = String(valor || "")
    .trim()
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(convertido)) return null;
  const parts = convertido.split(".");
  const total = Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0"));
  return Number.isSafeInteger(total) ? total : null;
}

export function PosSkus({ skus }: { skus: Sku[] }) {
  const [consulta, setConsulta] = useState("");
  const [orden, setOrden] = useState("default");
  const [ticket, setTicket] = useState<Record<string, number>>({});
  const [pago, setPago] = useState("Efectivo");
  const [recibido, setRecibido] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [ventaLista, setVentaLista] = useState<{
    id: string;
    total: number;
    change: number | null;
    lines: { qty: number; name: string }[];
  } | null>(null);
  const [escanearAbierto, setEscanearAbierto] = useState(false);
  const [estadoScan, setEstadoScan] = useState("");
  const [errorCamara, setErrorCamara] = useState(false);
  const [intentoScan, setIntentoScan] = useState(0);
  const [aviso, setAviso] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const reader = useRef<unknown>(null);
  const dialogoResult = useRef<HTMLDialogElement | null>(null);
  const dialogoScan = useRef<HTMLDialogElement | null>(null);

  const texto = consulta.toLowerCase();
  const coinciden = useMemo(
    () =>
      skus
        .filter((sku) =>
          `${sku.nombre} ${sku.categoria} ${sku.set} ${sku.codigo}`.toLowerCase().includes(texto),
        )
        .sort(ORDENES[orden] ?? (() => 0)),
    [skus, texto, orden],
  );

  const lineas = Object.entries(ticket)
    .map(([id, qty]) => ({ sku: skus.find((s) => String(s.id) === id)!, qty }))
    .filter((linea) => linea.sku);
  const total = lineas.reduce((sumado, linea) => sumado + linea.sku.unidadCents * linea.qty, 0);
  const recibidoCents = parseCents(recibido);
  const cambio = recibidoCents !== null && recibidoCents >= total ? recibidoCents - total : null;
  const falta = pago === "Efectivo" && (recibidoCents === null || recibidoCents < total);
  const stockOk = lineas.every((linea) => linea.qty <= linea.sku.stock);
  const bloqueado =
    !total || !stockOk || (pago === "Efectivo" ? falta || pendiente : !confirmado || pendiente);

  function añadir(sku: Sku) {
    if ((ticket[sku.id] || 0) >= sku.stock) {
      setAviso("No quedan más unidades disponibles");
      return;
    }
    setTicket({ ...ticket, [sku.id]: (ticket[sku.id] || 0) + 1 });
    setAviso("");
  }

  function paso(sku: Sku, delta: number) {
    const nuevo = Math.max(0, (ticket[sku.id] || 0) + delta);
    const copia = { ...ticket };
    if (nuevo === 0) delete copia[sku.id];
    else copia[sku.id] = nuevo;
    setTicket(copia);
    setConfirmado(false);
  }

  async function finaliza() {
    setPendiente(true);
    try {
      const resultado = await cobrarAccion({
        ticket,
        payment: pago,
        received: pago === "Efectivo" ? recibido : "",
        token: crypto.randomUUID(),
      });
      if (!resultado.ok) {
        setAviso(resultado.error);
        return;
      }
      setVentaLista(resultado.venta);
      dialogoResult.current?.showModal();
      setTicket({});
      setRecibido("");
      setConfirmado(false);
    } finally {
      setPendiente(false);
    }
  }

  function cerrarCámara() {
    reader.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    dialogoScan.current?.close();
  }

  useEffect(() => {
    if (!escanearAbierto) return;
    let cancelado = false;
    type Lector = {
      decodeFromConstraints: (
        conf: unknown,
        video: HTMLVideoElement,
        cb: (result: { getText: () => string } | undefined, error: unknown) => void,
      ) => Promise<void>;
    };
    (async () => {
      try {
        if (typeof (window as unknown as { ZXing?: unknown }).ZXing !== "object") {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "/vendor/zxing.min.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Falta la biblioteca de códigos"));
            document.body.append(script);
          });
        }
        if (cancelado) return;
        const flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelado) {
          flujo.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = flujo;
        if (videoRef.current) videoRef.current.srcObject = flujo;
        setErrorCamara(false);
        setEstadoScan("Cámara lista. Enfoca un código de barras o QR.");
        const ZXingG = (
          window as unknown as { ZXing: { BrowserMultiFormatReader: new () => Lector } }
        ).ZXing;
        const lector = new ZXingG.BrowserMultiFormatReader();
        reader.current = lector;
        await lector.decodeFromConstraints(
          { audio: false, video: {} },
          videoRef.current!,
          (resultado) => {
            if (!resultado) return;
            const sku = skus.find((s) => s.codigo === resultado.getText());
            if (!sku) {
              setEstadoScan(
                "Código " + resultado.getText() + " no asociado. Configúralo en Inventario.",
              );
              return;
            }
            añadir(sku);
            cancelado = true;
            cerrarCámara();
          },
        );
      } catch (error) {
        const nombre = error instanceof DOMException ? error.name : "";
        let mensaje = "No se pudo abrir la cámara. Comprueba que hay alguna conectada.";
        if (nombre === "NotAllowedError" || nombre === "SecurityError") {
          mensaje =
            "Permiso de cámara denegado. Permite la cámara en el candado de la barra de direcciones y vuelve a intentarlo.";
        } else if (
          nombre === "NotFoundError" ||
          nombre === "DevicesNotFoundError" ||
          nombre === "OverconstrainedError"
        ) {
          mensaje = "No se ha encontrado ninguna cámara. Conecta una y vuelve a intentarlo.";
        } else if (!window.isSecureContext) {
          mensaje = "La cámara necesita una conexión segura (HTTPS o localhost).";
        } else if (error instanceof Error && error.message) {
          mensaje = error.message;
        }
        setErrorCamara(true);
        setEstadoScan(mensaje);
      }
    })();
    return () => {
      cancelado = true;
      cerrarCámara();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escanearAbierto, intentoScan]);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="overline">MOSTRADOR</span>
          <h2>Venta física</h2>
          <p>Busca, suma al ticket y registra el cobro.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEscanearAbierto(true);
            dialogoScan.current?.showModal();
          }}
        >
          Escanear con cámara
        </button>
      </div>
      <div className="sale-layout">
        <div className="selection">
          <label htmlFor="pos-search">Buscar producto o código</label>
          <input
            id="pos-search"
            type="search"
            placeholder="Nombre, universo o código…"
            autoComplete="off"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
          />
          <label className="sort-control" htmlFor="pos-sort">
            <span>Ordenar por</span>
            <select id="pos-sort" value={orden} onChange={(e) => setOrden(e.target.value)}>
              <option value="default">Orden recomendado</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="name-asc">Nombre: A–Z</option>
              <option value="name-desc">Nombre: Z–A</option>
              <option value="newest">Más recientes</option>
            </select>
          </label>
          <div className="section-label">
            <h3>{consulta ? "Resultados" : "Productos"}</h3>
            <span>{coinciden.length} productos</span>
          </div>
          <div className="pos-products">
            {coinciden.length ? (
              coinciden.map((sku) => (
                <button
                  className="pos-product"
                  key={sku.id}
                  data-add={sku.id}
                  disabled={(ticket[sku.id] || 0) >= sku.stock}
                  onClick={() => añadir(sku)}
                >
                  {sku.imagenUrl ? (
                    <img src={sku.imagenUrl} alt="" />
                  ) : (
                    <span className="inventory-placeholder">📦</span>
                  )}
                  <small>
                    {sku.categoria} · {sku.codigo}
                  </small>
                  <b>{sku.nombre}</b>
                  <div className="product-bottom">
                    <strong>{moneda(sku.unidadCents)}</strong>
                    <span className={"stock" + (sku.stock <= 2 ? " low" : "")}>
                      {sku.stock} uds.
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="empty">No hay productos con ese nombre o código.</div>
            )}
          </div>
        </div>
        <div className="ticket">
          <div className="ticket-head">
            <h3>Ticket actual</h3>
            <button
              className="text-button"
              onClick={() => {
                setTicket({});
                setRecibido("");
                setConfirmado(false);
              }}
            >
              Vaciar
            </button>
          </div>
          <div id="ticket-lines">
            {lineas.length ? (
              lineas.map(({ sku, qty }) => (
                <div className="ticket-line" key={sku.id}>
                  <b>{sku.nombre}</b>
                  <small>{moneda(sku.unidadCents)} / unidad</small>
                  <div className="ticket-line-bottom">
                    <div className="qty">
                      <button onClick={() => paso(sku, -1)} aria-label="Quitar una unidad">
                        −
                      </button>
                      <span>{qty}</span>
                      <button
                        onClick={() => paso(sku, 1)}
                        disabled={qty >= sku.stock}
                        aria-label="Añadir una unidad"
                      >
                        ＋
                      </button>
                    </div>
                    <strong>{moneda(sku.unidadCents * qty)}</strong>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">
                El ticket está vacío.
                <br />
                Selecciona un producto para empezar.
              </div>
            )}
          </div>
          <div className="ticket-total">
            <span>Total</span>
            <strong>{moneda(total)}</strong>
          </div>
          <label htmlFor="payment">Forma de pago</label>
          <select
            id="payment"
            value={pago}
            onChange={(e) => {
              setPago(e.target.value);
              setConfirmado(false);
            }}
          >
            {PAGOS.map((modo) => (
              <option key={modo}>{modo}</option>
            ))}
          </select>
          {pago === "Efectivo" ? (
            <div id="cash-fields">
              <label htmlFor="received">Efectivo entregado (€)</label>
              <input
                id="received"
                inputMode="decimal"
                placeholder="0,00"
                autoComplete="off"
                value={recibido}
                onChange={(e) => setRecibido(e.target.value)}
              />
              <div className="cash-shortcuts">
                {[
                  ["Exacto", total],
                  ["10 €", 1000],
                  ["20 €", 2000],
                  ["50 €", 5000],
                ].map(([texto, centavos]) => (
                  <button
                    key={texto as string}
                    data-cash={centavos as number}
                    disabled={(centavos as number) < total || !total}
                    onClick={() =>
                      setRecibido(((centavos as number) / 100).toFixed(2).replace(".", ","))
                    }
                  >
                    {texto as string}
                  </button>
                ))}
              </div>
              <div className={"change-box" + (cambio !== null ? "" : " short")}>
                <span>
                  {falta && recibidoCents !== null ? "Falta por entregar" : "Cambio a devolver"}
                </span>
                <strong>
                  {moneda(
                    cambio === null ? (recibidoCents !== null ? total - recibidoCents : 0) : cambio,
                  )}
                </strong>
              </div>
            </div>
          ) : (
            <div id="terminal-fields">
              <p className="terminal-message">Cobrar {moneda(total)} en TPV</p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={confirmado}
                  onChange={(e) => setConfirmado(e.target.checked)}
                />{" "}
                <span>He confirmado el cobro</span>
              </label>
            </div>
          )}
          {aviso ? (
            <p className="import-error" role="alert">
              {aviso}
            </p>
          ) : null}
          <button
            className="primary finish"
            id="sale-finish"
            disabled={bloqueado}
            onClick={finaliza}
          >
            {pendiente ? "Guardando…" : "Finalizar venta"}
          </button>
          <p className="micro">
            Descuenta el stock solo al finalizar. Tarjeta: cobra primero en tu TPV.
          </p>
        </div>
      </div>
      <dialog ref={dialogoResult} onClose={() => setVentaLista(null)}>
        <div className="dialog-head">
          <h2>Venta registrada</h2>
          <button className="outline" onClick={() => dialogoResult.current?.close()}>
            Cerrar
          </button>
        </div>
        {ventaLista ? (
          <div>
            <p>{ventaLista.id}</p>
            <ul className="sale-summary-lines">
              {ventaLista.lines.map((linea, indice) => (
                <li key={indice}>
                  {linea.qty} × {linea.name}
                </li>
              ))}
            </ul>
            <div className="sale-summary-total">{moneda(ventaLista.total)}</div>
            {ventaLista.change !== null ? (
              <div className="change-box">
                <span>Cambio a devolver</span>
                <strong>{moneda(ventaLista.change)}</strong>
              </div>
            ) : null}
            <p className="micro">Stock descontado. Guardado en el servidor.</p>
          </div>
        ) : null}
      </dialog>
      <dialog ref={dialogoScan} onClose={() => setEscanearAbierto(false)}>
        <div className="dialog-head">
          <h2>Escanear código</h2>
          <button className="outline" onClick={cerrarCámara}>
            Cerrar
          </button>
        </div>
        <video ref={videoRef} autoPlay playsInline muted suppressHydrationWarning />
        <p className={"import-error" + (errorCamara ? " scan-error" : "")} role="status">
          {estadoScan}
        </p>
        {errorCamara ? (
          <button className="primary" onClick={() => setIntentoScan((n) => n + 1)}>
            Reintentar cámara
          </button>
        ) : null}
        <label className="field">
          <span>Código manual</span>
          <input
            onChange={(e) => {
              const sku = skus.find((s) => s.codigo === e.target.value.trim());
              if (sku) {
                añadir(sku);
                e.target.value = "";
                cerrarCámara();
              }
            }}
            placeholder="Escribe o pega el código"
          />
        </label>
      </dialog>
      <div id="panel-toast" className={aviso ? "show" : ""} role="status">
        {aviso}
      </div>
    </>
  );
}
