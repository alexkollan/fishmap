import "./env.js";
import cron from "node-cron";
import { buildApp } from "./app.js";
import { runNotificationCron } from "./jobs/notifications.js";

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
