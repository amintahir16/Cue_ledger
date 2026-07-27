"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, StatCard } from "@/components/ui";
import {
  DateFilterControls,
  DateFilterValue,
  defaultDateFilter,
  filterHint,
  filterToQuery,
} from "@/components/date-filter";
import { formatDuration, money } from "@/lib/billing";

type DashboardData = {
  period: string;
  currencySymbol: string;
  clubName: string;
  stats: {
    revenue: number;
    paidRevenue: number;
    tableRevenue: number;
    addonRevenue: number;
    totalExpenses: number;
    actualProfit: number;
    gamesCompleted: number;
    activeGames: number;
    avgTicket: number;
    totalPlayMinutes: number;
    tablesTotal: number;
    tablesOccupied: number;
    tablesAvailable: number;
    pendingPaymentsCount: number;
    pendingPaymentsAmount: number;
    expensesByCategory: Record<string, number>;
  };
  recentSessions: Array<{
    id: string;
    tableName: string;
    customerName: string | null;
    endedAt: string;
    durationSeconds: number | null;
    totalCharge: number;
    paymentStatus: string;
  }>;
  revenueSeries: Array<{ label: string; revenue: number; expenses: number }>;
};

export default function DashboardPage() {
  const [filter, setFilter] = useState<DateFilterValue>(defaultDateFilter("day"));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filterToQuery(filter);
      const params = new URLSearchParams({
        period: q.period,
        date: q.date,
      });
      const res = await fetch(`/api/dashboard?${params}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const sym = data?.currencySymbol || "Rs";
  const s = data?.stats;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Club performance at a glance — revenue, costs, and live floor status."
        actions={
          <DateFilterControls
            value={filter}
            onChange={setFilter}
            idPrefix="dash"
          />
        }
      />
      <p className="mb-4 -mt-3 text-xs text-[var(--color-text)]/55">
        {filterHint(filter)}
      </p>
      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--color-surface-muted)]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="animate-fade-up">
              <StatCard
                label="Revenue"
                value={money(s?.revenue || 0, sym, { whole: true })}
                hint="Completed sessions + extras"
                accent="gold"
              />
            </div>
            <div className="animate-fade-up animate-delay-1">
              <StatCard
                label="Total expenses"
                value={money(s?.totalExpenses || 0, sym, { whole: true })}
                hint="Rent, power, salaries…"
                accent="red"
              />
            </div>
            <div className="animate-fade-up animate-delay-2">
              <StatCard
                label="Actual profit"
                value={money(s?.actualProfit || 0, sym, { whole: true })}
                hint="Revenue − expenses"
                accent="green"
              />
            </div>
            <div className="animate-fade-up animate-delay-3">
              <StatCard
                label="Games completed"
                value={String(s?.gamesCompleted || 0)}
                hint={`${s?.activeGames || 0} live now`}
              />
            </div>
            <StatCard
              label="Table revenue"
              value={money(s?.tableRevenue || 0, sym, { whole: true })}
              hint="Time-based charges only"
              accent="slate"
            />
            <StatCard
              label="F&B / extras"
              value={money(s?.addonRevenue || 0, sym, { whole: true })}
              accent="slate"
            />
            <StatCard
              label="Avg ticket"
              value={money(s?.avgTicket || 0, sym, { whole: true })}
              hint={`${Math.round(s?.totalPlayMinutes || 0)} play minutes`}
              accent="slate"
            />
            <StatCard
              label="Pending payments"
              value={money(s?.pendingPaymentsAmount || 0, sym, { whole: true })}
              hint={`${s?.pendingPaymentsCount || 0} unpaid sessions`}
              accent="gold"
            />
            <StatCard
              label="Tables available"
              value={`${s?.tablesAvailable || 0} / ${s?.tablesTotal || 0}`}
              hint={`${s?.tablesOccupied || 0} occupied`}
            />
            <StatCard
              label="Paid revenue"
              value={money(s?.paidRevenue || 0, sym, { whole: true })}
              hint="Collected cash/transfer"
              accent="green"
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-5">
            <div className="rounded-xl border border-[var(--color-primary)]/10 bg-[var(--color-surface)] p-4 shadow-sm lg:col-span-3">
              <h2 className="mb-4 font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-primary)]">
                Revenue vs expenses
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.revenueSeries || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fecaca" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        Math.round(Number(v)).toLocaleString()
                      }
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        money(Number(value) || 0, sym, { whole: true }),
                        name,
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#DC2626" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#FBBF24" name="Expenses" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-primary)]/10 bg-[var(--color-surface)] p-4 shadow-sm lg:col-span-2">
              <h2 className="mb-4 font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-primary)]">
                Recent sessions
              </h2>
              <ul className="h-64 space-y-3 overflow-y-auto pr-1">
                {(data?.recentSessions || []).length === 0 ? (
                  <li className="text-sm text-[var(--color-text)]/50">No completed games yet.</li>
                ) : (
                  data?.recentSessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 border-b border-[var(--color-primary)]/5 pb-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold">{s.tableName}</p>
                        <p className="text-xs text-[var(--color-text)]/50">
                          {s.customerName || "Walk-in"} ·{" "}
                          {formatDuration((s.durationSeconds || 0) * 1000)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-[family-name:var(--font-heading)] font-bold">
                          {money(s.totalCharge, sym, { whole: true })}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-[var(--color-text)]/45">
                          {s.paymentStatus}
                        </p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
