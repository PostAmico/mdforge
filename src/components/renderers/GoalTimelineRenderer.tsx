'use client';

import React from 'react';
import { CheckCircle, CircleNotch, Circle, XCircle } from '@phosphor-icons/react';
import { cn } from '@/utils/cn';
import { motion } from 'framer-motion';

export interface GoalTask {
  title: string;
  status: 'queued' | 'in-progress' | 'completed' | 'failed';
  agentType?: string;
}

export function GoalTimelineRenderer({ title, status, progress, data }: { title?: string, status?: string, progress?: string, data?: string }) {
  let list: GoalTask[] = [];
  try {
    list = JSON.parse(data || '[]');
  } catch {
    list = [];
  }

  if (list.length === 0) return null;

  const progressPct = parseInt(progress || '0', 10);

  return (
    <div className="border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] rounded-[var(--radius-md)] p-4 my-3 space-y-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
        <h4 className="font-body text-[var(--text-body-sm)] font-semibold text-[var(--ink-80)]">
          {title || 'Goal Execution'}
        </h4>
        <span className="font-data text-[10px] text-[var(--ink-40)] capitalize">
          {status} · {progressPct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-[var(--bg-surface-3)] overflow-hidden">
        <motion.div
          className="h-full bg-[var(--accent)] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>

      {/* Timeline steps */}
      <div className="space-y-0 relative pl-2 pt-1">
        {list.map((step: GoalTask, idx: number) => {
          const isCompleted = step.status === 'completed';
          const isActive = step.status === 'in-progress';
          const isFailed = step.status === 'failed';

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.08, ease: [0.4, 0, 0.2, 1] }}
              className="flex gap-3.5 relative py-2"
            >
              {idx < list.length - 1 && (
                <div
                  className={cn(
                    'absolute left-[11px] top-[28px] bottom-0 w-px transition-colors duration-500',
                    isCompleted ? 'bg-[var(--success)]' : 'bg-[var(--border-subtle)]'
                  )}
                />
              )}

              <div className="relative z-10 flex items-center justify-center w-[22px] h-[22px] shrink-0 mt-0.5">
                {isCompleted ? (
                  <CheckCircle size={18} className="text-[var(--success)]" weight="fill" />
                ) : isFailed ? (
                  <XCircle size={18} className="text-[var(--error)]" weight="fill" />
                ) : isActive ? (
                  <div className="relative">
                    <CircleNotch size={18} className="text-[var(--accent)] animate-spin" />
                  </div>
                ) : (
                  <Circle size={16} className="text-[var(--ink-20)]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p
                    className={cn(
                      'font-body text-[var(--text-body-sm)]',
                      isCompleted ? 'text-[var(--ink-60)]' : isActive ? 'text-[var(--ink-100)] font-semibold' : 'text-[var(--ink-80)] font-medium'
                    )}
                  >
                    {step.title}
                  </p>
                  {step.agentType && (
                    <span className="font-data text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface-3)] text-[var(--ink-60)] shrink-0">
                      {step.agentType}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
