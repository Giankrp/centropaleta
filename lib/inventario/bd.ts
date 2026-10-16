import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const { Pool } = pg;
let pool: import("pg").Pool | undefined;
let ready: Promise<void> | undefined;

export type Filas<T> = { rows: T[]; rowCount: number | null };

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está configurada");
  if (!pool) {
    const url = process.env.DATABASE_URL;
    const local = /@(localhost|127\.0\.0\.1)[:,/]/.test(url) || /sslmode=disable/.test(url);
    pool = new Pool({
      connectionString: url,
      max: 5,
      ...(local ? {} : { ssl: { rejectUnauthorized: false } }),
    });
  }
  return pool;
}

export async function ensureSchema() {
  if (!ready) {
    const sql = readFileSync(join(process.cwd(), "db/inventario.sql"), "utf8");
    const pendiente = getPool()
      .query(sql)
      .then(
        () => undefined,
        (error: unknown) => {
          ready = undefined;
          throw error;
        },
      );
    ready = pendiente as Promise<void>;
  }
  await ready;
}

export async function consulta<T = Record<string, unknown>>(
  sql: string,
  valores: unknown[] = [],
): Promise<Filas<T>> {
  const resultado = await getPool().query(sql, valores);
  return { rows: resultado.rows as T[], rowCount: resultado.rowCount };
}
