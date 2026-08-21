import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";

/**
 * Public spots endpoint (DEV_PLAN.md §6.7). The `visibility = 'public'`
 * filter lives in the SQL query itself, not in application code after the
 * fetch — the whole point is that a later refactor can't accidentally
 * start returning private rows. No `total`/count field that could leak the
 * existence of private spots either.
 */
export async function spotsRoutes(app: FastifyInstance) {
  app.get("/api/spots", async () => {
    return db
      .prepare("SELECT id, name, lat, lon, notes FROM spots WHERE visibility = 'public' ORDER BY name")
      .all();
  });
}
