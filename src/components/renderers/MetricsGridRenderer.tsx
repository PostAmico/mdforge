'use client';

import React, { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { TrendUp, TrendDown } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

interface MetricItem {
  label: string;
  value: string | number;
  change?: string;
  positive?: boolean;
  prefix?: string;
  suffix?: string;
}

export function MetricsGridRenderer({ title, period, data }: { title?: string, period?: string, data?: string }) {
  // Parse metrics from content
  const metrics: MetricItem[] = useMemo(() => {
    try {
      return JSON.parse(data || '[]');
    } catch {
      return [];
    }
  }, [data]);

  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="my-3 space-y-3">
      {/* Optional Header */}
      {(title || period) && (
        <div className="flex items-baseline justify-between gap-4 px-1">
          {title && (
            <h4 className="font-body text-[var(--text-body-sm)] font-semibold text-[var(--ink-100)] tracking-tight">
              {title}
            </h4>
          )}
          {period && (
            <span className="font-data text-[10px] text-[var(--ink-40)] uppercase tracking-widest shrink-0">
              {period}
            </span>
          )}
        </div>
      )}

      {/* Grid Layout (auto-fits based on count) */}
      <div
        className={cn(
          'grid gap-3',
          metrics.length === 1 ? 'grid-cols-1' :
          metrics.length === 2 ? 'grid-cols-2' :
          metrics.length === 3 ? 'grid-cols-3' :
          metrics.length === 4 ? 'grid-cols-2 lg:grid-cols-4' :
          'grid-cols-2 lg:grid-cols-3'
        )}
      >
        {metrics.map((metric, idx) => {
          const hasChange = metric.change !== undefined && metric.change !== null;
          const isPositive = metric.positive ?? true;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05, ease: [0.4, 0, 0.2, 1] }}
              className="bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-4 flex flex-col justify-between overflow-hidden relative group hover:bg-[var(--bg-surface)] transition-colors"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="font-body text-[var(--text-caption)] text-[var(--ink-60)] font-medium truncate">
                  {metric.label}
                </span>

                {hasChange && (
                  <div
                    className={cn(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-sm)] font-data text-[10px] font-semibold shrink-0 transition-colors',
                      isPositive
                        ? 'text-[var(--success)] bg-[var(--success-subtle)]'
                        : 'text-[var(--error)] bg-[var(--error-subtle)]'
                    )}
                  >
                    {isPositive ? <TrendUp size={10} weight="bold" /> : <TrendDown size={10} weight="bold" />}
                    {metric.change}
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-baseline gap-0.5">
                {metric.prefix && (
                  <span className="font-data text-[var(--text-body-sm)] text-[var(--ink-40)] font-medium relative top-[-1px]">
                    {metric.prefix}
                  </span>
                )}
                <span className="font-data text-2xl font-bold text-[var(--ink-100)] tracking-tight">
                  {metric.value}
                </span>
                {metric.suffix && (
                  <span className="font-data text-[var(--text-caption)] text-[var(--ink-40)] font-medium">
                    {metric.suffix}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
