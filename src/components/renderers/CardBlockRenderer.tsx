'use client';

import React from 'react';

export function CardBlockRenderer({ title, children }: any) {
  return (
    <div className="my-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-sm">
      {title && (
        <h3 className="font-body text-[15px] font-semibold text-[var(--ink-100)] border-b border-[var(--border-subtle)] pb-2 mb-3">
          {title}
        </h3>
      )}
      <div className="font-body text-[13px] text-[var(--ink-80)] leading-relaxed">
        {children}
      </div>
    </div>
  );
}
