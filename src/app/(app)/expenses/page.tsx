"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  DateFilterControls,
  DateFilterValue,
  defaultDateFilter,
  filterHint,
  filterToQuery,
} from "@/components/date-filter";
import {
  Button,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  TableSkeleton,
} from "@/components/ui";
import { money, toDateInputValue } from "@/lib/billing";

const CATEGORIES = [
  "ELECTRICITY",
  "RENT",
  "SALARY",
  "MAINTENANCE",
  "SUPPLIES",
  "MARKETING",
  "EQUIPMENT",
  "OTHER",
] as const;

type Expense = {
  id: string;
  category: string;
  title: string;
  amount: number;
  expenseDate: string;
  notes: string | null;
  employeeName: string | null;
};

export default function ExpensesPage() {
  const [filter, setFilter] = useState<DateFilterValue>(
    defaultDateFilter("month"),
  );
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    category: "ELECTRICITY",
    title: "",
    amount: "",
    expenseDate: toDateInputValue(),
    employeeName: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filterToQuery(filter);
      const params = new URLSearchParams({
        date: q.date,
        period: q.period,
      });
      const res = await fetch(`/api/expenses?${params}`);
      const json = await res.json();
      setExpenses(json.expenses || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const entryDate = form.expenseDate;
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.category,
        title: form.title,
        amount: Number(form.amount),
        expenseDate: entryDate,
        employeeName: form.employeeName || undefined,
        notes: form.notes || undefined,
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      alert(j.error || "Failed");
      return;
    }
    setForm((f) => ({
      ...f,
      title: "",
      amount: "",
      employeeName: "",
      notes: "",
    }));
    setFilter((f) => ({ ...f, date: entryDate, scope: f.scope }));
  }

  async function remove(id: string) {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Record rent, electricity, salaries, and other club costs. These reduce Actual Profit on the dashboard."
        actions={
          <DateFilterControls
            value={filter}
            onChange={setFilter}
            idPrefix="expenses"
          />
        }
      />
      <p className="mb-4 -mt-3 text-xs text-[var(--color-text)]/55">
        {filterHint(filter)}
        {loading ? "" : ` · ${expenses.length} expense(s)`}
      </p>

      <div className="mb-6 max-w-xs">
        {loading ? (
          <div className="rounded-xl border border-[var(--color-primary)]/10 border-l-4 border-l-[var(--color-primary)] bg-white/90 p-4 shadow-sm">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-7 w-24" />
          </div>
        ) : (
          <StatCard
            label="Expenses in selected range"
            value={money(total, "Rs", { whole: true })}
            accent="red"
          />
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="mb-8 grid gap-3 rounded-xl border border-[var(--color-primary)]/10 bg-white/90 p-4 shadow-sm md:grid-cols-3"
      >
        <div>
          <Label htmlFor="cat">Category</Label>
          <Select
            id="cat"
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            placeholder="July electricity bill"
          />
        </div>
        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            min={0.01}
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={form.expenseDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, expenseDate: e.target.value }))
            }
            required
          />
        </div>
        <div>
          <Label htmlFor="emp">Employee (for salaries)</Label>
          <Input
            id="emp"
            value={form.employeeName}
            onChange={(e) =>
              setForm((f) => ({ ...f, employeeName: e.target.value }))
            }
            placeholder="Optional"
          />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="md:col-span-3">
          <Button type="submit" variant="secondary">
            Add expense
          </Button>
        </div>
      </form>

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-primary)]/10 bg-white/90 shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--color-primary)]/10 bg-[var(--color-primary)]/5 text-xs uppercase tracking-wide text-[var(--color-text)]/55">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-[var(--color-text)]/45"
                  >
                    No expenses for this range.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--color-primary)]/5"
                  >
                    <td className="px-4 py-3">
                      {new Date(e.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{e.category}</td>
                    <td className="px-4 py-3">
                      {e.title}
                      {e.notes ? (
                        <span className="block text-xs text-[var(--color-text)]/45">
                          {e.notes}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{e.employeeName || "—"}</td>
                    <td className="px-4 py-3 text-right font-[family-name:var(--font-heading)] font-bold">
                      {money(e.amount, "Rs", { whole: true })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="cursor-pointer rounded p-1.5 text-[var(--color-text)]/40 transition-colors hover:bg-red-50 hover:text-red-600"
                        onClick={() => remove(e.id)}
                        aria-label="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
