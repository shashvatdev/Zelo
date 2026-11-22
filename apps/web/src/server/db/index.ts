import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * One connection pool per server process (kept on globalThis so dev reloads don't leak pools).
 * Scale out by running more app instances; put PgBouncer/Neon pooling in front at high counts.
 */
const g = globalThis as unknown as { __zeloPool?: Pool };

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    application_name: "zelo-web",
  });
  pool.on("error", (e) => console.error("[db] idle client error", e.message));
  return pool;
}

export const pool = g.__zeloPool ?? (g.__zeloPool = makePool());
export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
