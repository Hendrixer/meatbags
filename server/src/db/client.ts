/**
 * The Drizzle handle over a lazily-built `pg` Pool.
 *
 * Built on first use so importing this module never throws when HORIZON_URL is
 * absent — the Express server and the Discord bot both need to boot without a
 * database configured.
 */
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { config, require_ } from "../config.js";
import * as schema from "./schema.js";

let pool: pg.Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    const url = require_(config.horizonUrl, "HORIZON_URL");
    // Azure Postgres requires SSL; the firewall is open for demo day, so we
    // don't pin a CA. A local test DB can opt out with sslmode=disable.
    const ssl = /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false };
    pool = new pg.Pool({ connectionString: url, ssl, max: 5 });
    db = drizzle(pool, { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}
