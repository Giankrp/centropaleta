type Nivel = "info" | "warn" | "error";

function emitir(nivel: Nivel, contexto: string, detalles?: unknown): void {
  const detalle = detalles instanceof Error ? { mensaje: detalles.message, pila: detalles.stack } : detalles;
  const linea = JSON.stringify({ t: new Date().toISOString(), nivel, contexto, ...(detalle === undefined ? {} : { detalle }) });
  if (nivel === "error") console.error(linea);
  else if (nivel === "warn") console.warn(linea);
  else console.log(linea);
}

export function logInfo(contexto: string, detalles?: unknown): void {
  emitir("info", contexto, detalles);
}

export function logAviso(contexto: string, detalles?: unknown): void {
  emitir("warn", contexto, detalles);
}

export function logError(contexto: string, error: unknown): void {
  emitir("error", contexto, error);
}
