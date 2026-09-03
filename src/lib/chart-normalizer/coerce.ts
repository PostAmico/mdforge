/**
 * ============================================================================
 *  Chart Normalizer — Coercion & Data Shaping
 * ============================================================================
 *
 * Helpers that turn loosely-typed, inconsistently-shaped input into the two
 * things the canonical schema insists on:
 *   1. numbers that are actually numbers, and
 *   2. `data` as an array of flat objects (`DataPoint[]`).
 *
 * Pure, dependency-free. None of these throw.
 */

import type { DataPoint } from "./schema";

// ────────────────────────────────────────────────────────────────────────────
//  Primitives
// ────────────────────────────────────────────────────────────────────────────

/** True for a non-null, non-array plain object. */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Suffix multipliers commonly emitted by LLMs ("1.2M", "3k"). */
const MAGNITUDE: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
  t: 1_000_000_000_000,
};

/**
 * Coerce a value into a number, tolerating the messy strings LLMs produce:
 * "1,200" → 1200, "$45.50" → 45.5, "12%" → 12, "1.2M" → 1200000, "3k" → 3000.
 *
 * Returns `null` when the value cannot be interpreted as a number.
 */
export function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value !== "string") return null;

  let s = value.trim();
  if (s === "") return null;

  // Strip common currency symbols, thousands separators, and whitespace.
  s = s.replace(/[$€£¥₹,\s]/g, "");

  // Percentage: drop the sign, keep the magnitude.
  const isPercent = s.endsWith("%");
  if (isPercent) s = s.slice(0, -1);

  // Magnitude suffix (k/m/b/t), case-insensitive.
  let multiplier = 1;
  const suffix = s.slice(-1).toLowerCase();
  if (MAGNITUDE[suffix]) {
    multiplier = MAGNITUDE[suffix];
    s = s.slice(0, -1);
  }

  if (s === "" || s === "-" || s === "+" || s === ".") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;

  return n * multiplier;
}

// ────────────────────────────────────────────────────────────────────────────
//  Data shaping
// ────────────────────────────────────────────────────────────────────────────

/** Sentinel result describing how the input data was interpreted. */
export interface ShapedData {
  data: DataPoint[];
  /** How the original data was structured, for diagnostics. */
  origin:
    | "objects" // already array of objects
    | "primitives" // array of scalars → wrapped
    | "tuples" // array of arrays → keyed
    | "columnar" // object of arrays → transposed
    | "empty"; // nothing usable
}

/**
 * Apply number coercion to every value of every row that looks numeric,
 * leaving genuinely non-numeric strings (labels) untouched.
 */
function coerceRowNumbers(rows: DataPoint[]): DataPoint[] {
  return rows.map((row) => {
    const out: DataPoint = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "string") {
        const n = coerceNumber(v);
        // Only replace if the string is *entirely* numeric-looking; otherwise
        // keep the label. `coerceNumber("Jan")` → null, so "Jan" stays a label.
        out[k] = n !== null && /\d/.test(v) ? n : v;
      } else {
        out[k] = v as DataPoint[string];
      }
    }
    return out;
  });
}

/**
 * Turn arbitrary `data` into `DataPoint[]`. Handles four common shapes:
 *
 *  - array of objects        → used as-is
 *  - array of primitives     → `{ name: "Item N", value }`
 *  - array of arrays (tuples)→ `{ name: row[0], value: row[1], value2: row[2] }`
 *  - object of arrays (cols) → transposed into rows
 *
 * @param coerce  When true, numeric-looking string values are converted.
 */
export function shapeData(raw: unknown, coerce: boolean): ShapedData {
  // Array inputs.
  if (Array.isArray(raw)) {
    if (raw.length === 0) return { data: [], origin: "empty" };

    // Array of objects.
    if (raw.every((r) => isPlainObject(r))) {
      const rows = raw as DataPoint[];
      return { data: coerce ? coerceRowNumbers(rows) : rows, origin: "objects" };
    }

    // Array of arrays (tuples): [["Jan", 100], ["Feb", 150]].
    if (raw.every((r) => Array.isArray(r))) {
      const rows: DataPoint[] = (raw as unknown[][]).map((tuple) => {
        const row: DataPoint = { name: asPrimitive(tuple[0]) };
        for (let i = 1; i < tuple.length; i++) {
          row[i === 1 ? "value" : `value${i}`] = asPrimitive(tuple[i]);
        }
        return row;
      });
      return { data: coerce ? coerceRowNumbers(rows) : rows, origin: "tuples" };
    }

    // Array of primitives: [10, 20, 30] or ["a", "b"].
    if (raw.every((r) => r === null || typeof r !== "object")) {
      const rows: DataPoint[] = (raw as unknown[]).map((v, i) => ({
        name: `Item ${i + 1}`,
        value: asPrimitive(v),
      }));
      return { data: coerce ? coerceRowNumbers(rows) : rows, origin: "primitives" };
    }

    // Mixed array — keep only the object rows, ignore the rest.
    const objs = (raw as unknown[]).filter(isPlainObject) as DataPoint[];
    if (objs.length > 0) {
      return { data: coerce ? coerceRowNumbers(objs) : objs, origin: "objects" };
    }
    return { data: [], origin: "empty" };
  }

  // Columnar object of arrays: { month: ["Jan","Feb"], users: [100,150] }.
  if (isPlainObject(raw)) {
    const entries = Object.entries(raw).filter(([, v]) => Array.isArray(v));
    if (entries.length > 0) {
      const len = Math.max(...entries.map(([, v]) => (v as unknown[]).length));
      const rows: DataPoint[] = [];
      for (let i = 0; i < len; i++) {
        const row: DataPoint = {};
        for (const [k, v] of entries) {
          row[k] = asPrimitive((v as unknown[])[i]);
        }
        rows.push(row);
      }
      return { data: coerce ? coerceRowNumbers(rows) : rows, origin: "columnar" };
    }
  }

  return { data: [], origin: "empty" };
}

/** Narrow an unknown into a DataPoint-safe primitive. Objects become null. */
function asPrimitive(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return null;
  return v as string | number | boolean;
}

// ────────────────────────────────────────────────────────────────────────────
//  Field detection
// ────────────────────────────────────────────────────────────────────────────

/** Return the keys of `row` whose values are numeric (after optional coercion). */
export function numericKeys(row: DataPoint, coerce: boolean): string[] {
  return Object.keys(row).filter((k) => {
    const v = row[k];
    if (typeof v === "number") return Number.isFinite(v);
    if (coerce && typeof v === "string") return coerceNumber(v) !== null && /\d/.test(v);
    return false;
  });
}

/** Return the keys of `row` whose values are non-numeric strings (labels). */
export function labelKeys(row: DataPoint, coerce: boolean): string[] {
  const nums = new Set(numericKeys(row, coerce));
  return Object.keys(row).filter((k) => !nums.has(k) && typeof row[k] === "string");
}
