/**
 * ============================================================================
 *  Chart Normalizer — Public Entry Point
 * ============================================================================
 *
 * Pure, dependency-free core that turns arbitrary LLM/human chart JSON into a
 * single canonical `NormalizedChart`. Framework adapters (Chart.js, Recharts)
 * build on top of this and are shipped separately.
 *
 *   import { normalizeChart } from "@/lib/chart-normalizer";
 *
 *   const { ok, chart, diagnostics } = normalizeChart(rawLlmJson);
 */

// Core function
export { normalizeChart } from "./normalize";

// Alias utilities (useful for adapters, tests, and custom tooling)
export { resolveType, aliasKey, TYPE_ALIASES } from "./aliases";
export type { ResolvedType } from "./aliases";

// Coercion utilities
export { coerceNumber, shapeData, numericKeys, labelKeys, isPlainObject } from "./coerce";
export type { ShapedData } from "./coerce";

// Schema: canonical types, input types, diagnostics, options
export {
  CANONICAL_CHART_TYPES,
  isCanonicalChartType,
} from "./schema";
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
} from "./schema";
