import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";

function makeReply() {
  const reply = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(body: unknown) {
      reply.body = body;
      return reply;
    },
  };
  return reply as unknown as FastifyReply & typeof reply;
}

function makeRequest(headers: Record<string, string | undefined> = {}) {
  return { headers } as unknown as FastifyRequest;
}

const ORIGINAL_ENV = process.env.SYNC_API_KEY;

afterEach(() => {
  process.env.SYNC_API_KEY = ORIGINAL_ENV;
  vi.resetModules();
});

describe("requireApiKey", () => {
  describe("when SYNC_API_KEY is not configured", () => {
    beforeEach(() => {
      delete process.env.SYNC_API_KEY;
      vi.resetModules();
    });

    it("allows every request through, regardless of headers", async () => {
      const { requireApiKey } = await import("./auth.js");
      const reply = makeReply();
      const result = await requireApiKey(makeRequest(), reply);
      expect(result).toBeUndefined();
      expect(reply.statusCode).toBeUndefined();
    });
  });

  describe("when SYNC_API_KEY is configured", () => {
    beforeEach(() => {
      process.env.SYNC_API_KEY = "secret-key";
      vi.resetModules();
    });

    it("passes through when the header matches exactly", async () => {
      const { requireApiKey } = await import("./auth.js");
      const reply = makeReply();
      const result = await requireApiKey(
        makeRequest({ "x-api-key": "secret-key" }),
        reply,
      );
      expect(result).toBeUndefined();
      expect(reply.statusCode).toBeUndefined();
    });

    it("rejects a missing header with 401", async () => {
      const { requireApiKey } = await import("./auth.js");
      const reply = makeReply();
      await requireApiKey(makeRequest(), reply);
      expect(reply.statusCode).toBe(401);
      expect(reply.body).toEqual({
        error: { code: "unauthorized", message: "Invalid API key" },
      });
    });

    it("rejects a mismatched header with 401", async () => {
      const { requireApiKey } = await import("./auth.js");
      const reply = makeReply();
      await requireApiKey(makeRequest({ "x-api-key": "wrong-key" }), reply);
      expect(reply.statusCode).toBe(401);
    });

    it("rejects a case-different header (comparison is exact, not case-insensitive)", async () => {
      const { requireApiKey } = await import("./auth.js");
      const reply = makeReply();
      await requireApiKey(makeRequest({ "x-api-key": "SECRET-KEY" }), reply);
      expect(reply.statusCode).toBe(401);
    });
  });
});
