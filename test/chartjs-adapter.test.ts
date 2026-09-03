import { describe, it, expect } from "vitest";
import { normalizeChart, CANONICAL_CHART_TYPES } from "../src/lib/chart-normalizer";
import { toChartJsConfig } from "../src/lib/chart-normalizer/adapters/chartjs";

/** One representative input per canonical type. */
const samples: Record<string, unknown> = {
  bar: { type: "bar", data: [{ name: "A", value: 5 }] },
  line: { type: "line", index: "m", data: [{ m: "Jan", v: 1 }, { m: "Feb", v: 2 }] },
  area: { type: "area", data: [{ name: "A", v: 3 }] },
  radar: { type: "radar", data: [{ axis: "Speed", A: 4 }] },
  scatter: { type: "scatter", data: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
  bubble: { type: "bubble", data: [{ x: 1, y: 2, r: 5 }] },
  pie: { type: "pie", data: [{ name: "A", value: 5 }, { name: "B", value: 3 }] },
  doughnut: { type: "doughnut", data: [{ name: "A", value: 5 }] },
  funnel: { type: "funnel", data: [{ name: "Visits", value: 100 }, { name: "Buys", value: 10 }] },
  treemap: { type: "treemap", data: [{ name: "A", value: 5 }] },
  histogram: { type: "histogram", data: [{ bin: "0-10", count: 5 }] },
  box: { type: "box", data: [{ category: "A", min: 1, q1: 2, median: 3, q3: 4, max: 5 }] },
  distribution: { type: "distribution", data: [{ x: 1, density: 0.2 }] },
  interval: { type: "interval", data: [{ metric: "M", estimate: 5, lower: 3, upper: 7 }] },
  sankey: { type: "sankey", links: [{ source: "A", target: "B", value: 5 }] },
  heatmap: { type: "heatmap", data: [{ x: "Mon", y: "AM", value: 20 }] },
  gauge: { type: "gauge", value: 72, min: 0, max: 100 },
  waterfall: { type: "waterfall", data: [{ name: "Start", value: 100, type: "total" }, { name: "d", value: -20 }] },
  timeline: { type: "timeline", data: [{ phase: "P1", start: "2024-01-01", end: "2024-02-01" }] },
  quadrant: { type: "quadrant", data: [{ effort: 3, impact: 5, name: "A" }] },
  risk_matrix: { type: "risk_matrix", data: [{ effort: 2, impact: 4, name: "B" }] },
  break_even: { type: "break_even", index: "units", data: [{ units: 0, revenue: 0, cost: 50 }] },
};

describe("toChartJsConfig — every canonical type", () => {
  it.each(CANONICAL_CHART_TYPES)("%s produces a valid config without throwing", (type) => {
    const input = samples[type];
    expect(input, `missing sample for ${type}`).toBeDefined();
    const { chart } = normalizeChart(input);
    expect(chart.type).toBe(type);
    const cfg = toChartJsConfig(chart, { scale: 1 });
    expect(typeof cfg.type).toBe("string");
    expect(Array.isArray(cfg.data.datasets)).toBe(true);
  });
});

describe("toChartJsConfig — specific behaviors", () => {
  it("dual-axis: right series binds to y1 and a y1 scale is created", () => {
    const { chart } = normalizeChart({
      chartType: "bar",
      xAxis: { categories: ["Q1", "Q2"] },
      series: [
        { name: "Revenue", data: [100, 200] },
        { name: "ROAS", data: [3, 4], axis: "right" },
      ],
    });
    const cfg = toChartJsConfig(chart, { scale: 1 });
    expect(cfg.options.scales.y1).toBeTruthy();
    const roas = cfg.data.datasets.find((d) => (d as { label?: string }).label === "ROAS");
    expect((roas as { yAxisID?: string }).yAxisID).toBe("y1");
  });

  it("stacked bar sets stacked scales", () => {
    const { chart } = normalizeChart({ type: "stacked bar", data: [{ name: "A", x: 1, y: 2 }] });
    const cfg = toChartJsConfig(chart);
    expect(cfg.options.scales.x.stacked).toBe(true);
    expect(cfg.options.scales.y.stacked).toBe(true);
  });

  it("horizontal bar sets indexAxis to y", () => {
    const { chart } = normalizeChart({ type: "horizontal bar", data: [{ name: "A", value: 1 }] });
    expect(toChartJsConfig(chart).options.indexAxis).toBe("y");
  });

  it("gauge becomes a doughnut of [value, remaining]", () => {
    const { chart } = normalizeChart({ type: "gauge", value: 30, max: 100 });
    const cfg = toChartJsConfig(chart);
    expect(cfg.type).toBe("doughnut");
    expect((cfg.data.datasets[0] as { data: number[] }).data).toEqual([30, 70]);
  });
});
