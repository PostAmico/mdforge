'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Circle } from '@phosphor-icons/react';

export function ProgressRenderer({ percentage, statusText, status, data }: any) {
  const pct = parseInt(percentage || '0', 10);
  const label = statusText || status || (pct >= 100 ? 'Completed' : 'In Progress');

  const steps = useMemo(() => {
    try {
      return JSON.parse(data || '[]');
    } catch {
      return [];
    }
  }, [data]);

  return (
    <div className="my-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-body text-[13px] font-semibold text-[var(--ink-100)]">{label}</h4>
        <span className="font-data text-[12px] font-bold text-[var(--accent)]">{pct}%</span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface-2)] overflow-hidden">
        <motion.div
          className="h-full bg-[var(--accent)] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>

      {steps.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)] mt-3">
          {steps.map((step: any, idx: number) => (
            <div key={idx} className="flex items-start gap-2">
              {step.done ? (
                <CheckCircle size={14} className="text-[var(--success)] mt-0.5 shrink-0" weight="fill" />
              ) : (
                <Circle size={14} className="text-[var(--ink-40)] mt-0.5 shrink-0" />
              )}
              <span className={`font-body text-[12px] ${step.done ? 'text-[var(--ink-80)] line-through' : 'text-[var(--ink-100)]'}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
