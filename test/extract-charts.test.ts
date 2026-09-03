import { describe, it, expect } from "vitest";
import { extractAndRenderCharts } from "../src/lib/export/extract-charts";

describe("extractAndRenderCharts", () => {
  it("leaves plain ```json documentation untouched (no over-capture)", async () => {
    const md = 'Intro\n\n```json\n{ "type": "object", "properties": { "a": 1 } }\n```\n\nOutro';
    const { cleanMarkdown, charts } = await extractAndRenderCharts(md);
    expect(charts.size).toBe(0);
    expect(cleanMarkdown).toContain('"properties"');
  });

  it("treats a json-chart fence as a chart and inserts a placeholder", async () => {
    const md = '```json-chart\n{ "type": "bar", "data": [{ "name": "A", "value": 5 }] }\n```';
    const { cleanMarkdown, charts } = await extractAndRenderCharts(md);
    expect(charts.size).toBe(1);
    expect(cleanMarkdown).toMatch(/\[CHART:chart0\]/);
  });

  it("picks up a plain ```json block only when it has a real chart type + data", async () => {
    const md = '```json\n{ "type": "pie", "data": [{ "name": "A", "value": 1 }] }\n```';
    const { charts } = await extractAndRenderCharts(md);
    expect(charts.size).toBe(1);
  });

  it("drops a chart that renders to nothing instead of leaking raw JSON", async () => {
    const md = 'before\n\n<chart>{ "type": "bar", "data": [] }</chart>\n\nafter';
    const { cleanMarkdown, charts } = await extractAndRenderCharts(md);
    expect(charts.size).toBe(0);
    expect(cleanMarkdown).not.toContain("<chart>");
    expect(cleanMarkdown).not.toContain('"type"');
  });

  it("handles two identical chart blocks as distinct placeholders", async () => {
    const block = '```json-chart\n{ "type": "bar", "data": [{ "name": "A", "value": 1 }] }\n```';
    const { cleanMarkdown, charts } = await extractAndRenderCharts(`${block}\n\n${block}`);
    expect(charts.size).toBe(2);
    expect(cleanMarkdown).toMatch(/\[CHART:chart0\]/);
    expect(cleanMarkdown).toMatch(/\[CHART:chart1\]/);
  });

  it("preserves a broken plain ```json block as documentation", async () => {
    const md = "```json\n{ not valid json }\n```";
    const { cleanMarkdown } = await extractAndRenderCharts(md);
    expect(cleanMarkdown).toContain("not valid json");
  });
});
