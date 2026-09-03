import { describe, it, expect } from "vitest";
import { coerceNumber, shapeData, numericKeys, labelKeys } from "../src/lib/chart-normalizer";

describe("coerceNumber", () => {
  it("passes through finite numbers", () => {
    expect(coerceNumber(42)).toBe(42);
    expect(coerceNumber(-3.5)).toBe(-3.5);
  });

  it("strips currency symbols and thousands separators", () => {
    expect(coerceNumber("$1,200")).toBe(1200);
    expect(coerceNumber("€45.50")).toBe(45.5);
    expect(coerceNumber("₹2,00,000")).toBe(200000);
  });

  it("handles percentages by dropping the sign", () => {
    expect(coerceNumber("45%")).toBe(45);
  });

  it("expands magnitude suffixes", () => {
    expect(coerceNumber("1.2M")).toBe(1_200_000);
    expect(coerceNumber("3k")).toBe(3000);
    expect(coerceNumber("2B")).toBe(2_000_000_000);
  });

  it("handles negative currency", () => {
    expect(coerceNumber("-$5")).toBe(-5);
  });

  it("returns null for non-numeric strings and empties", () => {
    expect(coerceNumber("Jan")).toBeNull();
    expect(coerceNumber("")).toBeNull();
    expect(coerceNumber("   ")).toBeNull();
    expect(coerceNumber(null)).toBeNull();
    expect(coerceNumber(undefined)).toBeNull();
  });

  it("rejects non-finite values", () => {
    expect(coerceNumber(Infinity)).toBeNull();
    expect(coerceNumber(NaN)).toBeNull();
  });
});

describe("shapeData", () => {
  it("keeps arrays of objects and coerces numeric strings", () => {
    const { data, origin } = shapeData([{ name: "A", value: "$1,200" }], true);
    expect(origin).toBe("objects");
    expect(data[0].value).toBe(1200);
  });

  it("does not coerce when coerce=false", () => {
    const { data } = shapeData([{ name: "A", value: "$1,200" }], false);
    expect(data[0].value).toBe("$1,200");
  });

  it("wraps primitives", () => {
    const { data, origin } = shapeData([1, 2, 3], true);
    expect(origin).toBe("primitives");
    expect(data).toEqual([
      { name: "Item 1", value: 1 },
      { name: "Item 2", value: 2 },
      { name: "Item 3", value: 3 },
    ]);
  });

  it("keys tuples", () => {
    const { data, origin } = shapeData([["Jan", 100], ["Feb", 150]], true);
    expect(origin).toBe("tuples");
    expect(data[0]).toEqual({ name: "Jan", value: 100 });
  });

  it("transposes columnar objects", () => {
    const { data, origin } = shapeData({ m: ["Jan", "Feb"], v: [1, 2] }, true);
    expect(origin).toBe("columnar");
    expect(data).toEqual([
      { m: "Jan", v: 1 },
      { m: "Feb", v: 2 },
    ]);
  });

  it("reports empty for unusable input", () => {
    expect(shapeData(null, true).origin).toBe("empty");
    expect(shapeData([], true).origin).toBe("empty");
  });
});

describe("field detection", () => {
  it("numericKeys / labelKeys split a row", () => {
    const row = { name: "A", value: 5, ratio: "12%" };
    expect(numericKeys(row, true).sort()).toEqual(["ratio", "value"]);
    expect(labelKeys(row, true)).toEqual(["name"]);
  });
});
