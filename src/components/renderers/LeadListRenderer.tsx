'use client';

import React, { useMemo } from 'react';
import { cn } from '@/utils/cn';

interface Lead {
  name?: string;
  email?: string;
  source?: string;
  status?: string;
  score?: number | string;
}

export function LeadListRenderer({ title, data }: { title?: string, data?: string }) {
  const leads: Lead[] = useMemo(() => {
    try {
      return JSON.parse(data || '[]');
    } catch {
      return [];
    }
  }, [data]);

  if (!leads || leads.length === 0) return null;

  return (
    <div className="my-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
      <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-2)]">
        <h4 className="font-body text-[13px] font-semibold text-[var(--ink-100)]">{title || 'Leads'}</h4>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {leads.map((lead, idx) => (
          <div key={idx} className="p-3 hover:bg-[var(--bg-surface-2)] transition-colors flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-body text-[13px] font-medium text-[var(--ink-100)] truncate">{lead.name || 'Unknown'}</p>
              <div className="flex items-center gap-2 mt-0.5 font-body text-[11px] text-[var(--ink-60)]">
                {lead.email && <span className="truncate">{lead.email}</span>}
                {lead.source && (
                  <>
                    <span>·</span>
                    <span>{lead.source}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {lead.status && (
                <span className={cn(
                  "font-data text-[10px] px-2 py-0.5 rounded-full capitalize",
                  lead.status.toLowerCase() === 'hot' ? 'bg-[var(--error-subtle)] text-[var(--error)]' :
                  lead.status.toLowerCase() === 'warm' ? 'bg-[var(--warning-subtle)] text-[var(--warning)]' :
                  'bg-[var(--bg-surface-3)] text-[var(--ink-80)]'
                )}>
                  {lead.status}
                </span>
              )}
              {lead.score && (
                <div className="flex flex-col items-end">
                  <span className="font-data text-[12px] font-bold text-[var(--ink-100)]">{lead.score}</span>
                  <span className="font-data text-[9px] text-[var(--ink-40)] uppercase">Score</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
