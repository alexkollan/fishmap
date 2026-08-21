import type { FactorScore, VetoInfo } from "@fishmap/types";
import type { Dictionary } from "./dictionary";

function getTemplate(root: unknown, dottedKey: string): string | undefined {
  let node: unknown = root;
  for (const part of dottedKey.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function formatParam(key: string, value: number): string {
  if (key === "delta") return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
  if (key === "knots") return value.toFixed(2);
  if (key === "height" || key === "sst" || key === "mm" || key === "wave") return value.toFixed(1);
  return String(Math.round(value));
}

/** Renders a FactorScore's translation key against Dictionary.factorNotes —
 * the counterpart to FactorScore.note (English-only fallback for non-UI
 * consumers). Falls back to the English `note` if the key is somehow
 * missing, so a typo never surfaces a blank UI. */
export function renderFactorNote(t: Dictionary, f: Pick<FactorScore, "note" | "noteKey" | "noteParams">): string {
  const template = getTemplate(t.factorNotes, f.noteKey);
  if (!template) return f.note;

  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(f.noteParams ?? {})) {
    if (key === "phaseKey") values.phase = t.sunMoon.phase[value as keyof Dictionary["sunMoon"]["phase"]] ?? String(value);
    else if (key === "monthKey") values.month = t.common.months[Number(value)] ?? String(value);
    else if (typeof value === "number") values[key] = formatParam(key, value);
    else values[key] = String(value);
  }
  return interpolate(template, values);
}

/** VetoInfo counterpart to renderFactorNote. */
export function renderVetoNote(t: Dictionary, v: Pick<VetoInfo, "key" | "note" | "params">): string {
  const template = getTemplate(t.vetoes, v.key);
  if (!template) return v.note;

  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(v.params ?? {})) {
    values[key] = formatParam(key, value);
  }
  return interpolate(template, values);
}
