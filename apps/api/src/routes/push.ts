import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  enabled?: boolean;
  locations?: { lat: number; lon: number; name: string }[];
  threshold?: number;
  mode?: string;
  lookaheadHours?: number;
  quietStart?: string;
  quietEnd?: string;
  maxFrequency?: string;
  alertTypes?: string[];
}

const MAX_LOCATIONS = 5;

/**
 * Web Push subscription storage (DEV_PLAN.md §7.4). Preferences live on the
 * subscription row itself so the hourly cron (jobs/notifications.ts) can
 * evaluate them without a client ever being open — the whole point, since
 * iOS gives no client-side scheduling. Nothing here fires a notification;
 * this route only ever writes the row the cron later reads.
 */
export async function pushRoutes(app: FastifyInstance) {
  app.get("/api/push/vapid-public-key", async () => {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
  });

  app.post("/api/push/subscribe", async (req, reply) => {
    const body = req.body as SubscribeBody;
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      reply.code(400);
      return { error: "endpoint and keys.p256dh/auth required" };
    }

    const now = Date.now();
    const locations = (body.locations ?? []).slice(0, MAX_LOCATIONS);

    db.prepare(
      `INSERT INTO push_subscriptions
         (endpoint, p256dh, auth, enabled, locations, threshold, mode, lookahead_hours, quiet_start, quiet_end, max_frequency, alert_types, created_at, updated_at)
       VALUES (@endpoint, @p256dh, @auth, @enabled, @locations, @threshold, @mode, @lookaheadHours, @quietStart, @quietEnd, @maxFrequency, @alertTypes, @now, @now)
       ON CONFLICT(endpoint) DO UPDATE SET
         p256dh = excluded.p256dh, auth = excluded.auth, enabled = excluded.enabled,
         locations = excluded.locations, threshold = excluded.threshold, mode = excluded.mode,
         lookahead_hours = excluded.lookahead_hours, quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end,
         max_frequency = excluded.max_frequency, alert_types = excluded.alert_types, updated_at = excluded.updated_at`,
    ).run({
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      enabled: body.enabled ? 1 : 0,
      locations: JSON.stringify(locations),
      threshold: body.threshold ?? 80,
      mode: body.mode ?? "shore",
      lookaheadHours: body.lookaheadHours ?? 24,
      quietStart: body.quietStart ?? "23:00",
      quietEnd: body.quietEnd ?? "06:00",
      maxFrequency: body.maxFrequency ?? "1/12h",
      alertTypes: JSON.stringify(body.alertTypes ?? ["goodWindow", "safety"]),
      now,
    });

    return { ok: true };
  });

  // Unsubscribe path that actually deletes the row (DEV_PLAN.md §7.4).
  app.delete("/api/push/subscribe", async (req, reply) => {
    const body = req.body as { endpoint?: string };
    if (!body.endpoint) {
      reply.code(400);
      return { error: "endpoint required" };
    }
    db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(body.endpoint);
    return { ok: true };
  });
}
