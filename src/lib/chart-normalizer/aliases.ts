/**
 * ============================================================================
 *  Chart Normalizer — Type Alias Resolution
 * ============================================================================
 *
 * LLMs and humans name chart types in wildly inconsistent ways: "donut",
 * "column chart", "stacked bar", "spider", "conversion funnel", "gantt", ...
 * This module maps any of those onto exactly one `CanonicalChartType`, and
 * separately detects "modifier" hints (stacked / horizontal) that are encoded
 * in the name rather than as structured fields.
 *
 * Pure, dependency-free.
 */

import type { CanonicalChartType, Orientation } from "./schema";

/**
 * Normalize a raw type string into a lookup key: lowercase, and strip spaces,
 * underscores, and hyphens. So "Stacked Bar", "stacked_bar", and "stacked-bar"
 * all collapse to "stackedbar".
 */
export function aliasKey(raw: string): string {
  return raw.toLowerCase().replace(/[\s_\-]+/g, "");
}

/**
 * Built-in alias table. Keys are already `aliasKey`-normalized. Values are the
 * canonical type. Modifier-only differences (stacked/horizontal) are handled by
 * `detectModifiers`, so e.g. "stackedbar" still maps to "bar" here.
 */
export const TYPE_ALIASES: Record<string, CanonicalChartType> = {
  // ── bar ──
  bar: "bar",
  bars: "bar",
  barchart: "bar",
  column: "bar",
  columns: "bar",
  columnchart: "bar",
  col: "bar",
  verticalbar: "bar",
  horizontalbar: "bar",
  groupedbar: "bar",
  clusteredbar: "bar",
  clusteredcolumn: "bar",
  stackedbar: "bar",
  stackedcolumn: "bar",
  stacked: "bar",

  // ── line ──
  line: "line",
  lines: "line",
  linechart: "line",
  trend: "line",
  trendline: "line",
  spline: "line",
  multiline: "line",
  curve: "line",

  // ── area ──
  area: "area",
  areachart: "area",
  stackedarea: "area",
  mountain: "area",

  // ── pie ──
  pie: "pie",
  piechart: "pie",
  circle: "pie",

  // ── doughnut ──
  doughnut: "doughnut",
  donut: "doughnut",
  donutchart: "doughnut",
  ring: "doughnut",

  // ── radar ──
  radar: "radar",
  radarchart: "radar",
  spider: "radar",
  spiderweb: "radar",
  spiderchart: "radar",
  web: "radar",
  polar: "radar",

  // ── scatter ──
  scatter: "scatter",
  scatterplot: "scatter",
  scattergraph: "scatter",
  xy: "scatter",
  xyplot: "scatter",
  dotplot: "scatter",

  // ── bubble ──
  bubble: "bubble",
  bubblechart: "bubble",

  // ── funnel ──
  funnel: "funnel",
  funnelchart: "funnel",
  conversionfunnel: "funnel",

  // ── treemap ──
  treemap: "treemap",
  tree: "treemap",

  // ── histogram ──
  histogram: "histogram",
  hist: "histogram",
  frequency: "histogram",

  // ── box ──
  box: "box",
  boxplot: "box",
  boxandwhisker: "box",
  boxwhisker: "box",

  // ── distribution ──
  distribution: "distribution",
  density: "distribution",
  kde: "distribution",
  normal: "distribution",
  gaussian: "distribution",
  bellcurve: "distribution",

  // ── interval ──
  interval: "interval",
  confidenceinterval: "interval",
  errorbar: "interval",
  ci: "interval",

  // ── sankey ──
  sankey: "sankey",
  flow: "sankey",
  flowdiagram: "sankey",

  // ── heatmap ──
  heatmap: "heatmap",
  heat: "heatmap",
  matrix: "heatmap",
  correlation: "heatmap",
  correlationmatrix: "heatmap",

  // ── gauge ──
  gauge: "gauge",
  kpi: "gauge",
  meter: "gauge",
  speedometer: "gauge",
  dial: "gauge",

  // ── waterfall ──
  waterfall: "waterfall",
  bridge: "waterfall",
  cascade: "waterfall",

  // ── timeline ──
  timeline: "timeline",
  gantt: "timeline",
  ganttchart: "timeline",
  schedule: "timeline",

  // ── quadrant ──
  quadrant: "quadrant",
  quadrantchart: "quadrant",
  fourquadrant: "quadrant",
  prioritymatrix: "quadrant",
  eisenhower: "quadrant",

  // ── risk_matrix ──
  risk: "risk_matrix",
  riskmatrix: "risk_matrix",

  // ── break_even ──
  breakeven: "break_even",
  cvp: "break_even",
};

/** Result of resolving a raw type string. */
export interface ResolvedType {
  /** Canonical type, or `null` when nothing matched. */
  type: CanonicalChartType | null;
  /** True when the name implied stacking (e.g. "stacked bar"). */
  stacked?: boolean;
  /** Orientation implied by the name (e.g. "horizontal bar"). */
  orientation?: Orientation;
  /** The `aliasKey`-normalized form that was looked up (for diagnostics). */
  key: string;
}

/**
 * Detect modifier hints encoded in a type name. Operates on the already
 * normalized alias key.
 */
function detectModifiers(key: string): Pick<ResolvedType, "stacked" | "orientation"> {
  const mods: Pick<ResolvedType, "stacked" | "orientation"> = {};
  if (key.includes("stack")) mods.stacked = true;
  if (key.includes("horizontal")) mods.orientation = "horizontal";
  else if (key.includes("vertical")) mods.orientation = "vertical";
  return mods;
}

/**
 * Resolve a raw type string to a canonical type plus modifier hints.
 *
 * @param raw            The raw `type` value from input (any string).
 * @param extraAliases   Optional developer-supplied alias overrides, merged
 *                       over the built-ins. Keys may be in any casing/spacing;
 *                       they are normalized with `aliasKey` before lookup.
 */
export function resolveType(
  raw: unknown,
  extraAliases?: Record<string, CanonicalChartType>,
): ResolvedType {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { type: null, key: "" };
  }

  const key = aliasKey(raw);
  const mods = detectModifiers(key);

  // Developer overrides win over built-ins.
  if (extraAliases) {
    const normalizedExtras: Record<string, CanonicalChartType> = {};
    for (const [k, v] of Object.entries(extraAliases)) {
      normalizedExtras[aliasKey(k)] = v;
    }
    if (normalizedExtras[key]) {
      return { type: normalizedExtras[key], key, ...mods };
    }
  }

  if (TYPE_ALIASES[key]) {
    return { type: TYPE_ALIASES[key], key, ...mods };
  }

  return { type: null, key, ...mods };
}
