import webpush from "web-push";
import { getSunMoonData, scoreHour } from "@fishmap/scoring";
import type { Mode, WeatherSeries } from "@fishmap/types";
import { db } from "../db/index.js";
import { fetchForecast, fetchMarine } from "../adapters/open-meteo.js";
import { mergeToSeries } from "../adapters/merge.js";
import { cached } from "../db/cache.js";
import { snapToGrid } from "../lib/grid.js";

const ATMOSPHERIC_TTL_MS = 60 * 60 * 1000;
const MARINE_TTL_MS = 3 * 60 * 60 * 1000;
const ATHENS_TZ = "Europe/Athens";

interface SubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: number;
  locations: string;
  threshold: number;
  mode: string;
  lookahead_hours: number;
  quiet_start: string;
  quiet_end: string;
  max_frequency: string;
  alert_types: string;
  last_sent_at: number | null;
}

function vapidConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@fish.alexcoll.in",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

async function getSeries(lat: number, lon: number): Promise<WeatherSeries | null> {
  const gridLat = snapToGrid(lat);
  const gridLon = snapToGrid(lon);
  try {
    const forecast = await cached(gridLat, gridLon, "forecast", ATMOSPHERIC_TTL_MS, () => fetchForecast(gridLat, gridLon));
    const marine = await cached(gridLat, gridLon, "marine", MARINE_TTL_MS, () => fetchMarine(gridLat, gridLon)).catch(() => null);
    return mergeToSeries(forecast.data, marine?.data ?? null, gridLat, gridLon);
  } catch {
    return null;
  }
}

// "1/day" | "1/12h" | "1/6h" (DEV_PLAN.md §7.4).
function frequencyCapMs(spec: string): number {
  if (spec === "1/day") return 24 * 60 * 60 * 1000;
  if (spec === "1/6h") return 6 * 60 * 60 * 1000;
  return 12 * 60 * 60 * 1000; // 1/12h default
}

function withinQuietHours(now: Date, quietStart: string, quietEnd: string): boolean {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: ATHENS_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const nowHHMM = fmt.format(now);
  if (quietStart <= quietEnd) return nowHHMM >= quietStart && nowHHMM < quietEnd;
  return nowHHMM >= quietStart || nowHHMM < quietEnd; // wraps past midnight
}

interface EvaluationResult {
  kind: "goodWindow" | "safety";
  title: string;
  body: string;
  url: string;
}

function evaluateLocation(
  series: WeatherSeries,
  location: { lat: number; lon: number; name: string },
  mode: Mode,
  threshold: number,
  lookaheadHours: number,
  alertTypes: string[],
): EvaluationResult | null {
  const sunMoonByDate = new Map<string, ReturnType<typeof getSunMoonData>>();
  const now = Date.now();
  const nowIndex = series.hourly.findIndex((h) => new Date(h.time).getTime() >= now);
  const startIndex = Math.max(0, nowIndex);
  const endIndex = Math.min(series.hourly.length, startIndex + lookaheadHours);

  let bestGoodWindow: { score: number; time: string } | null = null;

  for (let i = startIndex; i < endIndex; i++) {
    const hour = series.hourly[i];
    if (!hour) continue;
    const dateKey = hour.time.slice(0, 10);
    let sunMoon = sunMoonByDate.get(dateKey);
    if (!sunMoon) {
      sunMoon = getSunMoonData(new Date(hour.time), series.latitude, series.longitude);
      sunMoonByDate.set(dateKey, sunMoon);
    }
    const result = scoreHour(series.hourly, i, sunMoon, mode);

    if (alertTypes.includes("safety") && result.vetoes.length > 0) {
      const veto = result.vetoes[0]!;
      return {
        kind: "safety",
        title: `⚠ Safety warning — ${location.name}`,
        body: veto.note,
        url: `/?lat=${location.lat}&lon=${location.lon}&name=${encodeURIComponent(location.name)}`,
      };
    }

    if (alertTypes.includes("goodWindow") && result.score >= threshold) {
      if (!bestGoodWindow || result.score > bestGoodWindow.score) {
        bestGoodWindow = { score: result.score, time: hour.time };
      }
    }
  }

  if (bestGoodWindow) {
    return {
      kind: "goodWindow",
      title: `Good fishing window — ${location.name}`,
      body: `Score ${bestGoodWindow.score} coming up.`,
      url: `/forecast?lat=${location.lat}&lon=${location.lon}&name=${encodeURIComponent(location.name)}`,
    };
  }

  return null;
}

/**
 * Hourly evaluator (DEV_PLAN.md §7.4): batches by grid cell so one weather
 * fetch serves many subscribers, honours threshold/quiet-hours/frequency
 * per subscription, and lets safety alerts bypass both — "a storm alert at
 * 04:00 for someone heading out is the entire point." Prunes subscriptions
 * the push service reports as gone.
 */
export async function runNotificationCron(): Promise<void> {
  if (!vapidConfigured()) {
    return; // not configured in this environment — silently skip, not fatal
  }
  configureWebPush();

  const subs = db.prepare("SELECT * FROM push_subscriptions WHERE enabled = 1").all() as SubscriptionRow[];
  if (subs.length === 0) return;

  const now = new Date();
  const seriesCache = new Map<string, WeatherSeries | null>();

  for (const sub of subs) {
    const locations = JSON.parse(sub.locations) as { lat: number; lon: number; name: string }[];
    const alertTypes = JSON.parse(sub.alert_types) as string[];
    const mode = sub.mode as Mode;

    let toSend: EvaluationResult | null = null;

    for (const loc of locations) {
      const key = `${snapToGrid(loc.lat)},${snapToGrid(loc.lon)}`;
      if (!seriesCache.has(key)) {
        seriesCache.set(key, await getSeries(loc.lat, loc.lon));
      }
      const series = seriesCache.get(key);
      if (!series) continue;

      const result = evaluateLocation(series, loc, mode, sub.threshold, sub.lookahead_hours, alertTypes);
      if (result) {
        toSend = result;
        if (result.kind === "safety") break; // safety takes priority, stop scanning
      }
    }

    if (!toSend) continue;

    const isSafety = toSend.kind === "safety";
    if (!isSafety) {
      // Safety bypasses quiet hours and frequency caps; good-window alerts don't.
      if (withinQuietHours(now, sub.quiet_start, sub.quiet_end)) continue;
      if (sub.last_sent_at && Date.now() - sub.last_sent_at < frequencyCapMs(sub.max_frequency)) continue;
    }

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: toSend.title, body: toSend.body, url: toSend.url }),
      );
      db.prepare("UPDATE push_subscriptions SET last_sent_at = ? WHERE id = ?").run(Date.now(), sub.id);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(sub.id);
      }
    }
  }
}
