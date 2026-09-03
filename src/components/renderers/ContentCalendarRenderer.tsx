'use client';

import React, { useMemo } from 'react';

interface ContentItem {
  date?: string;
  time?: string;
  title?: string;
  platform?: string;
  status?: string;
}

export function ContentCalendarRenderer({ title, period, data }: { title?: string, period?: string, data?: string }) {
  const items: ContentItem[] = useMemo(() => {
    try {
      return JSON.parse(data || '[]');
    } catch {
      return [];
    }
  }, [data]);

  if (!items || items.length === 0) return null;

  return (
    <div className="my-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Header */}
      {(title || period) && (
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-2)]">
          {title && <h4 className="font-body text-[13px] font-semibold text-[var(--ink-100)]">{title}</h4>}
          {period && <span className="font-data text-[10px] text-[var(--ink-40)] uppercase">{period}</span>}
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {items.map((item, idx) => (
          <div key={idx} className="p-3 hover:bg-[var(--bg-surface-2)] transition-colors flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-body text-[13px] font-medium text-[var(--ink-100)] truncate">{item.title}</p>
              <div className="flex items-center gap-2 mt-0.5 font-body text-[11px] text-[var(--ink-60)]">
                {item.platform && <span className="capitalize">{item.platform}</span>}
                {(item.date || item.time) && (
                  <>
                    <span>·</span>
                    <span>{item.date} {item.time}</span>
                  </>
                )}
              </div>
            </div>
            {item.status && (
              <span className="font-data text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-surface-3)] text-[var(--ink-80)] shrink-0">
                {item.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
