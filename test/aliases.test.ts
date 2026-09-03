import { describe, it, expect } from "vitest";
import { resolveType, aliasKey } from "../src/lib/chart-normalizer";

describe("aliasKey", () => {
  it("lowercases and strips spaces/underscores/hyphens", () => {
    expect(aliasKey("Stacked Bar")).toBe("stackedbar");
    expect(aliasKey("stacked_bar")).toBe("stackedbar");
    expect(aliasKey("stacked-bar")).toBe("stackedbar");
  });
});

describe("resolveType", () => {
  it("resolves common aliases to canonical types", () => {
    expect(resolveType("donut").type).toBe("doughnut");
    expect(resolveType("column chart").type).toBe("bar");
    expect(resolveType("spider").type).toBe("radar");
    expect(resolveType("conversion funnel").type).toBe("funnel");
    expect(resolveType("gantt").type).toBe("timeline");
  });

  it("detects stacked modifier from the name", () => {
    const r = resolveType("stacked bar");
    expect(r.type).toBe("bar");
    expect(r.stacked).toBe(true);
  });

  it("detects orientation modifier from the name", () => {
    expect(resolveType("horizontal bar").orientation).toBe("horizontal");
    expect(resolveType("vertical bar").orientation).toBe("vertical");
  });

  it("returns null type for unknown names", () => {
    expect(resolveType("hologram").type).toBeNull();
    expect(resolveType("object").type).toBeNull();
    expect(resolveType("").type).toBeNull();
    expect(resolveType(undefined).type).toBeNull();
  });

  it("developer overrides win over built-ins", () => {
    expect(resolveType("bar", { bar: "line" }).type).toBe("line");
    expect(resolveType("kpi", { kpi: "gauge" }).type).toBe("gauge");
  });
});
