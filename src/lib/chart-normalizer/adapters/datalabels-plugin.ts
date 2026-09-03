/**
 * mdforge inline value-label plugin for Chart.js.
 *
 * A small, self-contained Chart.js plugin that draws value labels on data
 * points. It reads its config from `options.plugins.mdforgeLabels` (emitted by
 * the Chart.js adapter) and positions each label from the element's OWN center
 * (`tooltipPosition()` / `getCenterPoint()`), which is stable in both headless
 * (node-canvas) and browser rendering.
 *
 * This replaces `chartjs-plugin-datalabels`, which threw a null-origin error on
 * some arc geometries when rendering headlessly. No external dependency.
 *
 * Register it once with `Chart.register(mdforgeLabelsPlugin)`.
 */

import { formatLabelNumber } from "./chartjs";

/** Coerce a Chart.js datum (number, {x,y}, {v}, [lo,hi] float bar) to a number. */
function numify(d: unknown): number {
  if (typeof d === "number") return d;
  if (Array.isArray(d)) return Number(d[1]) - Number(d[0]);
  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;
    if (o.v !== undefined) return Number(o.v);
    if (o.y !== undefined) return Number(o.y);
  }
  const n = Number(d);
  return Number.isFinite(n) ? n : 0;
}

export const mdforgeLabelsPlugin = {
  id: "mdforgeLabels",
  afterDatasetsDraw(chart: any) {
    const cfg = chart?.options?.plugins?.mdforgeLabels;
    if (!cfg || cfg.display === false) return;

    const ctx = chart.ctx;
    const placement: string = cfg.placement ?? "outsideTop";
    const fontSize: number = cfg.fontSize ?? 12;
    const color: string = cfg.color ?? "#444";

    ctx.save();
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = placement === "inside" ? "middle" : "bottom";

    chart.data.datasets.forEach((dataset: any, di: number) => {
      const meta = chart.getDatasetMeta(di);
      if (!meta || meta.hidden) return;

      const total = cfg.showPercent
        ? (dataset.data ?? []).reduce((a: number, d: any) => a + Math.abs(numify(d)), 0)
        : 0;

      meta.data.forEach((element: any, i: number) => {
        if (!element) return;
        const n = numify(dataset.data[i]);
        if (!Number.isFinite(n) || n === 0) return; // hide empty/zero

        let pos: { x: number; y: number } | null = null;
        try {
          pos =
            typeof element.tooltipPosition === "function"
              ? element.tooltipPosition()
              : typeof element.getCenterPoint === "function"
                ? element.getCenterPoint()
                : { x: element.x, y: element.y };
        } catch {
          pos = null;
        }
        if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;

        const valueText = formatLabelNumber(n);

        if (cfg.showPercent && total > 0) {
          const pct = `${Math.round((Math.abs(n) / total) * 100)}%`;
          const lineH = fontSize * 1.15;
          ctx.fillText(valueText, pos.x, pos.y - lineH / 2);
          ctx.fillText(pct, pos.x, pos.y + lineH / 2);
        } else {
          const y = placement === "outsideTop" ? pos.y - fontSize * 0.4 : pos.y;
          ctx.fillText(valueText, pos.x, y);
        }
      });
    });

    ctx.restore();
  },
};
