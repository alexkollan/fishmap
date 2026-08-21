import argon2 from "argon2";
import type { FastifyInstance } from "fastify";
import { DEFAULT_WEIGHT_PROFILES } from "@fishmap/scoring";
import type { Mode } from "@fishmap/types";
import { db } from "../db/index.js";
import { ADMIN_COOKIE_NAME, isRateLimited, recordLoginAttempt, requireAdmin, signAdminToken } from "../lib/auth.js";

const MODES: Mode[] = ["shore", "boat", "spearfishing"];

interface FlagRow {
  key: string;
  description: string | null;
  state: "off" | "admin_only" | "rollout" | "on";
  rollout_pct: number;
  updated_at: number;
}

interface SpotRow {
  id: number;
  name: string;
  lat: number;
  lon: number;
  notes: string | null;
  visibility: "private" | "public";
  created_at: number;
  updated_at: number;
}

interface WeightRow {
  mode: string;
  weights: string;
  updated_at: number;
}

interface AnnouncementRow {
  id: 1;
  message: string | null;
  active: number;
  updated_at: number;
}

export async function adminRoutes(app: FastifyInstance) {
  // --- Auth ------------------------------------------------------------
  app.post("/api/admin/login", async (req, reply) => {
    const ip = req.ip;
    if (isRateLimited(ip)) {
      reply.code(429);
      return { error: "Too many attempts — try again later." };
    }

    const body = req.body as { password?: string };
    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (!hash) {
      reply.code(503);
      return { error: "Admin login is not configured on this server." };
    }
    if (!body.password) {
      reply.code(400);
      return { error: "Password required" };
    }

    const valid = await argon2.verify(hash, body.password).catch(() => false);
    if (!valid) {
      recordLoginAttempt(ip);
      reply.code(401);
      return { error: "Invalid password" };
    }

    const token = signAdminToken();
    reply.setCookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return { ok: true };
  });

  app.post("/api/admin/logout", async (_req, reply) => {
    reply.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/api/admin/me", { preHandler: requireAdmin }, async () => ({ authenticated: true }));

  // --- Feature flags -----------------------------------------------------
  app.get("/api/admin/flags", { preHandler: requireAdmin }, async () => {
    return db.prepare("SELECT * FROM feature_flags ORDER BY key").all() as FlagRow[];
  });

  app.put("/api/admin/flags/:key", { preHandler: requireAdmin }, async (req, reply) => {
    const { key } = req.params as { key: string };
    const body = req.body as { state?: string; rollout_pct?: number; description?: string };
    if (!body.state || !["off", "admin_only", "rollout", "on"].includes(body.state)) {
      reply.code(400);
      return { error: "Invalid state" };
    }
    db.prepare(
      `INSERT INTO feature_flags (key, description, state, rollout_pct, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET state = excluded.state, rollout_pct = excluded.rollout_pct, updated_at = excluded.updated_at`,
    ).run(key, body.description ?? null, body.state, body.rollout_pct ?? 0, Date.now());
    return { ok: true };
  });

  // --- Live weight editor (DEV_PLAN.md §8) --------------------------------
  app.get("/api/admin/weights", { preHandler: requireAdmin }, async () => {
    const rows = db.prepare("SELECT * FROM weight_overrides").all() as WeightRow[];
    const overrides = new Map(rows.map((r) => [r.mode, JSON.parse(r.weights) as Record<string, number>]));
    return MODES.map((mode) => ({
      mode,
      weights: overrides.get(mode) ?? DEFAULT_WEIGHT_PROFILES[mode].weights,
      isOverridden: overrides.has(mode),
    }));
  });

  app.put("/api/admin/weights/:mode", { preHandler: requireAdmin }, async (req, reply) => {
    const { mode } = req.params as { mode: string };
    if (!MODES.includes(mode as Mode)) {
      reply.code(400);
      return { error: "Invalid mode" };
    }
    const body = req.body as { weights?: Record<string, number> };
    if (!body.weights || typeof body.weights !== "object") {
      reply.code(400);
      return { error: "weights object required" };
    }
    db.prepare(
      `INSERT INTO weight_overrides (mode, weights, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(mode) DO UPDATE SET weights = excluded.weights, updated_at = excluded.updated_at`,
    ).run(mode, JSON.stringify(body.weights), Date.now());
    return { ok: true };
  });

  app.delete("/api/admin/weights/:mode", { preHandler: requireAdmin }, async (req) => {
    const { mode } = req.params as { mode: string };
    db.prepare("DELETE FROM weight_overrides WHERE mode = ?").run(mode);
    return { ok: true };
  });

  // --- Spots CRUD (admin) --------------------------------------------------
  app.get("/api/admin/spots", { preHandler: requireAdmin }, async () => {
    return db.prepare("SELECT * FROM spots ORDER BY updated_at DESC").all() as SpotRow[];
  });

  app.post("/api/admin/spots", { preHandler: requireAdmin }, async (req, reply) => {
    const body = req.body as { name?: string; lat?: number; lon?: number; notes?: string };
    if (!body.name || typeof body.lat !== "number" || typeof body.lon !== "number") {
      reply.code(400);
      return { error: "name, lat, lon required" };
    }
    const now = Date.now();
    // Private is the default on create — publishing is a deliberate,
    // separate action (DEV_PLAN.md §6.7).
    const info = db
      .prepare(`INSERT INTO spots (name, lat, lon, notes, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, 'private', ?, ?)`)
      .run(body.name, body.lat, body.lon, body.notes ?? null, now, now);
    return { id: info.lastInsertRowid };
  });

  app.put("/api/admin/spots/:id", { preHandler: requireAdmin }, async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { name?: string; lat?: number; lon?: number; notes?: string };
    const existing = db.prepare("SELECT * FROM spots WHERE id = ?").get(id) as SpotRow | undefined;
    if (!existing) return { error: "Not found" };
    db.prepare("UPDATE spots SET name = ?, lat = ?, lon = ?, notes = ?, updated_at = ? WHERE id = ?").run(
      body.name ?? existing.name,
      body.lat ?? existing.lat,
      body.lon ?? existing.lon,
      body.notes ?? existing.notes,
      Date.now(),
      id,
    );
    return { ok: true };
  });

  // Publish/unpublish are separate, explicit endpoints — never a side
  // effect of a generic PATCH (DEV_PLAN.md §6.7: "requires a deliberate
  // second click, not a stray toggle").
  app.put("/api/admin/spots/:id/publish", { preHandler: requireAdmin }, async (req) => {
    const { id } = req.params as { id: string };
    db.prepare("UPDATE spots SET visibility = 'public', updated_at = ? WHERE id = ?").run(Date.now(), id);
    return { ok: true };
  });

  app.put("/api/admin/spots/:id/unpublish", { preHandler: requireAdmin }, async (req) => {
    const { id } = req.params as { id: string };
    db.prepare("UPDATE spots SET visibility = 'private', updated_at = ? WHERE id = ?").run(Date.now(), id);
    return { ok: true };
  });

  app.delete("/api/admin/spots/:id", { preHandler: requireAdmin }, async (req) => {
    const { id } = req.params as { id: string };
    db.prepare("DELETE FROM spots WHERE id = ?").run(id);
    return { ok: true };
  });

  // --- Announcement banner -------------------------------------------------
  app.get("/api/admin/announcement", { preHandler: requireAdmin }, async () => {
    return (db.prepare("SELECT * FROM announcement WHERE id = 1").get() as AnnouncementRow | undefined) ?? null;
  });

  app.put("/api/admin/announcement", { preHandler: requireAdmin }, async (req) => {
    const body = req.body as { message?: string; active?: boolean };
    db.prepare(
      `INSERT INTO announcement (id, message, active, updated_at) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET message = excluded.message, active = excluded.active, updated_at = excluded.updated_at`,
    ).run(body.message ?? null, body.active ? 1 : 0, Date.now());
    return { ok: true };
  });

  // --- Usage dashboard (DEV_PLAN.md §8) ------------------------------------
  app.get("/api/admin/stats", { preHandler: requireAdmin }, async () => {
    const weatherCacheRows = (db.prepare("SELECT COUNT(*) as n FROM weather_cache").get() as { n: number }).n;
    const subCount = (db.prepare("SELECT COUNT(*) as n FROM push_subscriptions WHERE enabled = 1").get() as { n: number }).n;
    const thresholdDistribution = db
      .prepare("SELECT threshold, COUNT(*) as count FROM push_subscriptions WHERE enabled = 1 GROUP BY threshold")
      .all();
    const modeDistribution = db.prepare("SELECT mode, COUNT(*) as count FROM push_subscriptions WHERE enabled = 1 GROUP BY mode").all();
    const publicSpots = (db.prepare("SELECT COUNT(*) as n FROM spots WHERE visibility = 'public'").get() as { n: number }).n;
    const privateSpots = (db.prepare("SELECT COUNT(*) as n FROM spots WHERE visibility = 'private'").get() as { n: number }).n;

    return {
      weatherCacheRows,
      activePushSubscriptions: subCount,
      thresholdDistribution,
      modeDistribution,
      publicSpots,
      privateSpots,
    };
  });
}
