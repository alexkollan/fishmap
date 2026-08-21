import type { Mode } from "@fishmap/types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function login(password: string) {
  return api<{ ok: true }>("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
}

export function logout() {
  return api<{ ok: true }>("/api/admin/logout", { method: "POST" });
}

export function me() {
  return api<{ authenticated: true }>("/api/admin/me");
}

export interface FlagRow {
  key: string;
  description: string | null;
  state: "off" | "admin_only" | "rollout" | "on";
  rollout_pct: number;
  updated_at: number;
}

export function getFlags() {
  return api<FlagRow[]>("/api/admin/flags");
}

export function updateFlag(key: string, state: FlagRow["state"], rollout_pct: number, description?: string | null) {
  return api<{ ok: true }>(`/api/admin/flags/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ state, rollout_pct, description }),
  });
}

export interface WeightRow {
  mode: Mode;
  weights: Record<string, number>;
  isOverridden: boolean;
}

export function getWeights() {
  return api<WeightRow[]>("/api/admin/weights");
}

export function updateWeights(mode: Mode, weights: Record<string, number>) {
  return api<{ ok: true }>(`/api/admin/weights/${mode}`, { method: "PUT", body: JSON.stringify({ weights }) });
}

export function resetWeights(mode: Mode) {
  return api<{ ok: true }>(`/api/admin/weights/${mode}`, { method: "DELETE" });
}

export interface AdminSpot {
  id: number;
  name: string;
  lat: number;
  lon: number;
  notes: string | null;
  visibility: "private" | "public";
  created_at: number;
  updated_at: number;
}

export function getAdminSpots() {
  return api<AdminSpot[]>("/api/admin/spots");
}

export function createSpot(spot: { name: string; lat: number; lon: number; notes?: string }) {
  return api<{ id: number }>("/api/admin/spots", { method: "POST", body: JSON.stringify(spot) });
}

export function updateSpot(id: number, spot: Partial<{ name: string; lat: number; lon: number; notes: string }>) {
  return api<{ ok: true }>(`/api/admin/spots/${id}`, { method: "PUT", body: JSON.stringify(spot) });
}

export function publishSpot(id: number) {
  return api<{ ok: true }>(`/api/admin/spots/${id}/publish`, { method: "PUT" });
}

export function unpublishSpot(id: number) {
  return api<{ ok: true }>(`/api/admin/spots/${id}/unpublish`, { method: "PUT" });
}

export function deleteSpot(id: number) {
  return api<{ ok: true }>(`/api/admin/spots/${id}`, { method: "DELETE" });
}

export interface Announcement {
  message: string | null;
  active: number;
}

export function getAnnouncement() {
  return api<Announcement | null>("/api/admin/announcement");
}

export function setAnnouncement(message: string, active: boolean) {
  return api<{ ok: true }>("/api/admin/announcement", { method: "PUT", body: JSON.stringify({ message, active }) });
}

export interface AdminStats {
  weatherCacheRows: number;
  activePushSubscriptions: number;
  thresholdDistribution: { threshold: number; count: number }[];
  modeDistribution: { mode: string; count: number }[];
  publicSpots: number;
  privateSpots: number;
}

export function getStats() {
  return api<AdminStats>("/api/admin/stats");
}
