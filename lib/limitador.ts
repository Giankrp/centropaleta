import { ensureSchema, getPool } from "./inventario/bd.ts";
import { logAviso } from "./logger.ts";

export type Limite = { max: number; ventanaMinutos: number; bloqueoMinutos: number };

export async function permitir(clave: string, limite: Limite): Promise<boolean> {
  await ensureSchema();
  const { rows } = await getPool().query("SELECT intentos, desde, bloqueado_hasta FROM intentos WHERE clave=$1", [clave]);
  if (!rows.length) return true;
  const fila = rows[0] as { intentos: number; desde: string | Date; bloqueado_hasta: string | Date | null };
  if (fila.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) return false;
  const desde = new Date(fila.desde);
  if (Date.now() - desde.getTime() > limite.ventanaMinutos * 60000) return true;
  return fila.intentos < limite.max;
}

export async function registrar(clave: string, limite: Limite): Promise<void> {
  await ensureSchema();
  const corte = new Date(Date.now() - limite.ventanaMinutos * 60000).toISOString();
  const bloqueo = new Date(Date.now() + limite.bloqueoMinutos * 60000).toISOString();
  await getPool().query(
    `INSERT INTO intentos(clave, intentos, desde, bloqueado_hasta) VALUES($1, 1, now(), NULL)
     ON CONFLICT (clave) DO UPDATE SET
       intentos = CASE WHEN intentos.desde < $2::timestamptz THEN 1 ELSE intentos.intentos + 1 END,
       desde = CASE WHEN intentos.desde < $2::timestamptz THEN now() ELSE intentos.desde END,
       bloqueado_hasta = CASE WHEN (CASE WHEN intentos.desde < $2::timestamptz THEN 1 ELSE intentos.intentos + 1 END) >= $3 THEN $4::timestamptz ELSE intentos.bloqueado_hasta END`,
    [clave, corte, limite.max, bloqueo],
  );
  const { rows } = await getPool().query("SELECT bloqueado_hasta FROM intentos WHERE clave=$1", [clave]);
  const fila = rows[0] as { bloqueado_hasta: string | Date | null } | undefined;
  if (fila?.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) logAviso("limitador.bloqueado", { clave });
}

export async function reiniciar(clave: string): Promise<void> {
  await getPool().query("DELETE FROM intentos WHERE clave=$1", [clave]);
}

export function claveDe(ip: string, ambito: string, sujeto = ""): string {
  return `${ambito}:${ip}${sujeto ? ":" + sujeto.trim().toLowerCase() : ""}`;
}
