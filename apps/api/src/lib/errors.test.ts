import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { transientDbErrors } from "./errors.js";

function appThrowing(code: string) {
  const app = Fastify();
  app.setErrorHandler(transientDbErrors);
  app.get("/x", () => {
    throw Object.assign(new Error("boom"), { code });
  });
  return app;
}

describe("transientDbErrors", () => {
  it("turns a dropped database connection into 503 + Retry-After", async () => {
    for (const code of ["ECONNRESET", "CONNECT_TIMEOUT", "57P01"]) {
      const res = await appThrowing(code).inject({ method: "GET", url: "/x" });
      expect(res.statusCode).toBe(503);
      expect(res.headers["retry-after"]).toBe("5");
      expect(res.json()).toMatchObject({ error: { code: "db_unavailable" } });
    }
  });

  it("leaves other errors as they were", async () => {
    const res = await appThrowing("23505").inject({ method: "GET", url: "/x" });
    expect(res.statusCode).toBe(500);
  });
});
