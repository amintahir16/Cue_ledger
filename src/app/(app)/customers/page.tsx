"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
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

const emptyForm = { name: "", phone: "", email: "", notes: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

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

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEditForm(customer: Customer) {
    setEditingId(customer.id);
    setForm({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || "",
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      notes: form.notes || null,
    };

    const res = await fetch(
      editingId ? `/api/customers/${editingId}` : "/api/customers",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error || (editingId ? "Could not update customer" : "Could not add customer"));
      return;
    }
    closeForm();
    await load();
  }

  async function onDelete(customer: Customer) {
    if (
      !confirm(
        `Delete ${customer.name}? Past sessions keep the name, but the customer record is removed.`,
      )
    ) {
      return;
    }
    setBusyId(customer.id);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || "Could not delete customer");
        return;
      }
      if (editingId === customer.id) closeForm();
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Keep regulars on file, then pick them when starting a table."
        actions={
          <Button
            variant="secondary"
            onClick={() => (formOpen && !editingId ? closeForm() : openAddForm())}
          >
            <Plus className="h-4 w-4" />
            Add customer
          </Button>
        }
      />

      {formOpen ? (
        <form
          onSubmit={onSave}
          className="mb-8 rounded-xl border border-[var(--color-primary)]/10 bg-[var(--color-surface)] p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-[family-name:var(--font-heading)] text-sm font-bold uppercase tracking-wide text-[var(--color-text)]/70">
              {editingId ? "Edit customer" : "Add customer"}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="cursor-pointer rounded p-1 text-[var(--color-text)]/40 transition-colors duration-200 hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-text)]"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
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
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              {editingId ? "Update customer" : "Save customer"}
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-[var(--color-primary)]/10 bg-[var(--color-surface)] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-text)]">{c.name}</p>
                  <p className="mt-1 text-xs text-[var(--color-text)]/55">
                    {c.phone || "No phone"} · {c._count.sessions} sessions
                  </p>
                  {c.email ? (
                    <p className="mt-1 text-xs text-[var(--color-text)]/50">{c.email}</p>
                  ) : null}
                  {c.notes ? (
                    <p className="mt-2 text-sm text-[var(--color-text)]/70">{c.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="cursor-pointer rounded-md p-1.5 text-[var(--color-text)]/40 transition-colors duration-200 hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-primary)]"
                    onClick={() => openEditForm(c)}
                    aria-label={`Edit ${c.name}`}
                    title="Edit customer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer rounded-md p-1.5 text-[var(--color-text)]/40 transition-colors duration-200 hover:bg-[var(--color-danger-soft)] hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => onDelete(c)}
                    disabled={busyId === c.id}
                    aria-label={`Delete ${c.name}`}
                    title="Delete customer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
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
