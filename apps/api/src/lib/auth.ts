import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";

// One hardcoded admin, no public accounts (DEV_PLAN.md §8). Proportionate
// for one account behind a Cloudflare Tunnel, not a bank.
export const ADMIN_COOKIE_NAME = "fishmap_admin";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

export function signAdminToken(): string {
  return jwt.sign({ role: "admin" }, jwtSecret(), { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyAdminToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, jwtSecret());
    return typeof payload === "object" && payload !== null && payload.role === "admin";
  } catch {
    return false;
  }
}

export function isAdminRequest(req: FastifyRequest): boolean {
  const token = req.cookies?.[ADMIN_COOKIE_NAME];
  return typeof token === "string" && verifyAdminToken(token);
}

/** Fastify preHandler — attach to any route under /api/admin/* except login. */
export function requireAdmin(req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) {
  if (!isAdminRequest(req)) {
    reply.code(401).send({ error: "Admin authentication required" });
    return;
  }
  done();
}

// Simple in-memory login rate limiter (DEV_PLAN.md §8: 5 attempts / 15 min /
// IP). No external store needed for a single-admin app on one process.
const loginAttempts = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  loginAttempts.set(ip, attempts);
  return attempts.length >= MAX_ATTEMPTS;
}

export function recordLoginAttempt(ip: string): void {
  const attempts = loginAttempts.get(ip) ?? [];
  attempts.push(Date.now());
  loginAttempts.set(ip, attempts);
}
