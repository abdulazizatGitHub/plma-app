import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

/** Connection-level failures that clear up on their own (pooler resets, timeouts, restarts). */
const TRANSIENT = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "EPIPE", "57P01", "53300"]);

/**
 * A briefly unreachable database is temporary: answer 503 + Retry-After
 * instead of a bare 500, so clients keep their changes queued and retry.
 * Everything else keeps Fastify's default handling.
 */
export function transientDbErrors(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error.code && TRANSIENT.has(error.code)) {
    request.log.warn({ err: error }, "database temporarily unavailable");
    return reply
      .status(503)
      .header("Retry-After", "5")
      .send({ error: { code: "db_unavailable", message: "The server is briefly unavailable; your changes are kept and will sync shortly." } });
  }
  return reply.send(error);
}
