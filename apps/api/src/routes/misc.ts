import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { DEFAULT_WEIGHT_PROFILES } from "@fishmap/scoring";
import type { Mode } from "@fishmap/types";
import { db } from "../db/index.js";
import { isAdminRequest } from "../lib/auth.js";

const MODES: Mode[] = ["shore", "boat", "spearfishing"];

interface FlagRow {
  key: string;
  state: "off" | "admin_only" | "rollout" | "on";
  rollout_pct: number;
}

interface AnnouncementRow {
  message: string | null;
  active: number;
}

// Stable hash of a per-device identifier so a "rollout" flag gives the same
// device a consistent experience (DEV_PLAN.md §8). No accounts exist, so
// the client IP stands in for a device id — coarser than a real client id
// (many devices can share one IP behind NAT), a reasonable v1 simplification
// for a flag mechanism that's currently only used for `windParticles`.
function stableBucket(id: string): number {
  const hash = createHash("sha256").update(id).digest();
  return hash[0]! % 100;
}

export async function miscRoutes(app: FastifyInstance) {
  app.get("/api/flags", async (req) => {
    const flags = db.prepare("SELECT key, state, rollout_pct FROM feature_flags").all() as FlagRow[];
    const admin = isAdminRequest(req);
    const bucket = stableBucket(req.ip);

    const resolved: Record<string, boolean> = {};
    for (const f of flags) {
      if (f.state === "on") resolved[f.key] = true;
      else if (f.state === "off") resolved[f.key] = false;
      else if (f.state === "admin_only") resolved[f.key] = admin;
      else resolved[f.key] = bucket < f.rollout_pct;
    }
    return resolved;
  });

  // Public: resolved weight profiles (defaults merged with any admin
  // override, DEV_PLAN.md §8). Every page's scoring reads this instead of
  // the static default so the live weight editor actually applies
  // everywhere, not just in the admin preview.
  app.get("/api/weights", async () => {
    const rows = db.prepare("SELECT mode, weights FROM weight_overrides").all() as { mode: string; weights: string }[];
    const overrides = new Map(rows.map((r) => [r.mode, JSON.parse(r.weights) as Record<string, number>]));
    const resolved: Record<string, Record<string, number>> = {};
    for (const mode of MODES) {
      resolved[mode] = overrides.get(mode) ?? DEFAULT_WEIGHT_PROFILES[mode].weights;
    }
    return resolved;
  });

  app.get("/api/announcement", async () => {
    const row = db.prepare("SELECT message, active FROM announcement WHERE id = 1").get() as AnnouncementRow | undefined;
    if (!row || !row.active || !row.message) return { active: false, message: null };
    return { active: true, message: row.message };
  });
}
