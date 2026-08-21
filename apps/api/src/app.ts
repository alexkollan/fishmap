import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  });

  app.register(healthRoutes);

  return app;
}
