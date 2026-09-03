'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { normalizeChart } from '@/lib/chart-normalizer';
import { toChartJsConfig } from '@/lib/chart-normalizer/adapters/chartjs';
import { mdforgeLabelsPlugin } from '@/lib/chart-normalizer/adapters/datalabels-plugin';

/**
 * Live preview chart renderer.
 *
 * Renders with the exact same pipeline as the PDF/DOCX export:
 *   normalizeChart() -> toChartJsConfig() -> Chart.js
 *
 * The only difference from the export is the surface (an on-screen <canvas>
 * instead of a server node-canvas). Same normalizer, same adapter, same
 * library -> the preview looks identical to the downloaded output. Animations
 * are disabled so it feels instant.
 */

// Chart.js + all controllers/plugins are registered exactly once on the client.
// Cached as a single promise so concurrent chart mounts (the demo has many)
// share one registration pass instead of racing — a race previously left some
// controllers (treemap/matrix/sankey/boxplot) unregistered, so those chart
// types rendered in the exported document but not in the on-screen preview.
let chartPromise: Promise<any> | null = null;

function ensureRegistered(): Promise<any> {
  if (chartPromise) return chartPromise;

  chartPromise = (async () => {
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    Chart.register(mdforgeLabelsPlugin);

    // Optional controllers for advanced chart types. If one fails to load we
    // log it (so it's visible in the console) but keep going — the other chart
    // types still work.
    const optional: [string, () => Promise<unknown[]>][] = [
      ['treemap', async () => {
        const m = await import('chartjs-chart-treemap');
        return [m.TreemapController, m.TreemapElement];
      }],
      ['matrix', async () => {
        const m = await import('chartjs-chart-matrix');
        return [m.MatrixController, m.MatrixElement];
      }],
      ['boxplot', async () => {
        const m = await import('@sgratzl/chartjs-chart-boxplot');
        return [m.BoxPlotController, m.BoxAndWiskers];
      }],
      ['sankey', async () => {
        const m = await import('chartjs-chart-sankey');
        return [m.SankeyController, m.Flow];
      }],
    ];

    await Promise.all(
      optional.map(async ([name, load]) => {
        try {
          const parts = await load();
          Chart.register(...(parts as any[]));
        } catch (e) {
          console.warn(`mdforge preview: could not load "${name}" chart plugin`, e);
        }
      }),
    );

    return Chart;
  })();

  return chartPromise;
}

// Export canvas is 600 x 340; keep the same aspect on screen.
const ASPECT_RATIO = 600 / 340;

export function ChartBlockRenderer({ data: dataString }: { data?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chart = useMemo(() => normalizeChart(dataString || '{}').chart, [dataString]);
  const renderable =
    chart.data.length > 0 || (chart.links?.length ?? 0) > 0 || Boolean(chart.gauge);

  useEffect(() => {
    if (!renderable) return;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const Chart = await ensureRegistered();
        if (cancelled || !canvasRef.current) return;

        const config = toChartJsConfig(chart, {
          scale: 1,
          responsive: true,
          animation: false,
          maintainAspectRatio: true,
          aspectRatio: ASPECT_RATIO,
        });

        chartRef.current?.destroy();
        chartRef.current = new Chart(
          canvasRef.current,
          config as never,
        ) as unknown as { destroy: () => void };
      } catch (e) {
        // A specific chart type failed to draw on screen. Surface it instead of
        // leaving a blank box, and log details for debugging. The export path
        // is unaffected (it renders server-side).
        if (!cancelled) {
          console.error(`mdforge preview: failed to render "${chart.type}" chart`, e);
          setError(chart.type);
        }
      }
    })();

    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [chart, renderable]);

  if (!renderable) return null;

  return (
    <div className="my-3 w-full space-y-2">
      {chart.title && (
        <h4 className="font-body text-[12px] font-semibold text-[var(--ink-80)] tracking-wide">
          {chart.title}
        </h4>
      )}
      <div className="w-full rounded-lg border border-[var(--border-subtle)] bg-white p-3">
        <canvas ref={canvasRef} className={error ? 'hidden' : ''} />
        {error && (
          <div className="flex items-center justify-center py-8 text-[12px] text-[var(--ink-40)] font-body text-center">
            Preview unavailable for “{error}” chart. It will still render in the exported PDF/DOCX.
          </div>
        )}
      </div>
    </div>
  );
}
