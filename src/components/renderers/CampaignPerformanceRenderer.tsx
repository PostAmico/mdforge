'use client';

import React from 'react';
import { TrendUp, Megaphone } from '@phosphor-icons/react';

export function CampaignPerformanceRenderer({
  name, platform, status, spend, budget, cpa, roas, impressions, clicks, currency, healthScore
}: any) {
  const payload = {
    name: name || 'Campaign Performance',
    platform: platform || 'meta_ads',
    status: status || 'active',
    spend: Number(spend || 0),
    budget: Number(budget || 0),
    cpa: cpa ? Number(cpa) : undefined,
    roas: roas ? Number(roas) : undefined,
    impressions: impressions ? Number(impressions) : undefined,
    clicks: clicks ? Number(clicks) : undefined,
    healthScore: healthScore ? Number(healthScore) : 85,
    currency: currency || '₹',
  };

  const budgetPct = payload.budget > 0 ? Math.min(100, Math.round((payload.spend / payload.budget) * 100)) : 0;

  return (
    <div className="my-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent)]">
            <Megaphone size={16} weight="duotone" />
          </div>
          <div>
            <h4 className="font-body text-[13px] font-semibold text-[var(--ink-100)]">{payload.name}</h4>
            <p className="font-body text-[11px] text-[var(--ink-40)] capitalize">
              {payload.platform.replace('_', ' ')} · <span className="text-[var(--success)]">{payload.status}</span>
            </p>
          </div>
        </div>
        {payload.healthScore !== undefined && (
          <span className="font-data text-[12px] font-bold px-2 py-0.5 rounded bg-[var(--success-subtle)] text-[var(--success)]">
            {payload.healthScore} Score
          </span>
        )}
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="space-y-0.5">
          <p className="font-body text-[11px] text-[var(--ink-40)]">Total Spend</p>
          <p className="font-data text-[14px] font-semibold text-[var(--ink-100)]">
            {payload.currency}{payload.spend.toLocaleString()}
          </p>
        </div>

        {payload.cpa !== undefined && (
          <div className="space-y-0.5">
            <p className="font-body text-[11px] text-[var(--ink-40)]">Cost per Lead (CPA)</p>
            <p className="font-data text-[14px] font-semibold text-[var(--ink-100)]">
              {payload.currency}{payload.cpa.toFixed(1)}
            </p>
          </div>
        )}

        {payload.roas !== undefined && (
          <div className="space-y-0.5">
            <p className="font-body text-[11px] text-[var(--ink-40)]">ROAS</p>
            <p className="font-data text-[14px] font-semibold text-[var(--success)] flex items-center gap-1">
              <TrendUp size={12} /> {payload.roas.toFixed(2)}x
            </p>
          </div>
        )}

        {payload.clicks !== undefined && (
          <div className="space-y-0.5">
            <p className="font-body text-[11px] text-[var(--ink-40)]">Clicks</p>
            <p className="font-data text-[14px] font-semibold text-[var(--ink-100)]">
              {payload.clicks.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Budget Progress Bar */}
      <div className="space-y-1 pt-1">
        <div className="flex justify-between font-body text-[11px] text-[var(--ink-60)]">
          <span>Budget Pacing</span>
          <span className="font-data">{budgetPct}% of {payload.currency}{payload.budget.toLocaleString()}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface-2)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
