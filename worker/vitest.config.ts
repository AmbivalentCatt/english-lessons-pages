import path from "node:path";
import { fileURLToPath } from "node:url";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const directory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      miniflare: {
        bindings: {
          RATE_LIMIT_SALT: "synthetic-test-value-not-a-secret-32-characters-long",
          TEST_MIGRATIONS: await readD1Migrations(path.join(directory, "migrations")),
          TURNSTILE_SECRET_KEY: "synthetic-test-value-not-a-secret",
        },
      },
      wrangler: { configPath: path.join(directory, "wrangler.jsonc") },
    })),
  ],
  resolve: { alias: { "@": path.join(directory, "../src") } },
  test: {
    include: ["worker/test/**/*.test.ts"],
  },
});
