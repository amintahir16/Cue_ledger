"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Button,
  CardGridSkeleton,
  Input,
  Label,
  PageHeader,
} from "@/components/ui";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  _count: { sessions: number };
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers");
      const json = await res.json();
      setCustomers(json.customers || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const j = await res.json();
      alert(j.error || "Failed");
      return;
    }
    setForm({ name: "", phone: "", email: "", notes: "" });
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Keep regulars on file for faster check-in and loyalty tracking."
      />

      <form
        onSubmit={onSubmit}
        className="mb-8 grid gap-3 rounded-xl border border-[var(--color-primary)]/10 bg-white/90 p-4 shadow-sm md:grid-cols-2"
      >
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
        <div className="md:col-span-2">
          <Button type="submit" variant="secondary">
            Add customer
          </Button>
        </div>
      </form>

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-[var(--color-primary)]/10 bg-white/90 p-4 shadow-sm"
            >
              <p className="font-semibold text-[var(--color-text)]">{c.name}</p>
              <p className="mt-1 text-xs text-[var(--color-text)]/55">
                {c.phone || "No phone"} · {c._count.sessions} sessions
              </p>
              {c.notes ? (
                <p className="mt-2 text-sm text-[var(--color-text)]/70">{c.notes}</p>
              ) : null}
            </div>
          ))}
          {customers.length === 0 ? (
            <p className="text-sm text-[var(--color-text)]/45">No customers yet.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
