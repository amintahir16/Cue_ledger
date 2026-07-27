"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { Button, Input, Label, PageHeader, TableSkeleton } from "@/components/ui";
import { money } from "@/lib/billing";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
};

const emptyForm = { name: "", price: "", category: "F&B" };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      const json = await res.json();
      setProducts(json.products || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      price: String(p.price),
      category: p.category,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      price: Number(form.price),
      category: form.category,
    };

    const res = editingId
      ? await fetch(`/api/products/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const j = await res.json();
      alert(j.error || "Failed");
      return;
    }
    cancelEdit();
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this product from F&B / extras?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Failed to delete");
      return;
    }
    if (editingId === id) cancelEdit();
    await load();
  }

  return (
    <div>
      <PageHeader
        title="F&B & extras"
        description="Snacks, drinks, and services you can add onto a live table bill."
      />

      <form
        onSubmit={onSubmit}
        className="mb-8 grid gap-3 rounded-xl border border-[var(--color-primary)]/10 bg-[var(--color-surface)] p-4 shadow-sm md:grid-cols-4"
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
          <Label htmlFor="price">Price</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step="0.01"
            required
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="cat">Category</Label>
          <Input
            id="cat"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1" variant="secondary">
            {editingId ? "Save changes" : "Add product"}
          </Button>
          {editingId ? (
            <Button type="button" variant="ghost" onClick={cancelEdit} aria-label="Cancel edit">
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-primary)]/10 bg-[var(--color-surface)] shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--color-primary)]/10 bg-[var(--color-primary)]/5 text-xs uppercase tracking-wide text-[var(--color-text)]/55">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-[var(--color-text)]/45"
                  >
                    No products yet.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className={
                      editingId === p.id
                        ? "border-b border-[var(--color-primary)]/5 bg-[var(--color-primary)]/5"
                        : "border-b border-[var(--color-primary)]/5"
                    }
                  >
                    <td className="px-4 py-3 font-semibold">{p.name}</td>
                    <td className="px-4 py-3">{p.category}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      {money(p.price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="cursor-pointer rounded p-1.5 text-[var(--color-text)]/40 transition-colors hover:bg-[var(--color-primary)]/8 hover:text-[var(--color-primary)]"
                          onClick={() => startEdit(p)}
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="cursor-pointer rounded p-1.5 text-[var(--color-text)]/40 transition-colors hover:bg-[var(--color-danger-soft)] hover:text-red-600"
                          onClick={() => remove(p.id)}
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
