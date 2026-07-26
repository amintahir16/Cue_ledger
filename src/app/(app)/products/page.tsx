"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button, Input, Label, PageHeader, TableSkeleton } from "@/components/ui";
import { money } from "@/lib/billing";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", price: "", category: "F&B" });

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        price: Number(form.price),
        category: form.category,
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      alert(j.error || "Failed");
      return;
    }
    setForm({ name: "", price: "", category: "F&B" });
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
        className="mb-8 grid gap-3 rounded-xl border border-[var(--color-primary)]/10 bg-white/90 p-4 shadow-sm md:grid-cols-4"
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
        <div className="flex items-end">
          <Button type="submit" className="w-full" variant="secondary">
            Add product
          </Button>
        </div>
      </form>

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-primary)]/10 bg-white/90 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--color-primary)]/10 bg-[var(--color-primary)]/5 text-xs uppercase tracking-wide text-[var(--color-text)]/55">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-[var(--color-text)]/45"
                  >
                    No products yet.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-primary)]/5">
                    <td className="px-4 py-3 font-semibold">{p.name}</td>
                    <td className="px-4 py-3">{p.category}</td>
                    <td className="px-4 py-3 text-right font-bold">{money(p.price)}</td>
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
