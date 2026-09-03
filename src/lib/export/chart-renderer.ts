/**
 * Chart → PNG Renderer (headless, server-side)
 *
 * Thin wrapper around the shared chart-normalizer:
 *   raw input → normalizeChart() → toChartJsConfig() → Chart.js on a node-canvas
 *
 * Charts are an OPTIONAL feature. Rendering requires the `canvas` and `chart.js`
 * packages, which are declared as optional dependencies. If they are not
 * installed, `renderChartToPng` returns `null` and the caller simply omits the
 * chart (text, tables, and everything else still export fine). Consumers can
 * detect availability up front with `isChartRenderingAvailable()`.
 *
 * All input interpretation lives in `@/lib/chart-normalizer`; all Chart.js
 * config building lives in the Chart.js adapter. This file only owns the canvas
 * surface and plugin registration.
 */

import { CHART_COLORS } from "./constants";
import { normalizeChart } from "../chart-normalizer";
import { toChartJsConfig } from "../chart-normalizer/adapters/chartjs";
import { mdforgeLabelsPlugin } from "../chart-normalizer/adapters/datalabels-plugin";

/** Logical (CSS-pixel) chart size. The rendered bitmap is this times `scale`. */
export const CHART_LOGICAL_WIDTH = 600;
export const CHART_LOGICAL_HEIGHT = 340;
export const CHART_ASPECT_RATIO = CHART_LOGICAL_WIDTH / CHART_LOGICAL_HEIGHT;

/**
 * Supersampling factor. Everything (canvas pixels AND font/line sizes) is
 * multiplied by this, so the chart is drawn at true high resolution rather than
 * upscaled. 4x on a 600x340 logical chart yields a 2400x1360 bitmap, which
 * stays crisp at print DPI in both PDF and DOCX.
 */
export const CHART_RENDER_SCALE = 4;

/** Error thrown when chart rendering is requested but `canvas` is unavailable. */
export class ChartRenderingUnavailableError extends Error {
  constructor() {
    super(
      "mdforge: chart rendering requires the optional `canvas` package. " +
        "Install it to enable charts:\n\n  npm install canvas\n\n" +
        "Text, tables, and all other content export without it.",
    );
    this.name = "ChartRenderingUnavailableError";
  }
}

// ── Lazy, cached loading of the optional chart stack ────────────────────────

interface ChartStack {
  createCanvas: (w: number, h: number) => any;
  Chart: any;
}

let stackPromise: Promise<ChartStack | null> | null = null;

/** Load canvas + chart.js + plugins once. Resolves to null if unavailable. */
function loadChartStack(): Promise<ChartStack | null> {
  if (stackPromise) return stackPromise;

  stackPromise = (async () => {
    let createCanvas: ChartStack["createCanvas"];
    let Chart: any;
    let registerables: any;

    try {
      ({ createCanvas } = await import("canvas"));
      ({ Chart, registerables } = await import("chart.js"));
    } catch {
      // Optional dependency missing — charts are disabled.
      return null;
    }

    Chart.register(...registerables);

    // mdforge's own inline value-label plugin. Draws labels from each element's
    // own computed center, which is stable in headless rendering — unlike the
    // external datalabels plugin, which throws a null-origin error on some arc
    // geometries. Reads config from `options.plugins.mdforgeLabels`.
    Chart.register(mdforgeLabelsPlugin);

    // Optional controllers for advanced chart types. Absence just disables them.
    try {
      const { TreemapController, TreemapElement } = await import("chartjs-chart-treemap");
      Chart.register(TreemapController, TreemapElement);
    } catch {}
    try {
      const { MatrixController, MatrixElement } = await import("chartjs-chart-matrix");
      Chart.register(MatrixController, MatrixElement);
    } catch {}
    try {
      const { BoxPlotController, BoxAndWiskers } = await import("@sgratzl/chartjs-chart-boxplot");
      Chart.register(BoxPlotController, BoxAndWiskers);
    } catch {}
    try {
      const { SankeyController, Flow } = await import("chartjs-chart-sankey");
      Chart.register(SankeyController, Flow);
    } catch {}

    return { createCanvas, Chart };
  })();

  return stackPromise;
}

/**
 * Whether chart rendering is available in this environment (i.e. the optional
 * `canvas` + `chart.js` packages are installed). Useful for callers that want
 * to warn once or choose behavior up front.
 */
export async function isChartRenderingAvailable(): Promise<boolean> {
  return (await loadChartStack()) !== null;
}

export interface RenderChartOptions {
  /** Override the supersampling factor (default `CHART_RENDER_SCALE`). */
  scale?: number;
  /**
   * If true, throw `ChartRenderingUnavailableError` when the chart stack is
   * missing but a chart WAS requested. Default false (return null / skip).
   */
  strict?: boolean;
}

/**
 * Render arbitrary chart input to a PNG buffer. Accepts any value the
 * normalizer understands (Format 1/2/3, messy LLM JSON, JSON strings).
 *
 * Returns `null` when:
 *  - there is nothing renderable (empty data), or
 *  - the optional chart stack (`canvas`) is not installed (unless `strict`), or
 *  - rendering throws for any other reason.
 */
export async function renderChartToPng(
  input: unknown,
  options: RenderChartOptions = {},
): Promise<Buffer | null> {
  const { chart } = normalizeChart(input);

  // Nothing to draw: no rows, no sankey links, no gauge value.
  if (chart.data.length === 0 && !(chart.links && chart.links.length) && !chart.gauge) {
    return null;
  }

  const stack = await loadChartStack();
  if (!stack) {
    if (options.strict) throw new ChartRenderingUnavailableError();
    return null;
  }

  try {
    const { createCanvas, Chart } = stack;
    const scale = options.scale ?? CHART_RENDER_SCALE;
    const width = CHART_LOGICAL_WIDTH * scale;
    const height = CHART_LOGICAL_HEIGHT * scale;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    const config = toChartJsConfig(chart, { scale, palette: CHART_COLORS });
    // Chart.js reads devicePixelRatio for its own scaling; on node-canvas it is
    // undefined. Pin it to 1 so our explicit `scale` is the only multiplier and
    // lines/text land on exact pixels (avoids soft, half-pixel edges).
    config.options.devicePixelRatio = 1;

    new Chart(ctx, config);
    return canvas.toBuffer("image/png");
  } catch (error) {
    console.error("mdforge: failed to render chart:", error);
    return null;
  }
}
