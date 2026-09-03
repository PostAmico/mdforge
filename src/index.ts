/**
 * mdforge — forge markdown into polished PDF & DOCX. Pure Node, no headless browser.
 *
 * Primary API:
 *   import { markdownToPdf, markdownToDocx } from "mdforge";
 *
 *   const pdf  = await markdownToPdf(markdown, { title: "Report" });
 *   const docx = await markdownToDocx(markdown, { title: "Report" });
 *
 * Charts are optional: they render when the `canvas` package is installed and
 * are skipped gracefully otherwise. The chart-normalizer is also exported for
 * standalone use.
 */

// ── Document exporters ──
export { markdownToPdf } from "./lib/export/markdown-to-pdf";
export { markdownToDocx } from "./lib/export/markdown-to-docx";
export type { ExportOptions, ExportInput } from "./lib/export/types";

// ── Chart rendering (optional canvas) ──
export {
  renderChartToPng,
  isChartRenderingAvailable,
  ChartRenderingUnavailableError,
  CHART_ASPECT_RATIO,
  CHART_LOGICAL_WIDTH,
  CHART_LOGICAL_HEIGHT,
  CHART_RENDER_SCALE,
} from "./lib/export/chart-renderer";
export type { RenderChartOptions } from "./lib/export/chart-renderer";

// ── Lower-level building blocks (advanced use) ──
export { preprocessContent } from "./lib/export/preprocess-content";

// ── Chart normalizer (standalone, zero-dependency core) ──
export {
  normalizeChart,
  toChartJsConfig,
  resolveType,
  aliasKey,
  TYPE_ALIASES,
  coerceNumber,
  shapeData,
  numericKeys,
  labelKeys,
  isPlainObject,
  isCanonicalChartType,
  CANONICAL_CHART_TYPES,
} from "./lib/chart-normalizer/full";
export type {
  CanonicalChartType,
  ChartInput,
  DataPoint,
  Orientation,
  AxisConfig,
  SankeyLink,
  SankeyNode,
  SeriesMeta,
  NormalizedChart,
  Diagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
  NormalizeOptions,
  NormalizeResult,
  InputTransformer,
  ResolvedType,
  ShapedData,
  ChartJsAdapterOptions,
  ChartJsConfig,
} from "./lib/chart-normalizer/full";
