"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DateFilterControls,
  DateFilterValue,
  defaultDateFilter,
  filterHint,
  filterToQuery,
} from "@/components/date-filter";
import { Button, PageHeader, TableSkeleton } from "@/components/ui";
import { formatDuration, money } from "@/lib/billing";

type AddonRow = {
  id: string;
  name: string;
  quantity: number;
  lineTotal: number;
};

type SessionRow = {
  id: string;
  status: string;
  customerName: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  tableCharge: number | null;
  addonsTotal: number | null;
  totalCharge: number | null;
  paymentStatus: string;
  table: { name: string };
  addons: AddonRow[];
};

export default function SessionsPage() {
  const [filter, setFilter] = useState<DateFilterValue>(defaultDateFilter("day"));
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filterToQuery(filter);
      const params = new URLSearchParams({
        limit: "200",
        period: q.period,
        date: q.date,
      });
      const res = await fetch(`/api/sessions?${params}`);
      const json = await res.json();
      setSessions(json.sessions || []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function markPaid(id: string) {
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "PAID" }),
    });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Session history"
        description="Past games with table charge, extras, and total. Mark pending bills as paid when cash is collected."
        actions={
          <DateFilterControls
            value={filter}
            onChange={setFilter}
            idPrefix="history"
          />
        }
      />
      <p className="mb-4 -mt-3 text-xs text-[var(--color-text)]/55">
        {filterHint(filter)}
        {loading ? "" : ` · ${sessions.length} session(s)`}
      </p>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-primary)]/10 bg-white/90 shadow-sm">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-[var(--color-primary)]/10 bg-[var(--color-primary)]/5 text-xs uppercase tracking-wide text-[var(--color-text)]/55">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Table charge</th>
                <th className="px-4 py-3">Extras</th>
                <th className="px-4 py-3 text-right">Extras amount</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Payment</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-[var(--color-text)]/45"
                  >
                    No sessions for this date filter.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const extras = s.addons || [];
                  const extrasAmount = s.addonsTotal ?? 0;
                  const tableCharge = s.tableCharge ?? 0;
                  const total = s.totalCharge ?? tableCharge + extrasAmount;

                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--color-primary)]/5 align-top"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(s.startedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold">{s.table.name}</td>
                      <td className="px-4 py-3">{s.customerName || "Walk-in"}</td>
                      <td className="px-4 py-3 font-[family-name:var(--font-heading)]">
                        {formatDuration((s.durationSeconds || 0) * 1000)}
                      </td>
                      <td className="px-4 py-3 text-xs uppercase tracking-wide">
                        {s.status}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {money(tableCharge, "Rs", { whole: true })}
                      </td>
                      <td className="px-4 py-3">
                        {extras.length === 0 ? (
                          <span className="text-[var(--color-text)]/40">—</span>
                        ) : (
                          <ul className="space-y-0.5 text-xs text-[var(--color-text)]/75">
                            {extras.map((a) => (
                              <li key={a.id}>
                                {a.quantity}× {a.name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {extras.length === 0 ? (
                          <span className="text-[var(--color-text)]/40">
                            {money(0, "Rs", { whole: true })}
                          </span>
                        ) : (
                          <div>
                            <p className="font-semibold">
                              {money(extrasAmount, "Rs", { whole: true })}
                            </p>
                            <ul className="mt-1 space-y-0.5 text-xs text-[var(--color-text)]/55">
                              {extras.map((a) => (
                                <li key={a.id}>
                                  {money(a.lineTotal, "Rs", { whole: true })}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-heading)] font-bold tabular-nums">
                        {money(total, "Rs", { whole: true })}
                      </td>
                      <td className="px-4 py-3">
                        {s.paymentStatus === "PENDING" &&
                        s.status === "COMPLETED" ? (
                          <Button
                            variant="success"
                            className="!px-2 !py-1 text-xs"
                            onClick={() => markPaid(s.id)}
                          >
                            Mark paid
                          </Button>
                        ) : (
                          <span className="text-xs uppercase tracking-wide text-[var(--color-text)]/50">
                            {s.paymentStatus}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
