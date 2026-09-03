import { describe, it, expect } from "vitest";
import { normalizeChart } from "../src/lib/chart-normalizer";

describe("normalizeChart — input formats", () => {
  it("Format 1: {type, data:[{name,value}]} infers index and keys", () => {
    const { chart, ok } = normalizeChart({
      type: "bar",
      title: "Usage",
      data: [
        { name: "PDF", value: 75 },
        { name: "DOCX", value: 45 },
      ],
    });
    expect(chart.type).toBe("bar");
    expect(chart.index).toBe("name");
    expect(chart.keys).toEqual(["value"]);
    expect(chart.title).toBe("Usage");
    expect(ok).toBe(true);
  });

  it("Format 1 with explicit index/keys is respected", () => {
    const { chart } = normalizeChart({
      type: "area",
      index: "day",
      keys: ["exports"],
      data: [{ day: "Mon", exports: 12 }],
    });
    expect(chart.index).toBe("day");
    expect(chart.keys).toEqual(["exports"]);
  });

  it("Format 2: chartType + series[].dataKey + xKey + meta.title", () => {
    const { chart } = normalizeChart({
      chartType: "line",
      meta: { title: "Growth" },
      xKey: "month",
      series: [{ dataKey: "users" }],
      data: [
        { month: "Jan", users: 100 },
        { month: "Feb", users: 150 },
      ],
    });
    expect(chart.type).toBe("line");
    expect(chart.index).toBe("month");
    expect(chart.keys).toEqual(["users"]);
    expect(chart.title).toBe("Growth");
  });

  it("Format 3: series with categories is transposed into rows", () => {
    const { chart } = normalizeChart({
      chartType: "bar",
      xAxis: { categories: ["Q1", "Q2", "Q3"] },
      series: [
        { name: "Revenue", data: [100, 200, 300] },
        { name: "Cost", data: [40, 80, 120] },
      ],
    });
    expect(chart.data).toHaveLength(3);
    expect(chart.keys).toEqual(["Revenue", "Cost"]);
    expect(chart.data[0].Revenue).toBe(100);
  });

  it("bare array of objects is treated as data with default type", () => {
    const { chart } = normalizeChart([
      { name: "A", value: 10 },
      { name: "B", value: 20 },
    ]);
    expect(chart.data).toHaveLength(2);
    expect(chart.type).toBe("bar");
  });

  it("array of primitives is wrapped into {name,value} rows", () => {
    const { chart } = normalizeChart({ type: "pie", data: [10, 20, 30] });
    expect(chart.data).toHaveLength(3);
    expect(chart.data[0].value).toBe(10);
  });

  it("columnar object of arrays is transposed", () => {
    const { chart } = normalizeChart({
      type: "line",
      data: { month: ["Jan", "Feb"], users: [100, 150] },
    });
    expect(chart.data).toHaveLength(2);
    expect(chart.data[0].month).toBe("Jan");
  });

  it("JSON string input is parsed", () => {
    const { chart } = normalizeChart('{"type":"pie","data":[{"name":"Chrome","value":60}]}');
    expect(chart.type).toBe("pie");
    expect(chart.data).toHaveLength(1);
  });
});

describe("normalizeChart — type-specific payloads", () => {
  it("sankey extracts links from source/target and from/to/flow", () => {
    const { chart } = normalizeChart({
      type: "sankey",
      links: [
        { source: "A", target: "B", value: 10 },
        { from: "B", to: "C", flow: 5 },
      ],
    });
    expect(chart.links).toHaveLength(2);
    expect(chart.links?.[1]).toEqual({ source: "B", target: "C", value: 5 });
  });

  it("gauge builds a value/min/max/target payload", () => {
    const { chart } = normalizeChart({ type: "gauge", value: 72, min: 0, max: 100, target: 90 });
    expect(chart.gauge).toEqual({ value: 72, min: 0, max: 100, target: 90 });
  });

  it("series axis:right and stack are captured as seriesMeta", () => {
    const { chart } = normalizeChart({
      chartType: "bar",
      xAxis: { categories: ["Q1", "Q2"] },
      series: [
        { name: "Revenue", data: [100, 200] },
        { name: "ROAS", data: [3, 4], axis: "right" },
      ],
    });
    expect(chart.seriesMeta).toHaveLength(1);
    expect(chart.seriesMeta?.[0]).toMatchObject({ key: "ROAS", axis: "right" });
  });
});

describe("normalizeChart — diagnostics, fallback, strict", () => {
  it("unknown type falls back to bar with a warning diagnostic", () => {
    const { chart, diagnostics } = normalizeChart({ type: "hologram", data: [{ name: "a", value: 1 }] });
    expect(chart.type).toBe("bar");
    expect(diagnostics.some((d) => d.code === "type_unknown_alias")).toBe(true);
  });

  it("fallbackType:false marks the result not ok", () => {
    const { ok } = normalizeChart({ type: "hologram", data: [{ name: "a", value: 1 }] }, { fallbackType: false });
    expect(ok).toBe(false);
  });

  it("never throws on garbage input by default", () => {
    const { ok, chart } = normalizeChart("not json at all");
    expect(ok).toBe(false);
    expect(chart.type).toBe("bar");
  });

  it("strict mode throws on an error-severity diagnostic", () => {
    expect(() => normalizeChart("not json", { strict: true })).toThrow();
  });

  it("custom typeAliases extend the built-in map", () => {
    const { chart } = normalizeChart(
      { type: "kpi", value: 5 },
      { typeAliases: { kpi: "gauge" } },
    );
    expect(chart.type).toBe("gauge");
  });
});
