/**
 * ============================================================================
 *  Chart Normalizer — Canonical Schema
 * ============================================================================
 *
 * This file defines the single source of truth for what a "chart" is in this
 * project. It has ZERO runtime dependencies and imports nothing framework- or
 * DOM-specific, so it can be shared by the server export pipeline (Chart.js),
 * the client preview (Recharts), tests, and eventually a standalone npm package.
 *
 * There are two shapes here, and the distinction matters:
 *
 *   1. `ChartInput`      — the FORGIVING authoring format. This is what an LLM,
 *                          PostAmico, or a human is recommended to output.
 *                          Almost everything is optional; missing fields are
 *                          inferred by the normalizer.
 *
 *   2. `NormalizedChart` — the STRICT canonical format. This is what the
 *                          normalizer always produces. Every renderer consumes
 *                          this and NEVER has to guess: `type` is always a
 *                          canonical value, `data` is always an array of
 *                          objects, and `index` / `keys` are always resolved.
 *
 * The design goal: the recommended input format and the normalized format are
 * intentionally close, so "easy to output" and "safe to render" are the same
 * idea. The normalizer's job is to (a) accept the messy real world and (b)
 * fill in the blanks to reach the canonical form.
 */

// ============================================================================
//  Canonical chart types
// ============================================================================

/**
 * The closed set of chart types every adapter agrees on. Input can name a type
 * however it likes (`"donut"`, `"stacked bar"`, `"column"`, ...); the normalizer
 * resolves aliases down to exactly one of these.
 *
 * Grouped by family for readability only — at runtime it is a flat list.
 */
export const CANONICAL_CHART_TYPES = [
  // ── Cartesian (category/x axis + one or more numeric series) ──
  "bar",
  "line",
  "area",
  "radar",
  "scatter",
  "bubble",

  // ── Part-to-whole ──
  "pie",
  "doughnut",
  "funnel",
  "treemap",

  // ── Statistical ──
  "histogram",
  "box",
  "distribution",
  "interval",

  // ── Flow / relationship ──
  "sankey",
  "heatmap",

  // ── Business / specialized ──
  "gauge",
  "waterfall",
  "timeline",
  "quadrant",
  "risk_matrix",
  "break_even",
] as const;

/** Union of all canonical chart types. */
export type CanonicalChartType = (typeof CANONICAL_CHART_TYPES)[number];

/**
 * Runtime membership check. Useful for validation and for the normalizer's
 * fallback logic.
 */
export function isCanonicalChartType(value: unknown): value is CanonicalChartType {
  return (
    typeof value === "string" &&
    (CANONICAL_CHART_TYPES as readonly string[]).includes(value)
  );
}

// ============================================================================
//  Building blocks
// ============================================================================

/**
 * A single row of chart data. Always a flat object of primitive values.
 * Example: `{ name: "PDF", value: 75 }` or `{ month: "Jan", users: 100, churn: 12 }`.
 */
export type DataPoint = Record<string, string | number | boolean | null>;

/** Orientation of a cartesian chart's category axis. */
export type Orientation = "vertical" | "horizontal";

/** Configuration for a single axis. All fields optional. */
export interface AxisConfig {
  /** Human-readable axis title, e.g. "Revenue ($)". */
  label?: string;
  /** Hard lower bound. Omit to let the renderer auto-scale. */
  min?: number;
  /** Hard upper bound. Omit to let the renderer auto-scale. */
  max?: number;
}

/** A single flow edge for a sankey diagram. */
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

/** An optional named node for a sankey diagram. */
export interface SankeyNode {
  id: string;
  label?: string;
}

/**
 * Per-series render hint. One entry per key in `NormalizedChart.keys` that
 * needs special treatment. Lets adapters support multi-axis and per-series
 * stacking without re-parsing the original input. Absent when every series is
 * plotted identically on a single axis (the common case).
 */
export interface SeriesMeta {
  /** The data field this hint applies to (matches an entry in `keys`). */
  key: string;
  /** Display label, if it differs from the key. */
  label?: string;
  /** Which y-axis to bind this series to. Defaults to "left". */
  axis?: "left" | "right";
  /** Stack group id; series sharing an id stack together. */
  stack?: string;
}

// ============================================================================
//  NormalizedChart — the canonical, fully-resolved output
// ============================================================================

/**
 * The guaranteed output of the normalizer. Renderers can rely on every
 * non-optional field being present and valid.
 *
 * Type-specific fields (e.g. `links`, `gauge`, `scale`) are optional at the
 * type level but are guaranteed by the normalizer to be present whenever
 * `type` requires them. See the per-type notes below.
 */
export interface NormalizedChart {
  /** Always one of the canonical types. Never an alias. */
  type: CanonicalChartType;

  /** Optional chart title. Empty/absent means "no title". */
  title?: string;

  /**
   * The data rows. ALWAYS an array of flat objects (possibly empty for chart
   * types that carry their data elsewhere, e.g. `sankey` uses `links`).
   */
  data: DataPoint[];

  /**
   * The field in each row used for labels / categories / the x-axis.
   * Always resolved to a concrete key present in the data (best effort).
   * For pie/doughnut this is the slice name key; for scatter it is the x key.
   */
  index: string;

  /**
   * The numeric series field(s) to plot. Always at least one entry.
   * Multiple entries mean a multi-series (grouped/stacked/multi-line) chart.
   */
  keys: string[];

  /** Ordered color palette. When omitted, adapters apply their default. */
  colors?: string[];

  // ── Cartesian modifiers ──

  /** Stack series instead of grouping them (bar/area). */
  stacked?: boolean;

  /** Bar orientation. `horizontal` swaps the category axis. */
  orientation?: Orientation;

  /** Axis titles and bounds. */
  axes?: {
    x?: AxisConfig;
    y?: AxisConfig;
  };

  /**
   * Optional per-series render hints (multi-axis, per-series stacking). Only
   * present when at least one series needs non-default treatment. Adapters that
   * do not support multi-axis can safely ignore this.
   */
  seriesMeta?: SeriesMeta[];

  // ── Type-specific payloads (present only for the relevant `type`) ──

  /**
   * Sankey flows. Required when `type === "sankey"`.
   * `data` will typically be empty in that case.
   */
  links?: SankeyLink[];
  /** Optional named nodes for sankey; labels default to node ids. */
  nodes?: SankeyNode[];

  /** Gauge payload. Required when `type === "gauge"`. */
  gauge?: {
    value: number;
    min: number;
    max: number;
    target?: number;
  };

  /**
   * Coordinate bounds for `quadrant` / `risk_matrix`. When present, both axes
   * share this scale unless overridden by `axes`.
   */
  scale?: {
    min: number;
    max: number;
  };

  /**
   * Untouched passthrough for anything an adapter or downstream consumer might
   * want that the canonical schema does not model. The normalizer never reads
   * this; it only preserves it.
   */
  meta?: Record<string, unknown>;
}

// ============================================================================
//  ChartInput — the recommended, forgiving authoring format
// ============================================================================

/**
 * The format we recommend producers (LLMs, PostAmico, humans) emit. It is a
 * loosened `NormalizedChart`: `type` may be any string (aliases allowed),
 * `index` / `keys` may be omitted (they get inferred), and a handful of common
 * "shorthand" fields are accepted for convenience.
 *
 * This type is intentionally permissive. The normalizer accepts `unknown` in
 * practice; `ChartInput` documents the *happy path* an author should aim for.
 */
export interface ChartInput {
  /**
   * Chart type. May be a canonical type or a known alias
   * (e.g. "donut", "column", "stacked bar", "scatter plot").
   * If omitted or unrecognized, the normalizer falls back (default: "bar").
   */
  type?: string;

  /** Chart title. */
  title?: string;

  /** Data rows. The common, recommended shape. */
  data?: DataPoint[];

  /** Explicit label/category/x key. Inferred from `data` when omitted. */
  index?: string;

  /**
   * Explicit numeric series key(s). Accepts a single string or an array.
   * Inferred from `data` (numeric fields) when omitted.
   */
  keys?: string | string[];

  /** Color palette. */
  colors?: string[];

  // ── Optional modifiers ──
  stacked?: boolean;
  orientation?: Orientation;
  axes?: { x?: AxisConfig; y?: AxisConfig };

  // ── Type-specific shorthands (all optional) ──
  links?: SankeyLink[];
  nodes?: SankeyNode[];
  value?: number; // gauge
  min?: number; // gauge / scale
  max?: number; // gauge / scale
  target?: number; // gauge
  scale?: { min: number; max: number };

  /** Preserved and surfaced on the normalized output. */
  meta?: Record<string, unknown>;

  /**
   * Escape hatch: authors/tools may attach arbitrary extra fields. The
   * normalizer will try known aliases for these (see the alias/transformer
   * layer) and otherwise ignore them.
   */
  [key: string]: unknown;
}

// ============================================================================
//  Diagnostics — how the normalizer reports what it did
// ============================================================================

/**
 * Severity of a diagnostic.
 * - `info`  — a normal inference happened (e.g. "inferred index = 'month'").
 * - `warn`  — input was ambiguous/nonstandard but recoverable.
 * - `error` — input could not be honored; a fallback was applied (or, in
 *             strict mode, the normalizer throws instead).
 */
export type DiagnosticSeverity = "info" | "warn" | "error";

/** Stable, machine-readable diagnostic codes for programmatic handling. */
export type DiagnosticCode =
  | "input_not_object"
  | "type_missing"
  | "type_unknown_alias"
  | "type_fallback_applied"
  | "data_missing"
  | "data_not_array"
  | "data_empty"
  | "data_shape_transposed"
  | "index_inferred"
  | "index_unresolved"
  | "keys_inferred"
  | "keys_unresolved"
  | "value_coerced"
  | "field_ignored"
  | "type_specific_missing";

/** A single structured note about the normalization process. */
export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  /** Human-readable explanation, safe to show in a UI or log. */
  message: string;
  /** Optional dotted path to the offending field, e.g. "series[0].data". */
  path?: string;
}

// ============================================================================
//  Normalizer contract (options + result)
// ============================================================================

/** Options controlling normalizer behavior. All optional. */
export interface NormalizeOptions {
  /**
   * What to do when the type is missing/unknown.
   * - A canonical type (default `"bar"`) → coerce and emit a warning.
   * - `false` → do not coerce; emit an `error` diagnostic and mark result not ok.
   */
  fallbackType?: CanonicalChartType | false;

  /**
   * Extra alias → canonical mappings, merged over the built-ins.
   * Lets developers teach the normalizer their own naming without forking.
   * Example: `{ "kpi": "gauge", "trend": "line" }`.
   */
  typeAliases?: Record<string, CanonicalChartType>;

  /**
   * Coerce stringy numbers into numbers ("1,200" → 1200, "$45" → 45, "12%" → 12).
   * Default: `true`.
   */
  coerceNumbers?: boolean;

  /**
   * Throw on the first `error`-severity diagnostic instead of falling back.
   * Intended for developers who want hard guarantees in tests/pipelines.
   * Default: `false` (never throw).
   */
  strict?: boolean;

  /**
   * Ordered custom shape detectors, tried before the built-in ones. Each can
   * claim an input and pre-shape it toward `ChartInput`. This is the primary
   * extension point for input formats the core does not know about.
   */
  transformers?: InputTransformer[];
}

/**
 * A pluggable detector/reshaper for nonstandard input shapes. Return a
 * (partially) reshaped `ChartInput` to claim the input, or `null` to pass.
 */
export interface InputTransformer {
  name: string;
  /** Return `true` if this transformer recognizes the raw input. */
  match: (raw: unknown) => boolean;
  /** Reshape the recognized input toward the authoring format. */
  transform: (raw: unknown) => ChartInput;
}

/**
 * The normalizer ALWAYS returns this (unless `strict` is set and an error is
 * hit). `chart` is best-effort even when `ok` is false, so callers can still
 * attempt a render or show a meaningful placeholder.
 */
export interface NormalizeResult {
  /** `false` when an `error`-severity diagnostic was recorded. */
  ok: boolean;
  /** Best-effort canonical chart. Present even on failure. */
  chart: NormalizedChart;
  /** Everything the normalizer inferred, warned about, or rejected. */
  diagnostics: Diagnostic[];
}
