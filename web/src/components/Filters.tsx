"use client";

import { useState, useMemo, ReactNode } from "react";

export type FilterState = {
  q: string;
  district: string;
  tier: string;
  owner: string;
  action: string;
};

export function FilterBar({
  districts,
  tiers = ["All", "Critical", "High", "Medium", "Watch"],
  owners,
  actions,
  state,
  onChange,
}: {
  districts: string[];
  tiers?: string[];
  owners?: string[];
  actions?: string[];
  state: FilterState;
  onChange: (s: FilterState) => void;
}) {
  const set = (k: keyof FilterState, v: string) => onChange({ ...state, [k]: v });
  return (
    <div className="card p-3 flex flex-wrap items-center gap-2">
      <Select label="Search" >
        <input
          type="text"
          value={state.q}
          placeholder="Student, school, driver…"
          onChange={(e) => set("q", e.target.value)}
          className="bg-transparent outline-none text-[13px] w-48"
        />
      </Select>
      <Select label="District">
        <select
          value={state.district}
          onChange={(e) => set("district", e.target.value)}
          className="bg-transparent outline-none text-[13px] w-40"
        >
          <option value="">All</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Select>
      <Select label="Tier">
        <select
          value={state.tier}
          onChange={(e) => set("tier", e.target.value)}
          className="bg-transparent outline-none text-[13px] w-28"
        >
          {tiers.map((t) => <option key={t} value={t === "All" ? "" : t}>{t}</option>)}
        </select>
      </Select>
      {owners && (
        <Select label="Owner">
          <select
            value={state.owner}
            onChange={(e) => set("owner", e.target.value)}
            className="bg-transparent outline-none text-[13px] w-32"
          >
            <option value="">All</option>
            {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Select>
      )}
      {actions && (
        <Select label="Action">
          <select
            value={state.action}
            onChange={(e) => set("action", e.target.value)}
            className="bg-transparent outline-none text-[13px] w-44"
          >
            <option value="">All</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Select>
      )}
      <button
        onClick={() => onChange({ q: "", district: "", tier: "", owner: "", action: "" })}
        className="text-[12px] text-accent-500 hover:underline ml-auto"
      >
        Reset
      </button>
    </div>
  );
}

function Select({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5">
      <span className="stat-label">{label}</span>
      {children}
    </label>
  );
}

export function useFilterState(initial: Partial<FilterState> = {}) {
  return useState<FilterState>({ q: "", district: "", tier: "", owner: "", action: "", ...initial });
}
