import pg from "pg";

/** Empties the test database before the run (the schema itself comes from migrations). */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/zelo_test";
  if (!/zelo_test/.test(url)) throw new Error(`Refusing to wipe a non-test database: ${url}`);
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const { rows } = await c.query<{ t: string }>(`select tablename as t from pg_tables where schemaname = 'public'`);
  if (rows.length) await c.query(`truncate ${rows.map((r) => `"${r.t}"`).join(", ")} restart identity cascade`);
  await c.end();
  const res = await fetch(`${process.env.TEST_URL ?? "http://localhost:3300"}/api/health`).catch(() => null);
  if (!res?.ok) throw new Error("Test server is not running on TEST_URL (default http://localhost:3300). Start it with scripts/test-server.sh");
}
