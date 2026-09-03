/**
 * Full chart-normalizer surface: the pure core plus the Chart.js adapter.
 *
 * This is the entry point re-exported by the package root and (optionally) by a
 * `mdforge/chart-normalizer` subpath, so consumers can use the normalizer on
 * its own without pulling in the PDF/DOCX pipeline.
 */

export * from "./index";
export { toChartJsConfig, DEFAULT_CHARTJS_PALETTE } from "./adapters/chartjs";
export type { ChartJsAdapterOptions, ChartJsConfig } from "./adapters/chartjs";
