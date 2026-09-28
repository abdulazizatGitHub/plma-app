import type { FastifyReply, FastifyRequest } from "fastify";

const API_KEY = process.env.SYNC_API_KEY;

export async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!API_KEY) return;

  const header = request.headers["x-api-key"];
  if (header !== API_KEY) {
    return reply.status(401).send({
      error: { code: "unauthorized", message: "Invalid API key" },
    });
  }
}
