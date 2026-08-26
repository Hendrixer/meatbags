import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read .env itself, and the npm scripts pass --env-file to
// tsx rather than to the kit CLI. Load it here so `npx drizzle-kit push` works.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env — rely on the ambient environment.
}

const url = process.env.HORIZON_URL ?? "";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
    // Azure Postgres requires SSL; the firewall is open for demo day, so we
    // don't pin a CA. A local test DB can opt out with sslmode=disable.
    ssl: /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false },
  },
});
