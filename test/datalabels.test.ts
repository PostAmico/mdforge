import { describe, it, expect } from "vitest";
import { normalizeChart, renderChartToPng } from "../src/index";
import { toChartJsConfig, formatLabelNumber } from "../src/lib/chart-normalizer/adapters/chartjs";

describe("mdforgeLabels config", () => {
  it("pie/doughnut get inside white labels with percent, ON by default", () => {
    const { chart } = normalizeChart({ type: "pie", data: [{ name: "A", value: 60 }] });
    const dl = toChartJsConfig(chart).options.plugins.mdforgeLabels;
    expect(dl.display).toBe(true);
    expect(dl.placement).toBe("inside");
    expect(dl.color).toBe("#fff");
    expect(dl.showPercent).toBe(true);
  });

  it("bar/funnel/waterfall get outsideTop labels ON by default", () => {
    for (const type of ["bar", "funnel", "waterfall"]) {
      const { chart } = normalizeChart({ type, data: [{ name: "A", value: 5 }] });
      const dl = toChartJsConfig(chart).options.plugins.mdforgeLabels;
      expect(dl.display, `${type} labels`).toBe(true);
      expect(dl.placement).toBe("outsideTop");
    }
  });

  it("cluttered types (scatter, line, heatmap) suppress labels", () => {
    for (const type of ["scatter", "line", "heatmap"]) {
      const { chart } = normalizeChart(
        type === "heatmap"
          ? { type, data: [{ x: "M", y: "AM", value: 1 }] }
          : { type, data: [{ x: 1, y: 2 }] },
      );
      const dl = toChartJsConfig(chart).options.plugins.mdforgeLabels;
      expect(dl.display, `${type} suppressed`).toBe(false);
    }
  });

  it("the external datalabels plugin is always disabled", () => {
    const { chart } = normalizeChart({ type: "pie", data: [{ name: "A", value: 1 }] });
    expect(toChartJsConfig(chart).options.plugins.datalabels.display).toBe(false);
  });

  it("formatLabelNumber is compact", () => {
    expect(formatLabelNumber(1_500_000)).toBe("1.5M");
    expect(formatLabelNumber(3000)).toBe("3k");
    expect(formatLabelNumber(42)).toBe("42");
  });

  it("datalabels:false turns mdforge labels off", () => {
    const { chart } = normalizeChart({ type: "pie", data: [{ name: "A", value: 1 }] });
    const dl = toChartJsConfig(chart, { datalabels: false }).options.plugins.mdforgeLabels;
    expect(dl.display).toBe(false);
  });

  it("renders a single-slice pie WITH labels without crashing", async () => {
    const png = await renderChartToPng({ type: "pie", data: [{ name: "Only", value: 100 }] });
    expect(png).not.toBeNull();
    expect(png!.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("renders a normal pie and a bar with labels", async () => {
    const pie = await renderChartToPng({
      type: "doughnut",
      data: [{ name: "A", value: 60 }, { name: "B", value: 40 }],
    });
    expect(pie).not.toBeNull();
    const bar = await renderChartToPng({
      type: "bar",
      data: [{ name: "A", value: 1200 }, { name: "B", value: 800 }],
    });
    expect(bar).not.toBeNull();
  });
});
