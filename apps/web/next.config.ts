import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
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
