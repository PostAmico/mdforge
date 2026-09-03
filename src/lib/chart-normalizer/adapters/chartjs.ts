/**
 * ============================================================================
 *  Chart Normalizer — Chart.js Adapter
 * ============================================================================
 *
 * Pure function: `NormalizedChart` → a Chart.js configuration object.
 *
 * This produces a plain config object literal; it does NOT import chart.js and
 * has no runtime dependencies. The caller (e.g. the PNG renderer) is
 * responsible for `new Chart(ctx, config)` and any plugin registration.
 *
 * All the type interpretation (which chart type, what the data means, which
 * fields are the index/keys) has already happened in the normalizer. This file
 * only concerns itself with mapping the canonical shape onto Chart.js's dataset
 * and options structure — one responsibility, no guessing.
 */

import type { DataPoint, NormalizedChart } from "../schema";

/** Fallback palette (matches the app's design-system chart colors). */
export const DEFAULT_CHARTJS_PALETTE = [
  "#8A2BE2",
  "#4169E1",
  "#FF6347",
  "#2E8B57",
  "#D4AF37",
];

export interface ChartJsAdapterOptions {
  /**
   * Pixel scale multiplier applied to font sizes / borders so the chart stays
   * crisp when rendered onto a high-DPI canvas. Defaults to 2 (retina) for the
   * static PNG export; use 1 for on-screen rendering (the browser handles DPI).
   */
  scale?: number;
  /** Palette used when the chart does not carry its own `colors`. */
  palette?: string[];
  /**
   * Chart.js `responsive`. Off by default (fixed-size canvas for PNG export);
   * set true for a canvas that should resize with its container (live preview).
   */
  responsive?: boolean;
  /**
   * Chart.js `animation`. Off by default — the export is a single static frame
   * and the preview is meant to feel instant.
   */
  animation?: boolean;
  /** Chart.js `maintainAspectRatio`. Only relevant when `responsive` is true. */
  maintainAspectRatio?: boolean;
  /** Chart.js `aspectRatio` (width / height). Only used when responsive. */
  aspectRatio?: number;
  /**
   * Draw value labels on data points. ON by default (the numbers are essential
   * on pie/doughnut/funnel). Set to `false` to turn them off. Labels are drawn
   * by mdforge's own inline plugin — no external datalabels plugin required.
   */
  datalabels?: boolean;
}

/** Loose shape of the Chart.js config we emit (kept generic on purpose). */
export type ChartJsConfig = {
  type: string;
  data: { labels?: unknown[]; datasets: Record<string, unknown>[] };
  options: Record<string, any>;
};

// ────────────────────────────────────────────────────────────────────────────
//  Small numeric helpers
// ────────────────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Config consumed by mdforge's own inline label plugin (see the renderer).
 * Kept deliberately simple and serializable: which chart types show labels,
 * where to place them, and how to format the number. We compute label geometry
 * from each element's own center at draw time, so there is no fragile external
 * positioner to crash.
 */
export interface MdforgeLabelConfig {
  display: boolean;
  /** "inside" (centered, for arcs) or "outsideTop" (above bars). */
  placement?: "inside" | "outsideTop";
  color?: string;
  fontSize?: number;
  /** Whether to append the % share of the dataset total (pie/doughnut). */
  showPercent?: boolean;
}

/**
 * Decide whether/how to show value labels for a chart type. Labels are ON for
 * the types where the number is the point (pie, doughnut, bar, funnel,
 * waterfall, interval) and OFF for dense/point types where they'd clutter.
 */
function buildDataLabels(type: NormalizedChart["type"], scale: number): MdforgeLabelConfig {
  const isCircular = type === "pie" || type === "doughnut";
  const isBarLike =
    type === "bar" || type === "funnel" || type === "waterfall" || type === "interval";

  if (isCircular) {
    return {
      display: true,
      placement: "inside",
      color: "#fff",
      fontSize: 10 * scale,
      showPercent: true,
    };
  }
  if (isBarLike) {
    return { display: true, placement: "outsideTop", color: "#444", fontSize: 10 * scale };
  }
  // Dense / point / specialized types: no labels.
  return { display: false };
}

/**
 * Format a numeric value compactly for a data label (1.5M, 3k, 42). Exposed so
 * the renderer's inline plugin and any consumer share identical formatting.
 */
export function formatLabelNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n * 100) / 100);
}

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

/** Whether a field holds a numeric value in the first data row. */
function isNumericField(data: DataPoint[], field: string): boolean {
  if (data.length === 0) return false;
  const v = data[0][field];
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Resolve the x/y field names for point-based charts (scatter/bubble/quadrant).
 * Rule: two or more series keys → use the first two as x/y; otherwise x is the
 * index and y is the first key. This handles both `{x, y}` rows and
 * `xKey`/`yKey`-declared inputs consistently.
 */
function resolveXY(chart: NormalizedChart, xFallback: string, yFallback: string) {
  if (chart.keys.length >= 2) {
    return { xK: chart.keys[0], yK: chart.keys[1] };
  }
  const xK = isNumericField(chart.data, chart.index) ? chart.index : xFallback;
  const yK = chart.keys[0] ?? yFallback;
  return { xK, yK };
}

// ────────────────────────────────────────────────────────────────────────────
//  Main adapter
// ────────────────────────────────────────────────────────────────────────────

export function toChartJsConfig(
  chart: NormalizedChart,
  options: ChartJsAdapterOptions = {},
): ChartJsConfig {
  const scale = options.scale ?? 2;
  const palette =
    chart.colors && chart.colors.length > 0
      ? chart.colors
      : options.palette ?? DEFAULT_CHARTJS_PALETTE;

  const type = chart.type;
  const title = chart.title ?? "";
  const data = chart.data;
  const indexKey = chart.index;
  const keyList = chart.keys;

  const config: ChartJsConfig = {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      responsive: options.responsive ?? false,
      animation: options.animation ?? false,
      ...(options.maintainAspectRatio !== undefined
        ? { maintainAspectRatio: options.maintainAspectRatio }
        : {}),
      ...(options.aspectRatio !== undefined ? { aspectRatio: options.aspectRatio } : {}),
      plugins: {
        legend: { display: true, position: "bottom", labels: { font: { size: 10 * scale } } },
        title: {
          display: !!title,
          text: title,
          font: { size: 14 * scale, weight: "bold" },
          padding: { bottom: 15 * scale },
        },
        // Disable the external datalabels plugin if it happens to be
        // registered; we draw labels with our own robust inline plugin instead
        // (see `mdforgeLabels` below and the renderer). The external plugin has
        // a null-origin crash on some headless arc geometries.
        datalabels: { display: false },
        // Value labels drawn by mdforge's own inline plugin. ON by default
        // because for pie / doughnut / funnel the numbers ARE the point. Set
        // `datalabels: false` on the adapter to turn them off.
        mdforgeLabels:
          options.datalabels === false ? { display: false } : buildDataLabels(type, scale),
      },
      scales: {
        x: { ticks: { font: { size: 10 * scale } } },
        y: { ticks: { font: { size: 10 * scale } } },
      },
    },
  };

  // Charts without cartesian scales.
  if (type === "pie" || type === "doughnut" || type === "radar" || type === "gauge") {
    config.options.scales = {};
  }

  // ── Generic dataset mapping (bar/line/area/radar and the base for others) ──
  config.data.labels = data.map((d) => str(d[indexKey]));
  const hasRightAxis = (chart.seriesMeta ?? []).some((m) => m.axis === "right");
  config.data.datasets = keyList.map((k, i) => {
    const meta = chart.seriesMeta?.find((m) => m.key === k);
    return {
      label: meta?.label ?? k,
      data: data.map((d) => num(d[k])),
      backgroundColor:
        type === "line" || type === "scatter" ? palette[i % palette.length] : palette[i % palette.length] + "CC",
      borderColor: palette[i % palette.length],
      borderWidth: 2 * scale,
      fill: type === "area" || type === "radar",
      tension: type === "line" || type === "area" ? 0.4 : 0,
      ...(meta?.axis === "right" ? { yAxisID: "y1" } : {}),
      ...(meta?.stack ? { stack: meta.stack } : {}),
    };
  });

  if (hasRightAxis) {
    config.options.scales.y = {
      type: "linear",
      display: true,
      position: "left",
      ticks: { font: { size: 10 * scale } },
    };
    config.options.scales.y1 = {
      type: "linear",
      display: true,
      position: "right",
      grid: { drawOnChartArea: false },
      ticks: { font: { size: 10 * scale } },
    };
  }

  // ── Axis configuration ──
  if (chart.orientation === "horizontal") {
    config.options.indexAxis = "y";
  }
  const yAxis = chart.axes?.y;
  const xAxis = chart.axes?.x;
  if (yAxis?.min !== undefined && config.options.scales.y) config.options.scales.y.min = yAxis.min;
  if (yAxis?.max !== undefined && config.options.scales.y) config.options.scales.y.max = yAxis.max;
  if (xAxis?.label && config.options.scales.x) {
    config.options.scales.x.title = {
      display: true,
      text: xAxis.label,
      font: { size: 11 * scale, weight: "bold" },
    };
  }
  if (yAxis?.label && config.options.scales.y) {
    config.options.scales.y.title = {
      display: true,
      text: yAxis.label,
      font: { size: 11 * scale, weight: "bold" },
    };
  }

  // ── Variants ──
  if (type === "bar") {
    config.type = "bar";
    if (chart.stacked) {
      config.options.scales.x = { ...config.options.scales.x, stacked: true };
      config.options.scales.y = { ...config.options.scales.y, stacked: true };
    }
  } else if (type === "line" || type === "area") {
    config.type = "line";
    config.data.datasets.forEach((d: any) => {
      d.pointRadius = 4 * scale;
      d.pointHoverRadius = 6 * scale;
    });
  } else if (type === "pie" || type === "doughnut") {
    config.type = type;
    config.data.datasets = [
      {
        data: data.map((d) => num(d[keyList[0] ?? "value"])),
        backgroundColor: palette,
      },
    ];
  } else if (type === "scatter" || type === "bubble") {
    config.type = type;
    config.data.labels = undefined;
    const { xK, yK } = resolveXY(chart, "x", "y");
    config.data.datasets = [
      {
        label: chart.seriesMeta?.[0]?.label ?? "Data",
        data: data.map((d) => ({
          x: num(d[xK]),
          y: num(d[yK]),
          r: type === "bubble" ? num(d.bubbleSize ?? d.r ?? d.size ?? 10) * scale : 5 * scale,
        })),
        backgroundColor: palette[0],
      },
    ];
    config.options.scales = {
      ...config.options.scales,
      x: { type: "linear", position: "bottom", ticks: { font: { size: 10 * scale } } },
    };
  } else if (type === "radar") {
    config.type = "radar";
    config.data.datasets.forEach((d: any) => {
      d.fill = true;
      d.backgroundColor = d.borderColor + "40";
    });
  } else if (type === "histogram") {
    config.type = "bar";
    config.options.scales.x = {
      ...config.options.scales.x,
      display: true,
      categoryPercentage: 1.0,
      barPercentage: 1.0,
    };
  } else if (type === "waterfall") {
    config.type = "bar";
    let running = 0;
    const floatData = data.map((d) => {
      const val = num(d.value);
      if (d.type === "total") {
        running = val;
        return [0, val];
      }
      const prev = running;
      running += val;
      return [prev, running];
    });
    config.data.datasets = [
      {
        label: "Waterfall",
        data: floatData,
        backgroundColor: data.map((d) =>
          d.type === "total" ? "#4169E1" : num(d.value) >= 0 ? "#2E8B57" : "#DC143C",
        ),
      },
    ];
  } else if (type === "funnel") {
    config.type = "bar";
    config.options.indexAxis = "y";
    const maxVal = Math.max(...data.map((d) => num(d.value)), 0);
    config.data.datasets = [
      {
        label: "Funnel",
        data: data.map((d) => {
          const val = num(d.value);
          const pad = (maxVal - val) / 2;
          return [pad, pad + val];
        }),
        backgroundColor: palette[0],
      },
    ];
    config.options.scales.x = { display: false };
  } else if (type === "gauge") {
    config.type = "doughnut";
    config.data.labels = ["Achieved", "Remaining"];
    const val = chart.gauge?.value ?? 0;
    const max = chart.gauge?.max ?? 100;
    config.data.datasets = [
      { data: [val, Math.max(0, max - val)], backgroundColor: [palette[3 % palette.length], "#eee"] },
    ];
    config.options.rotation = 270;
    config.options.circumference = 180;
  } else if (type === "timeline") {
    config.type = "bar";
    config.options.indexAxis = "y";
    config.data.labels = data.map((d) => str(d.phase ?? d.name));
    config.data.datasets = [
      {
        label: "Timeline",
        data: data.map((d) => [new Date(str(d.start)).getTime(), new Date(str(d.end)).getTime()]),
        backgroundColor: palette[0],
      },
    ];
    config.options.scales.x = {
      type: "linear",
      ticks: {
        callback: (v: any) => new Date(v).toLocaleDateString(),
        font: { size: 10 * scale },
      },
    };
  } else if (type === "distribution") {
    config.type = "line";
    config.data.labels = data.map((d) => str(d.x));
    config.data.datasets = [
      { label: "Density", data: data.map((d) => num(d.density)), fill: true, tension: 0.4 },
    ];
  } else if (type === "interval") {
    config.type = "bar";
    config.options.indexAxis = "y";
    config.data.labels = data.map((d) => str(d.metric));
    config.data.datasets = [
      {
        label: "Estimate",
        data: data.map((d) => num(d.estimate)),
        backgroundColor: palette[1 % palette.length],
        type: "scatter",
      },
      {
        label: "Range",
        data: data.map((d) => [num(d.lower), num(d.upper)]),
        backgroundColor: palette[0] + "80",
        type: "bar",
        barPercentage: 0.2,
      },
    ];
  } else if (type === "quadrant" || type === "risk_matrix") {
    config.type = "scatter";
    config.data.labels = undefined;
    const { xK, yK } = resolveXY(chart, "effort", "impact");
    const sMin = chart.scale?.min ?? 0;
    const sMax = chart.scale?.max ?? 5;
    config.data.datasets = [
      {
        label: "Items",
        data: data.map((d) => ({ x: num(d[xK]), y: num(d[yK]) })),
        backgroundColor: palette[0],
        pointRadius: 6 * scale,
      },
    ];
    config.options.scales = {
      x: {
        min: sMin,
        max: sMax,
        title: { display: true, text: chart.axes?.x?.label ?? xK, font: { size: 11 * scale } },
        ticks: { font: { size: 10 * scale } },
      },
      y: {
        min: sMin,
        max: sMax,
        title: { display: true, text: chart.axes?.y?.label ?? yK, font: { size: 11 * scale } },
        ticks: { font: { size: 10 * scale } },
      },
    };
  } else if (type === "treemap") {
    config.type = "treemap";
    config.data.datasets = [
      {
        tree: data,
        key: keyList[0] ?? "value",
        groups: [indexKey],
        backgroundColor: (ctx: any) => palette[ctx.dataIndex % palette.length],
      },
    ];
  } else if (type === "heatmap") {
    config.type = "matrix";
    const xK = heatField(data, ["x"], indexKey);
    const yK = heatField(data, ["y"], "y");
    const vK = heatField(data, ["value", "v"], keyList[0] ?? "value");
    const xLabels = Array.from(new Set(data.map((d) => d[xK])));
    const yLabels = Array.from(new Set(data.map((d) => d[yK])));
    config.data.datasets = [
      {
        label: "Heatmap",
        data: data.map((d) => ({ x: d[xK], y: d[yK], v: num(d[vK]) })),
        backgroundColor(context: any) {
          const value = context.dataset.data[context.dataIndex]?.v || 0;
          return `rgba(65, 105, 225, ${Math.max(0.1, value / 100)})`;
        },
        width: (c: any) =>
          c.chart.chartArea ? c.chart.chartArea.width / xLabels.length - 2 : 20 * scale,
        height: (c: any) =>
          c.chart.chartArea ? c.chart.chartArea.height / yLabels.length - 2 : 20 * scale,
      },
    ];
    config.options.scales = {
      x: { type: "category", labels: xLabels, ticks: { font: { size: 10 * scale } } },
      y: { type: "category", labels: yLabels, ticks: { font: { size: 10 * scale } } },
    };
  } else if (type === "sankey") {
    config.type = "sankey";
    config.data.datasets = [
      {
        label: "Sankey",
        data: (chart.links ?? []).map((l) => ({ from: l.source, to: l.target, flow: l.value })),
        colorFrom: (c: any) => palette[c.dataIndex % palette.length],
        colorTo: (c: any) => palette[(c.dataIndex + 1) % palette.length],
      },
    ];
  } else if (type === "box") {
    config.type = "boxplot";
    config.data.labels = data.map((d) => str(d.category ?? d[indexKey]));
    config.data.datasets = [
      {
        label: "Box Plot",
        data: data.map((d) => [num(d.min), num(d.q1), num(d.median), num(d.q3), num(d.max)]),
        backgroundColor: palette[0] + "80",
        borderColor: palette[0],
        borderWidth: 2 * scale,
      },
    ];
  } else if (type === "break_even") {
    config.type = "line";
    config.data.datasets.forEach((d: any) => {
      d.fill = false;
      d.tension = 0;
    });
  }

  return config;
}

/** Pick the first present field name from candidates, else the fallback. */
function heatField(data: DataPoint[], candidates: string[], fallback: string): string {
  const row = data[0] ?? {};
  for (const c of candidates) {
    if (c in row) return c;
  }
  return fallback;
}
