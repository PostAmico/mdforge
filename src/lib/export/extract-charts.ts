/**
 * Shared chart extraction for the PDF and DOCX pipelines.
 *
 * Finds chart blocks in markdown, renders each to a PNG, and replaces the block
 * with a `[CHART:<id>]` placeholder that the renderers turn into an image.
 *
 * Design decisions (fixing prior bugs):
 *  - A block is ALWAYS removed from the markdown once matched, even if rendering
 *    fails (e.g. the optional `canvas` dependency is missing). We never leave
 *    raw chart JSON to leak into the exported document as literal text.
 *  - Replacement is positional (rebuild the string as we scan), so two identical
 *    chart blocks can't collide the way `String.replace(substring)` would.
 *  - Fenced ```json blocks are treated as charts ONLY when they carry an
 *    explicit chart signal (`type` / `chartType` / `_chartVariant`). Plain
 *    ```json documentation is left untouched. `json-chart` and `chart` fences
 *    are always treated as charts.
 */

import { renderChartToPng } from "./chart-renderer";
import { resolveType } from "../chart-normalizer";

export interface ExtractedCharts {
  cleanMarkdown: string;
  charts: Map<string, Buffer>;
}

/**
 * Does this parsed JSON look like a chart config? Used only to decide whether a
 * plain ```json block (not the dedicated chart fences) should be rendered as a
 * chart. We require a chart-specific field OR a `type` that resolves to a known
 * chart type — so ordinary documentation like `{ "type": "object" }` is left
 * alone, while `{ "type": "bar", ... }` is picked up.
 */
function looksLikeChart(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null) return false;
  const o = parsed as Record<string, unknown>;

  // Chart-specific fields are a strong signal on their own.
  if ("chartType" in o || "_chartVariant" in o) return true;

  // Otherwise `type` must resolve to an actual chart type (not "object", etc.),
  // and there must be some data/links to plot.
  if ("type" in o && resolveType(o.type).type !== null) {
    return "data" in o || "links" in o || "series" in o || "value" in o;
  }
  return false;
}

interface Region {
  start: number;
  end: number;
  json: string;
  /** When true (json-chart / chart / <chart>), always render as a chart. */
  forced: boolean;
}

/** Collect all candidate chart regions (tag form + fenced form), in order. */
function findRegions(content: string): Region[] {
  const regions: Region[] = [];

  // <chart ...>...</chart>
  const tagRe = /<chart[^>]*>([\s\S]*?)<\/chart>/g;
  for (let m = tagRe.exec(content); m; m = tagRe.exec(content)) {
    regions.push({ start: m.index, end: m.index + m[0].length, json: (m[1] || "").trim(), forced: true });
  }

  // ```json-chart | ```chart | ```json  (language tag, optional space, then body)
  const fenceRe = /```(json-chart|chart|json)[ \t]*\r?\n([\s\S]*?)```/g;
  for (let m = fenceRe.exec(content); m; m = fenceRe.exec(content)) {
    const lang = m[1];
    regions.push({
      start: m.index,
      end: m.index + m[0].length,
      json: (m[2] || "").trim(),
      // Plain ```json is only a chart if the JSON signals it; the dedicated
      // chart fences are always charts.
      forced: lang !== "json",
    });
  }

  // Sort by position and drop overlaps (a tag region and a fence region cannot
  // overlap in practice, but guard anyway).
  regions.sort((a, b) => a.start - b.start);
  const out: Region[] = [];
  let lastEnd = -1;
  for (const r of regions) {
    if (r.start >= lastEnd) {
      out.push(r);
      lastEnd = r.end;
    }
  }
  return out;
}

export interface ExtractChartsOptions {
  /** When true, throw if a chart is requested but `canvas` isn't installed. */
  strictCharts?: boolean;
}

/**
 * Extract and render all chart blocks. Returns markdown with each chart block
 * replaced by a `[CHART:id]` placeholder (or removed if it wasn't a chart /
 * failed to render), plus the rendered PNGs keyed by id.
 */
export async function extractAndRenderCharts(
  content: string,
  options: ExtractChartsOptions = {},
): Promise<ExtractedCharts> {
  const charts = new Map<string, Buffer>();
  const regions = findRegions(content);
  if (regions.length === 0) return { cleanMarkdown: content, charts };

  let result = "";
  let cursor = 0;
  let chartIndex = 0;

  for (const region of regions) {
    // Emit untouched text before this region.
    result += content.slice(cursor, region.start);
    cursor = region.end;

    let parsed: unknown;
    try {
      parsed = JSON.parse(region.json);
    } catch {
      // Not valid JSON. For a plain ```json block, keep it as-is (it's real
      // documentation). For forced chart blocks, drop the broken block.
      if (!region.forced) {
        result += content.slice(region.start, region.end);
      }
      continue;
    }

    // Plain ```json that isn't a chart: leave the original block intact.
    if (!region.forced && !looksLikeChart(parsed)) {
      result += content.slice(region.start, region.end);
      continue;
    }

    // It's a chart. Render it; on success insert a placeholder, on failure
    // (e.g. canvas missing) drop the block so raw JSON never leaks out.
    const png = await renderChartToPng(parsed, { strict: options.strictCharts });
    if (png) {
      const id = `chart${chartIndex++}`;
      charts.set(id, png);
      result += `\n\n[CHART:${id}]\n\n`;
    }
    // else: block is dropped (already advanced past it).
  }

  // Emit any trailing text after the last region.
  result += content.slice(cursor);

  return { cleanMarkdown: result, charts };
}
