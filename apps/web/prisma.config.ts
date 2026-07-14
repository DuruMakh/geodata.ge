import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Match Next.js env-file precedence: shell env wins, then .env.local, then
// .env (dotenv never overrides already-set variables).
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

// The fallback host never resolves; it exists so `prisma generate` (which
// needs no database) keeps working without a .env, while any command that
// actually connects fails with a hostname that says what to fix.
const datasourceUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://missing-env:missing-env@geodata-env-not-configured-see-apps-web-env-example:5432/geodata";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl,
  },
});
