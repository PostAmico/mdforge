'use client';

import React, { useMemo } from 'react';
import { cn } from '@/utils/cn';

interface Channel {
  channel: string;
  revenue: number;
  spend: number;
  roas: number;
}

export function RevenueAttributionRenderer({ title, currency, totalRevenue, totalSpend, totalRoas, data }: any) {
  const channels: Channel[] = useMemo(() => {
    try {
      return JSON.parse(data || '[]');
    } catch {
      return [];
    }
  }, [data]);

  const curr = currency || '₹';

  return (
    <div className="my-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-2)]">
        <h4 className="font-body text-[13px] font-semibold text-[var(--ink-100)] mb-3">
          {title || 'Revenue Attribution'}
        </h4>
        
        <div className="flex gap-4 sm:gap-8">
          <div className="space-y-0.5">
            <span className="font-body text-[10px] text-[var(--ink-60)] uppercase tracking-wider">Total Revenue</span>
            <p className="font-data text-[16px] font-bold text-[var(--ink-100)]">{curr}{Number(totalRevenue || 0).toLocaleString()}</p>
          </div>
          <div className="space-y-0.5">
            <span className="font-body text-[10px] text-[var(--ink-60)] uppercase tracking-wider">Total Spend</span>
            <p className="font-data text-[16px] font-semibold text-[var(--ink-80)]">{curr}{Number(totalSpend || 0).toLocaleString()}</p>
          </div>
          {totalRoas && (
            <div className="space-y-0.5">
              <span className="font-body text-[10px] text-[var(--ink-60)] uppercase tracking-wider">ROAS</span>
              <p className="font-data text-[16px] font-semibold text-[var(--success)]">{totalRoas}x</p>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {channels.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <th className="font-body text-[11px] font-medium text-[var(--ink-60)] p-3">Channel</th>
                <th className="font-body text-[11px] font-medium text-[var(--ink-60)] p-3 text-right">Revenue</th>
                <th className="font-body text-[11px] font-medium text-[var(--ink-60)] p-3 text-right">Spend</th>
                <th className="font-body text-[11px] font-medium text-[var(--ink-60)] p-3 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {channels.map((ch, idx) => (
                <tr key={idx} className="hover:bg-[var(--bg-surface-2)] transition-colors">
                  <td className="font-body text-[12px] font-medium text-[var(--ink-100)] p-3">{ch.channel}</td>
                  <td className="font-data text-[12px] text-[var(--ink-100)] p-3 text-right">{curr}{Number(ch.revenue || 0).toLocaleString()}</td>
                  <td className="font-data text-[12px] text-[var(--ink-80)] p-3 text-right">{curr}{Number(ch.spend || 0).toLocaleString()}</td>
                  <td className={cn("font-data text-[12px] font-semibold p-3 text-right", (ch.roas || 0) >= 2 ? "text-[var(--success)]" : "text-[var(--warning)]")}>
                    {ch.roas}x
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
