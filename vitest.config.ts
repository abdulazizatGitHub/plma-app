import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "shared",
          environment: "node",
          include: ["packages/shared/src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "api",
          environment: "node",
          include: ["apps/api/src/**/*.test.ts"],
        },
      },
      {
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "apps/web/src"),
          },
        },
        test: {
          name: "web",
          environment: "jsdom",
          // Some UI tests wait for rows to settle (SETTLE_MS) before asserting where they land.
          testTimeout: 15_000,
          include: ["apps/web/src/**/*.test.{ts,tsx}"],
          setupFiles: ["apps/web/vitest.setup.ts"],
        },
      },
    ],
  },
});
