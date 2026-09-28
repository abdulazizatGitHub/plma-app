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
        test: {
          name: "web",
          environment: "jsdom",
          include: ["apps/web/src/**/*.test.ts"],
        },
      },
    ],
  },
});
