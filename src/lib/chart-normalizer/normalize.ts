/**
 * ============================================================================
 *  Chart Normalizer — Core
 * ============================================================================
 *
 * `normalizeChart(input, options?)` takes ANY value an LLM/human/tool might
 * produce and returns a `NormalizeResult` containing a best-effort
 * `NormalizedChart` plus structured `diagnostics`. It never throws unless
 * `options.strict` is set.
 *
 * Resolution is layered and deterministic:
 *   1. parse   — accept JSON strings and bare arrays
 *   2. transform — run custom + built-in shape detectors (e.g. `series`)
 *   3. type    — resolve alias → canonical type (+ stacked/orientation hints)
 *   4. data    — coerce numbers, reshape into DataPoint[]
 *   5. index   — resolve the label/category/x key
 *   6. keys    — resolve the numeric series key(s)
 *   7. specific— fill type-specific payloads (sankey/gauge/scale)
 *   8. finalize— compute `ok`, optionally throw in strict mode
 *
 * Pure and dependency-free (imports only sibling modules and types).
 */

import {
  type CanonicalChartType,
  type ChartInput,
  type DataPoint,
  type Diagnostic,
  type DiagnosticCode,
  type DiagnosticSeverity,
  type NormalizedChart,
  type NormalizeOptions,
  type NormalizeResult,
  type Orientation,
  type SankeyLink,
  type SankeyNode,
  type SeriesMeta,
} from "./schema";
import { resolveType } from "./aliases";
import {
  coerceNumber,
  isPlainObject,
  labelKeys,
  numericKeys,
  shapeData,
} from "./coerce";

// ────────────────────────────────────────────────────────────────────────────
//  Defaults & small helpers
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_FALLBACK: CanonicalChartType = "bar";

/** Common field names authors use for the index/label/x key. */
const INDEX_ALIASES = [
  "index",
  "xKey",
  "nameKey",
  "categoryKey",
  "labelKey",
  "xAxisKey",
];

/** Common field names authors use for the numeric value/series key(s). */
const KEYS_ALIASES = ["keys", "yKey", "valueKey", "dataKey", "seriesKey"];

class DiagnosticCollector {
  readonly items: Diagnostic[] = [];
  add(
    code: DiagnosticCode,
    severity: DiagnosticSeverity,
    message: string,
    path?: string,
  ): void {
    this.items.push({ code, severity, message, ...(path ? { path } : {}) });
  }
  hasError(): boolean {
    return this.items.some((d) => d.severity === "error");
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Layer 1 — parse
// ────────────────────────────────────────────────────────────────────────────

/** Accept JSON strings and bare arrays, returning a candidate object/array. */
function parseInput(input: unknown, diag: DiagnosticCollector): unknown {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed === "") return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      diag.add(
        "input_not_object",
        "error",
        "Input was a string but could not be parsed as JSON.",
      );
      return {};
    }
  }
  return input;
}

// ────────────────────────────────────────────────────────────────────────────
//  Layer 2 — built-in shape detectors
// ────────────────────────────────────────────────────────────────────────────

/**
 * PostAmico "Format 3" / Chart.js-style `series` inputs. Two sub-shapes:
 *   a) categories + series[].data (parallel arrays) → transpose into rows
 *   b) series[].points ({x, y}) → flatten into rows
 * Returns a reshaped ChartInput, or null if `series` isn't present/usable.
 */
function shapeFromSeries(
  obj: Record<string, unknown>,
  diag: DiagnosticCollector,
): ChartInput | null {
  const series = obj.series;
  if (!Array.isArray(series) || series.length === 0) return null;

  const hasData = series.some(
    (s) => isPlainObject(s) && (Array.isArray(s.data) || Array.isArray(s.points)),
  );
  if (!hasData) return null;

  // Keep `series` on the reshaped input so `buildSeriesMeta` can still read
  // per-series axis/stack hints after the data has been transposed.
  const base: ChartInput = { ...(obj as ChartInput) };

  // Categories can live in a few places.
  const xAxis = isPlainObject(obj.xAxis) ? obj.xAxis : undefined;
  const categories =
    (Array.isArray(obj.categories) && (obj.categories as unknown[])) ||
    (xAxis && Array.isArray(xAxis.categories) && (xAxis.categories as unknown[])) ||
    null;

  const seriesName = (s: Record<string, unknown>, i: number): string =>
    (typeof s.name === "string" && s.name) ||
    (typeof s.dataKey === "string" && s.dataKey) ||
    (typeof s.label === "string" && s.label) ||
    `Series ${i + 1}`;

  // Sub-shape (a): parallel arrays keyed by category.
  if (categories && categories.length > 0) {
    const keys: string[] = [];
    const rows: DataPoint[] = categories.map((label) => ({
      name: label as string | number,
    }));
    (series as Record<string, unknown>[]).forEach((s, i) => {
      if (!isPlainObject(s) || !Array.isArray(s.data)) return;
      const name = seriesName(s, i);
      keys.push(name);
      (s.data as unknown[]).forEach((val, idx) => {
        if (rows[idx]) rows[idx][name] = numOrRaw(val);
      });
    });
    diag.add(
      "data_shape_transposed",
      "info",
      "Reshaped `series` + categories into row objects.",
      "series",
    );
    return { ...base, data: rows, index: "name", keys };
  }

  // Sub-shape (b): scatter/line points.
  const rows: DataPoint[] = [];
  (series as Record<string, unknown>[]).forEach((s, i) => {
    if (!isPlainObject(s) || !Array.isArray(s.points)) return;
    const name = seriesName(s, i);
    (s.points as unknown[]).forEach((p) => {
      if (isPlainObject(p)) {
        rows.push({
          x: numOrRaw(p.x),
          y: numOrRaw(p.y),
          series: name,
        });
      }
    });
  });
  if (rows.length > 0) {
    diag.add(
      "data_shape_transposed",
      "info",
      "Flattened `series[].points` into {x, y} rows.",
      "series",
    );
    return { ...base, data: rows, index: "x", keys: ["y"] };
  }

  return null;
}

/** Coerce numeric-looking values while preserving labels. */
function numOrRaw(v: unknown): string | number | boolean | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = coerceNumber(v);
    return n !== null && /\d/.test(v) ? n : v;
  }
  if (typeof v === "boolean") return v;
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
//  Layer 3 — type resolution
// ────────────────────────────────────────────────────────────────────────────

interface TypeLayer {
  type: CanonicalChartType;
  stacked?: boolean;
  orientation?: Orientation;
}

function resolveTypeLayer(
  obj: ChartInput,
  fallback: CanonicalChartType | false,
  extraAliases: Record<string, CanonicalChartType> | undefined,
  diag: DiagnosticCollector,
): TypeLayer {
  // Accept several field names for the type.
  const rawType =
    obj.type ??
    (obj as Record<string, unknown>).chartType ??
    (obj as Record<string, unknown>)._chartVariant;

  const resolved = resolveType(rawType, extraAliases);

  if (resolved.type) {
    return {
      type: resolved.type,
      ...(resolved.stacked ? { stacked: true } : {}),
      ...(resolved.orientation ? { orientation: resolved.orientation } : {}),
    };
  }

  // Nothing matched.
  const applied = fallback === false ? DEFAULT_FALLBACK : fallback;
  if (rawType === undefined || rawType === null || rawType === "") {
    diag.add(
      "type_missing",
      fallback === false ? "error" : "warn",
      `No chart type provided; ${fallback === false ? "no fallback allowed" : `defaulting to "${applied}"`}.`,
      "type",
    );
  } else {
    diag.add(
      "type_unknown_alias",
      fallback === false ? "error" : "warn",
      `Unrecognized chart type "${String(rawType)}"; ${fallback === false ? "no fallback allowed" : `defaulting to "${applied}"`}.`,
      "type",
    );
  }
  if (fallback !== false) {
    diag.add("type_fallback_applied", "info", `Applied fallback type "${applied}".`, "type");
  }
  return {
    type: applied,
    ...(resolved.stacked ? { stacked: true } : {}),
    ...(resolved.orientation ? { orientation: resolved.orientation } : {}),
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  Layer 5/6 — index & keys resolution
// ────────────────────────────────────────────────────────────────────────────

function firstStringField(obj: ChartInput, names: string[]): string | undefined {
  for (const n of names) {
    const v = (obj as Record<string, unknown>)[n];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return undefined;
}

function resolveIndex(
  obj: ChartInput,
  data: DataPoint[],
  coerce: boolean,
  diag: DiagnosticCollector,
): string {
  const explicit = firstStringField(obj, INDEX_ALIASES);
  if (explicit) {
    if (data.length > 0 && !(explicit in data[0])) {
      diag.add(
        "index_inferred",
        "warn",
        `Declared index "${explicit}" is absent from data rows; using it anyway.`,
        "index",
      );
    }
    return explicit;
  }

  if (data.length > 0) {
    const labels = labelKeys(data[0], coerce);
    if (labels.length > 0) {
      diag.add("index_inferred", "info", `Inferred index "${labels[0]}" from data.`);
      return labels[0];
    }
    // No string field — fall back to the first key that isn't purely numeric data.
    const firstKey = Object.keys(data[0])[0];
    if (firstKey) {
      diag.add(
        "index_inferred",
        "warn",
        `No label field found; using first field "${firstKey}" as index.`,
      );
      return firstKey;
    }
  }

  diag.add("index_unresolved", "warn", 'Could not resolve an index; defaulting to "name".');
  return "name";
}

function resolveKeys(
  obj: ChartInput,
  data: DataPoint[],
  index: string,
  coerce: boolean,
  diag: DiagnosticCollector,
): string[] {
  // Explicit keys (string | string[]) under any known alias.
  for (const name of KEYS_ALIASES) {
    const v = (obj as Record<string, unknown>)[name];
    if (typeof v === "string" && v.trim() !== "") return [v];
    if (Array.isArray(v) && v.length > 0) {
      const arr = v.filter((k): k is string => typeof k === "string" && k !== "");
      if (arr.length > 0) return arr;
    }
  }

  // series[].dataKey
  if (Array.isArray((obj as Record<string, unknown>).series)) {
    const series = (obj as Record<string, unknown>).series as Record<string, unknown>[];
    const fromSeries = series
      .map((s) => (typeof s?.dataKey === "string" ? s.dataKey : undefined))
      .filter((k): k is string => Boolean(k));
    if (fromSeries.length > 0) return fromSeries;
  }

  // Auto-detect numeric fields (excluding the index).
  if (data.length > 0) {
    const nums = numericKeys(data[0], coerce).filter((k) => k !== index);
    if (nums.length > 0) {
      diag.add(
        "keys_inferred",
        "info",
        `Inferred series key(s) [${nums.join(", ")}] from numeric fields.`,
      );
      return nums;
    }
  }

  diag.add(
    "keys_unresolved",
    "warn",
    'Could not resolve any numeric series key; defaulting to ["value"].',
  );
  return ["value"];
}

// ────────────────────────────────────────────────────────────────────────────
//  Series metadata (multi-axis / per-series stacking)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract per-series render hints from `series` input. Only returns entries
 * that need non-default treatment (bound to the right axis, or part of a named
 * stack); everything else renders identically and needs no hint.
 */
function buildSeriesMeta(obj: ChartInput): SeriesMeta[] | undefined {
  const series = (obj as Record<string, unknown>).series;
  if (!Array.isArray(series)) return undefined;

  const metas: SeriesMeta[] = [];
  for (const s of series) {
    if (!isPlainObject(s)) continue;
    const key =
      (typeof s.dataKey === "string" && s.dataKey) ||
      (typeof s.name === "string" && s.name) ||
      (typeof s.label === "string" && s.label) ||
      "";
    if (!key) continue;

    const axis = s.axis === "right" ? "right" : s.axis === "left" ? "left" : undefined;
    const stack = typeof s.stack === "string" && s.stack !== "" ? s.stack : undefined;
    const label = typeof s.label === "string" ? s.label : undefined;

    // Only record series that deviate from the default (single left axis, no stack).
    if (axis === "right" || stack) {
      metas.push({
        key,
        ...(label ? { label } : {}),
        ...(axis ? { axis } : {}),
        ...(stack ? { stack } : {}),
      });
    }
  }
  return metas.length > 0 ? metas : undefined;
}

// ────────────────────────────────────────────────────────────────────────────
//  Layer 7 — type-specific payloads
// ────────────────────────────────────────────────────────────────────────────

function applyTypeSpecific(
  chart: NormalizedChart,
  obj: ChartInput,
  data: DataPoint[],
  index: string,
  keys: string[],
  diag: DiagnosticCollector,
): void {
  switch (chart.type) {
    case "sankey": {
      const links = extractSankeyLinks(obj, data);
      if (links.length === 0) {
        diag.add(
          "type_specific_missing",
          "warn",
          "Sankey chart has no usable links (need source/target/value).",
          "links",
        );
      }
      chart.links = links;
      const nodes = extractSankeyNodes(obj);
      if (nodes.length > 0) chart.nodes = nodes;
      break;
    }
    case "gauge": {
      const value =
        coerceNumber((obj as Record<string, unknown>).value) ??
        (data[0] ? coerceNumber(data[0][keys[0]]) : null) ??
        0;
      const min = coerceNumber((obj as Record<string, unknown>).min) ?? 0;
      const max = coerceNumber((obj as Record<string, unknown>).max) ?? 100;
      const target = coerceNumber((obj as Record<string, unknown>).target);
      chart.gauge = { value, min, max, ...(target !== null ? { target } : {}) };
      break;
    }
    case "quadrant":
    case "risk_matrix": {
      const scale = isPlainObject((obj as Record<string, unknown>).scale)
        ? ((obj as Record<string, unknown>).scale as { min?: unknown; max?: unknown })
        : undefined;
      const min = coerceNumber(scale?.min ?? (obj as Record<string, unknown>).min) ?? 0;
      const max = coerceNumber(scale?.max ?? (obj as Record<string, unknown>).max) ?? 5;
      chart.scale = { min, max };
      break;
    }
    default:
      break;
  }
}

function extractSankeyLinks(obj: ChartInput, data: DataPoint[]): SankeyLink[] {
  const source =
    (Array.isArray((obj as Record<string, unknown>).links) &&
      ((obj as Record<string, unknown>).links as unknown[])) ||
    data;
  const links: SankeyLink[] = [];
  for (const l of source as unknown[]) {
    if (!isPlainObject(l)) continue;
    const s = l.source ?? l.from;
    const t = l.target ?? l.to;
    const v = coerceNumber(l.value ?? l.flow ?? l.weight);
    if (typeof s === "string" && typeof t === "string" && v !== null) {
      links.push({ source: s, target: t, value: v });
    }
  }
  return links;
}

function extractSankeyNodes(obj: ChartInput): SankeyNode[] {
  const raw = (obj as Record<string, unknown>).nodes;
  if (!Array.isArray(raw)) return [];
  const nodes: SankeyNode[] = [];
  for (const n of raw) {
    if (typeof n === "string") nodes.push({ id: n });
    else if (isPlainObject(n) && typeof n.id === "string") {
      nodes.push({ id: n.id, ...(typeof n.label === "string" ? { label: n.label } : {}) });
    }
  }
  return nodes;
}

// ────────────────────────────────────────────────────────────────────────────
//  Public API
// ────────────────────────────────────────────────────────────────────────────

/** Build the empty best-effort chart used as a base / total-failure fallback. */
function emptyChart(type: CanonicalChartType): NormalizedChart {
  return { type, data: [], index: "name", keys: ["value"] };
}

/**
 * Normalize arbitrary chart input into the canonical schema.
 *
 * Never throws unless `options.strict` is true and an `error`-severity
 * diagnostic is produced.
 */
export function normalizeChart(
  input: unknown,
  options: NormalizeOptions = {},
): NormalizeResult {
  const diag = new DiagnosticCollector();
  const coerce = options.coerceNumbers !== false; // default true
  const fallback = options.fallbackType ?? DEFAULT_FALLBACK;

  // ── 1. parse ──
  let raw = parseInput(input, diag);

  // ── 2. transform (custom first, then built-in `series`) ──
  if (options.transformers) {
    for (const t of options.transformers) {
      try {
        if (t.match(raw)) {
          raw = t.transform(raw);
          break;
        }
      } catch {
        diag.add("field_ignored", "warn", `Transformer "${t.name}" threw and was skipped.`);
      }
    }
  }

  // Bare array → treat as data.
  if (Array.isArray(raw)) {
    raw = { data: raw };
  }

  if (!isPlainObject(raw)) {
    diag.add(
      "input_not_object",
      "error",
      "Input is not an object; nothing to normalize.",
    );
    return finalize(emptyChart(fallback === false ? DEFAULT_FALLBACK : fallback), diag, options);
  }

  const seriesReshaped = shapeFromSeries(raw, diag);
  const obj: ChartInput = (seriesReshaped ?? raw) as ChartInput;

  // ── 3. type ──
  const typeLayer = resolveTypeLayer(obj, fallback, options.typeAliases, diag);

  // ── 4. data ──
  const rawData =
    obj.data ?? (obj as Record<string, unknown>).rows ?? (obj as Record<string, unknown>).values;
  const shaped = shapeData(rawData, coerce);
  if (shaped.origin === "empty") {
    if (rawData === undefined) {
      diag.add("data_missing", chart_needs_data(typeLayer.type) ? "warn" : "info", "No `data` field found.", "data");
    } else if (!Array.isArray(rawData) && !isPlainObject(rawData)) {
      diag.add("data_not_array", "warn", "`data` is neither an array nor a columnar object.", "data");
    } else {
      diag.add("data_empty", "info", "`data` is empty.", "data");
    }
  }
  const data = shaped.data;

  // ── 5. index ──
  const index = resolveIndex(obj, data, coerce, diag);

  // ── 6. keys ──
  const keys = resolveKeys(obj, data, index, coerce, diag);

  // ── assemble base ──
  const chart: NormalizedChart = {
    type: typeLayer.type,
    data,
    index,
    keys,
  };
  const title = firstString(obj.title, (obj as Record<string, unknown>).name, metaTitle(obj));
  if (title) chart.title = title;
  if (Array.isArray(obj.colors) && obj.colors.length > 0) {
    chart.colors = obj.colors.filter((c): c is string => typeof c === "string");
  }
  if (typeLayer.stacked || obj.stacked === true) chart.stacked = true;
  const orientation = typeLayer.orientation ?? obj.orientation;
  if (orientation === "horizontal" || orientation === "vertical") chart.orientation = orientation;
  const axes = extractAxes(obj);
  if (axes) chart.axes = axes;
  const seriesMeta = buildSeriesMeta(obj);
  if (seriesMeta) {
    chart.seriesMeta = seriesMeta;
    // A named stack implies a stacked chart even if not flagged explicitly.
    if (seriesMeta.some((m) => m.stack)) chart.stacked = true;
  }
  if (isPlainObject(obj.meta)) chart.meta = obj.meta as Record<string, unknown>;

  // ── 7. type-specific ──
  applyTypeSpecific(chart, obj, data, index, keys, diag);

  return finalize(chart, diag, options);
}

// ────────────────────────────────────────────────────────────────────────────
//  Small assembly helpers
// ────────────────────────────────────────────────────────────────────────────

function chart_needs_data(type: CanonicalChartType): boolean {
  return type !== "sankey" && type !== "gauge";
}

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return undefined;
}

function metaTitle(obj: ChartInput): string | undefined {
  const meta = (obj as Record<string, unknown>).meta;
  if (isPlainObject(meta) && typeof meta.title === "string") return meta.title;
  return undefined;
}

function extractAxes(obj: ChartInput): NormalizedChart["axes"] | undefined {
  const out: NonNullable<NormalizedChart["axes"]> = {};

  // Structured `axes` first.
  if (isPlainObject(obj.axes)) {
    const a = obj.axes as Record<string, unknown>;
    if (isPlainObject(a.x)) out.x = pickAxis(a.x);
    if (isPlainObject(a.y)) out.y = pickAxis(a.y);
  }

  // Chart.js-style `xAxis`/`yAxis` objects and flat `xAxisLabel` etc.
  const rec = obj as Record<string, unknown>;
  if (isPlainObject(rec.xAxis)) out.x = { ...out.x, ...pickAxis(rec.xAxis) };
  if (isPlainObject(rec.yAxis)) out.y = { ...out.y, ...pickAxis(rec.yAxis) };
  if (typeof rec.xAxisLabel === "string") out.x = { ...out.x, label: rec.xAxisLabel };
  if (typeof rec.yAxisLabel === "string") out.y = { ...out.y, label: rec.yAxisLabel };
  const yMin = coerceNumber(rec.yAxisMin);
  const yMax = coerceNumber(rec.yAxisMax);
  if (yMin !== null) out.y = { ...out.y, min: yMin };
  if (yMax !== null) out.y = { ...out.y, max: yMax };

  return out.x || out.y ? out : undefined;
}

function pickAxis(raw: Record<string, unknown>): {
  label?: string;
  min?: number;
  max?: number;
} {
  const a: { label?: string; min?: number; max?: number } = {};
  if (typeof raw.label === "string") a.label = raw.label;
  else if (typeof raw.title === "string") a.label = raw.title;
  const min = coerceNumber(raw.min);
  const max = coerceNumber(raw.max);
  if (min !== null) a.min = min;
  if (max !== null) a.max = max;
  return a;
}

function finalize(
  chart: NormalizedChart,
  diag: DiagnosticCollector,
  options: NormalizeOptions,
): NormalizeResult {
  const ok = !diag.hasError();
  if (!ok && options.strict) {
    const firstError = diag.items.find((d) => d.severity === "error");
    throw new Error(
      `normalizeChart (strict): ${firstError?.message ?? "normalization failed"}`,
    );
  }
  return { ok, chart, diagnostics: diag.items };
}
