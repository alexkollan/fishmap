import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// DATA_DIR must be set before db/index.ts (imported transitively by
// app.ts) opens its SQLite file — dynamic imports below run after this,
// static imports would be hoisted ahead of it.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "fishmap-spots-test-"));

const { buildApp } = await import("../app.js");
const { db } = await import("../db/index.js");

describe("GET /api/spots — private spot leak test (DEV_PLAN.md §6.5, §6.7)", () => {
  const app = buildApp();

  beforeAll(() => {
    const now = Date.now();
    db.prepare(
      `INSERT INTO spots (name, lat, lon, notes, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("Public Spot", 37.5, 23.5, null, "public", now, now);
    db.prepare(
      `INSERT INTO spots (name, lat, lon, notes, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("Alex's Secret Spot", 38.1, 24.1, "shh", "private", now, now);
    db.prepare(
      `INSERT INTO spots (name, lat, lon, notes, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("Another Private Spot", 38.2, 24.2, null, "private", now, now);
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns zero private rows to an unauthenticated request", async () => {
    const res = await app.inject({ method: "GET", url: "/api/spots" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { name: string }[];

    expect(body.length).toBe(1);
    expect(body.every((s) => !s.name.toLowerCase().includes("private") && !s.name.toLowerCase().includes("secret"))).toBe(true);
    expect(body[0]!.name).toBe("Public Spot");
  });

  it("never includes a total/count field that could leak private-row existence", async () => {
    const res = await app.inject({ method: "GET", url: "/api/spots" });
    const raw = res.body;
    expect(raw).not.toContain('"total"');
  });
});
