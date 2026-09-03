import { describe, it, expect } from "vitest";
import {
  markdownToPdf,
  markdownToDocx,
  isChartRenderingAvailable,
  ChartRenderingUnavailableError,
} from "../src/index";
import { preprocessContent } from "../src/lib/export/preprocess-content";

const MD = `# Report

Some **bold** text and a [link](https://example.com).

| A | B |
|---|---|
| 1 | 2 |

\`\`\`json-chart
{ "type": "bar", "title": "T", "data": [{ "name": "X", "value": 5 }] }
\`\`\`
`;

describe("markdownToPdf", () => {
  it("returns a valid PDF buffer (options object)", async () => {
    const pdf = await markdownToPdf(MD, { title: "My Report", author: "Tester" });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("accepts a legacy string title", async () => {
    const pdf = await markdownToPdf(MD, "Legacy Title");
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("exports a document with no charts", async () => {
    const pdf = await markdownToPdf("# Just text\n\nNo charts.", { title: "t" });
    expect(pdf.length).toBeGreaterThan(300);
  });
});

describe("markdownToDocx", () => {
  it("returns a valid DOCX (zip) buffer", async () => {
    const docx = await markdownToDocx(MD, { title: "My Report" });
    expect(docx[0]).toBe(0x50); // 'P'
    expect(docx[1]).toBe(0x4b); // 'K'
  });
});

describe("optional canvas", () => {
  it("reports chart rendering availability (canvas installed in dev)", async () => {
    expect(await isChartRenderingAvailable()).toBe(true);
  });

  it("has a helpful unavailable-error message", () => {
    const err = new ChartRenderingUnavailableError();
    expect(err.message).toMatch(/canvas/);
    expect(err.message).toMatch(/npm install/);
  });
});

describe("preprocessContent", () => {
  it("formats messy numbers without printing NaN and escapes pipes", () => {
    const md = `<revenue_attribution title="R" currency="$" totalRevenue="1.2M" totalSpend="450000">
[ { "channel": "Search | Ads", "revenue": "$52,000", "spend": "15000", "roas": 3.4 } ]
</revenue_attribution>`;
    const out = preprocessContent(md);
    expect(out).not.toContain("NaN");
    expect(out).toContain("1,200,000");
    expect(out).toContain("Search \\| Ads");
  });
});
