import "./env.js";
import cron from "node-cron";
import { buildApp } from "./app.js";
import { runNotificationCron } from "./jobs/notifications.js";
import { refreshVectorFieldGrid } from "./jobs/vectorFieldRefresh.js";

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

// DEV_PLAN.md §7.4/§8: hourly cron, in-process (no separate scheduler for
// v1, per §2). Errors are logged, never fatal to the API process.
cron.schedule("0 * * * *", () => {
  runNotificationCron().catch((err) => app.log.error(err, "notification cron failed"));
});

// Wind/current/pressure map layer (apps/web/src/map/useWindyLayer.ts) —
// purely visual, unrelated to scoring. Coarse cadence is deliberate: this
// grid is small enough now (~352 cells, 5 variables) that it finishes in
// seconds, but 6h is still plenty fresh for a decorative overlay and keeps
// background Open-Meteo pressure low. Runs once at startup too, so the
// cache isn't empty right after a deploy.
cron.schedule("0 */6 * * *", () => {
  refreshVectorFieldGrid().catch((err) => app.log.error(err, "vector field refresh cron failed"));
});
refreshVectorFieldGrid().catch((err) => app.log.error(err, "initial vector field refresh failed"));
