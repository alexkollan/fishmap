import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { healthRoutes } from "./routes/health.js";
import { weatherRoutes } from "./routes/weather.js";
import { tileRoutes } from "./routes/tiles.js";
import { adminRoutes } from "./routes/admin.js";
import { spotsRoutes } from "./routes/spots.js";
import { pushRoutes } from "./routes/push.js";
import { miscRoutes } from "./routes/misc.js";
import { fieldRoutes } from "./routes/fields.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true, // admin auth rides on an httpOnly cookie
  });
  app.register(cookie);

  app.register(healthRoutes);
  app.register(weatherRoutes);
  app.register(tileRoutes);
  app.register(adminRoutes);
  app.register(spotsRoutes);
  app.register(pushRoutes);
  app.register(miscRoutes);
  app.register(fieldRoutes);

  return app;
}
