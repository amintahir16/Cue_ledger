"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  DateFilterControls,
  DateFilterValue,
  defaultDateFilter,
  filterHint,
  filterToQuery,
} from "@/components/date-filter";
import { Button, Input, Label, PageHeader } from "@/components/ui";
import { money, toDateInputValue } from "@/lib/billing";

type Closing = {
  id: string;
  closingDate: string;
  openingCash: number;
  closingCash: number;
  notes: string | null;
};

type Suggestion = {
  openingCash: number;
  closingCash: number;
  paidRevenue: number;
  lastClosing: { date: string; closingCash: number } | null;
  existing: {
    openingCash: number;
    closingCash: number;
    notes: string | null;
  } | null;
};

export default function ClosingPage() {
  const [filter, setFilter] = useState<DateFilterValue>(
    defaultDateFilter("month"),
  );
  const [closings, setClosings] = useState<Closing[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [closingTouched, setClosingTouched] = useState(false);
  const [form, setForm] = useState({
    closingDate: toDateInputValue(),
    openingCash: "0",
    closingCash: "0",
    notes: "",
  });

  const load = useCallback(async () => {
    const q = filterToQuery(filter);
    const listParams = new URLSearchParams({
      date: q.date,
      period: q.period,
    });
    const entryDate =
      filter.scope === "day" ? filter.date : toDateInputValue();
    const dayParams = new URLSearchParams({
      date: entryDate,
      period: "day",
    });

    const [listRes, dayRes] = await Promise.all([
      fetch(`/api/closing?${listParams}`),
      fetch(`/api/closing?${dayParams}`),
    ]);
    const listJson = await listRes.json();
    const dayJson = await dayRes.json();

    setClosings(listJson.closings || []);
    const s = dayJson.suggestion as Suggestion | undefined;
    setSuggestion(s || null);
    setClosingTouched(false);

    if (s) {
      setForm({
        closingDate: entryDate,
        openingCash: String(s.openingCash),
        closingCash: String(s.existing ? s.closingCash : 0),
        notes: s.existing?.notes || "",
      });
    }
  }, [filter]);

  async function loadSuggestionForDate(entryDate: string) {
    const dayParams = new URLSearchParams({
      date: entryDate,
      period: "day",
    });
    const dayRes = await fetch(`/api/closing?${dayParams}`);
    const dayJson = await dayRes.json();
    const s = dayJson.suggestion as Suggestion | undefined;
    setSuggestion(s || null);
    setClosingTouched(false);
    if (s) {
      setForm({
        closingDate: entryDate,
        openingCash: String(s.openingCash),
        closingCash: String(s.existing ? s.closingCash : 0),
        notes: s.existing?.notes || "",
      });
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  function applyCurrentClosing() {
    if (!suggestion) return;
    const current = Math.round(
      Number(form.openingCash || 0) + suggestion.paidRevenue,
    );
    setForm((f) => ({ ...f, closingCash: String(current) }));
    setClosingTouched(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const closingCash = closingTouched
      ? Number(form.closingCash)
      : Math.round(
          Number(form.openingCash || 0) + (suggestion?.paidRevenue || 0),
        );

    const res = await fetch("/api/closing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        closingDate: form.closingDate,
        openingCash: Number(form.openingCash),
        closingCash,
        notes: form.notes || undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      const j = text ? JSON.parse(text) : {};
      alert(j.error || "Failed");
      return;
    }
    await load();
  }

  const expectedClosing = Math.round(
    Number(form.openingCash || 0) + (suggestion?.paidRevenue || 0),
  );

  return (
    <div>
      <PageHeader
        title="Daily closing"
        description="Opening starts from the last close. Click Closing cash to fill today's expected drawer amount."
        actions={
          <DateFilterControls
            value={filter}
            onChange={setFilter}
            idPrefix="closing"
          />
        }
      />
      <p className="mb-4 -mt-3 text-xs text-[var(--color-text)]/55">
        {filterHint(filter)} · {closings.length} closing record(s)
      </p>

      <form
        onSubmit={onSubmit}
        className="mb-8 grid gap-3 rounded-xl border border-[var(--color-primary)]/10 bg-white/90 p-4 shadow-sm md:grid-cols-2"
      >
        <div>
          <Label htmlFor="entry-date">Entry date</Label>
          <Input
            id="entry-date"
            type="date"
            value={form.closingDate}
            onChange={(e) => {
              const d = e.target.value;
              setForm((f) => ({ ...f, closingDate: d }));
              if (filter.scope === "day") {
                setFilter({ date: d, scope: "day" });
              } else {
                void loadSuggestionForDate(d);
              }
            }}
            required
          />
          <p className="mt-1 text-xs text-[var(--color-text)]/50">
            Cash suggestions use this day. Year / Month / Day above filters
            history.
          </p>
        </div>
        <div>
          <Label htmlFor="open">Opening cash</Label>
          <Input
            id="open"
            type="number"
            min={0}
            step="1"
            value={form.openingCash}
            onChange={(e) =>
              setForm((f) => ({ ...f, openingCash: e.target.value }))
            }
            required
          />
          <p className="mt-1 text-xs text-[var(--color-text)]/50">
            {suggestion?.lastClosing
              ? `Auto from last close (${new Date(
                  suggestion.lastClosing.date,
                ).toLocaleDateString()}): ${money(
                  suggestion.lastClosing.closingCash,
                  "Rs",
                  { whole: true },
                )}`
              : "No previous closing yet — starts at 0"}
          </p>
        </div>
        <div>
          <Label htmlFor="close">Closing cash</Label>
          <Input
            id="close"
            type="number"
            min={0}
            step="1"
            value={form.closingCash}
            onFocus={applyCurrentClosing}
            onClick={applyCurrentClosing}
            onChange={(e) => {
              setClosingTouched(true);
              setForm((f) => ({ ...f, closingCash: e.target.value }));
            }}
            required
          />
          <p className="mt-1 text-xs text-[var(--color-text)]/50">
            Click to use current: opening + paid that day (
            {money(suggestion?.paidRevenue || 0, "Rs", { whole: true })}) ={" "}
            {money(expectedClosing, "Rs", { whole: true })}
          </p>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" variant="secondary">
            Save closing
          </Button>
          <Button type="button" variant="ghost" onClick={applyCurrentClosing}>
            Fill current closing
          </Button>
        </div>
      </form>

      <h2 className="mb-3 font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-primary)]">
        Closing history
      </h2>
      <div className="space-y-3">
        {closings.length === 0 ? (
          <p className="text-sm text-[var(--color-text)]/45">
            No closing records for this range.
          </p>
        ) : (
          closings.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-[var(--color-primary)]/10 bg-white/90 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {new Date(c.closingDate).toLocaleDateString()}
                </p>
                <p className="text-sm">
                  Open {money(c.openingCash, "Rs", { whole: true })} → Close{" "}
                  {money(c.closingCash, "Rs", { whole: true })}
                </p>
              </div>
              {c.notes ? (
                <p className="mt-2 text-sm text-[var(--color-text)]/60">
                  {c.notes}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
