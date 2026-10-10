import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

// Shared secrets live in the repo-root .env.local (docs/guides/AUTH_SETUP.md).
// Next has already loaded apps/web/.env*, which win; this only fills what's
// missing. (@next/env's loadEnvConfig caches its first directory, so it can't
// be used to add a second one.)
const rootEnv = path.resolve(process.cwd(), "../../.env.local");
if (existsSync(rootEnv)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(rootEnv, "utf8")))) {
    if (process.env[key] === undefined && value !== undefined) process.env[key] = value;
  }
}

// App routes precached so every screen opens offline, even before its first
// visit. Revisioned per build so a new deploy refreshes them.
const BUILD_REVISION = Date.now().toString(36);
const OFFLINE_ROUTES = ["/", "/categories", "/categories/view", "/items/edit", "/pending", "/progress", "/profile", "/sign-in"];

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: OFFLINE_ROUTES.map((url) => ({ url, revision: BUILD_REVISION })),
});

const nextConfig: NextConfig = {
  // The floating dev badge covered the top-bar avatar; errors still surface without it.
  devIndicators: false,
  transpilePackages: ["@life/shared"],
  webpack: (config) => {
    // @life/shared's TS source uses NodeNext-style relative imports with a
    // ".js" extension pointing at ".ts" files (e.g. "./health.js" ->
    // "./health.ts"). tsc/Node resolve that natively; webpack does not
    // unless told to also try ".ts"/".tsx" when a ".js" specifier 404s.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default withSerwist(nextConfig);
