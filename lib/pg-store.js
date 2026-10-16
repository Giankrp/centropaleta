import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const { Pool } = pg;
let pool;
let ready;

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está configurada");
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool;
}

export async function ensureSchema() {
  if (!ready) {
    const sql = [join("db/postgres.sql"), join("db/app.sql")]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");
    ready = getPool().query(sql).catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

export function toPg(sql) {
  const text = sql.replace(
    "INSERT OR IGNORE INTO inventory_revision(id,revision,mutation,next_id) VALUES(1,0,'',1)",
    "INSERT INTO inventory_revision(id,revision,mutation,next_id) VALUES(1,0,'',1) ON CONFLICT (id) DO NOTHING",
  );
  let n = 0;
  return text.replace(/\?/g, () => `$${++n}`);
}

function statement(sql, values = []) {
  return {
    bind(...args) {
      return statement(sql, args);
    },
    async first() {
      const result = await getPool().query(toPg(sql), values);
      return result.rows[0] || null;
    },
    async all() {
      const result = await getPool().query(toPg(sql), values);
      return { results: result.rows };
    },
    sql,
    values,
  };
}

export function inventoryDb() {
  return {
    prepare(sql) {
      return statement(sql);
    },
    async batch(statements) {
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        const out = [];
        for (const item of statements) {
          const result = await client.query(toPg(item.sql), item.values || []);
          out.push({ results: result.rows, meta: { changes: result.rowCount } });
        }
        await client.query("COMMIT");
        return out;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
