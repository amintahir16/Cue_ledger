"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  Timer,
  X,
} from "lucide-react";
import { Button, Input, Label, PageHeader, Select } from "@/components/ui";
import {
  calculateTableCharge,
  formatDuration,
  getElapsedMs,
  money,
} from "@/lib/billing";
import { cn } from "@/lib/utils";

type Addon = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type ActiveSession = {
  id: string;
  status: "ACTIVE" | "PAUSED";
  startedAt: string;
  pausedAt: string | null;
  totalPausedMs: number;
  hourlyRate: number;
  customerName: string | null;
  addonsTotal: number;
  addons: Addon[];
};

type TableRow = {
  id: string;
  name: string;
  number: number;
  hourlyRate: number;
  isVip: boolean;
  status: "AVAILABLE" | "OCCUPIED" | "PAUSED";
  activeSession: ActiveSession | null;
};

type Product = { id: string; name: string; price: number };

type ClubBilling = {
  minimumCharge: number;
  billingIncrementSeconds: number;
  defaultHourlyRate: number;
  vipHourlyRate: number;
};

function LiveTimer({
  session,
  billing,
}: {
  session: ActiveSession;
  billing: ClubBilling;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (session.status === "PAUSED") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session.status, session.id]);

  const elapsed = getElapsedMs(session, new Date(now));
  const charge = calculateTableCharge({
    elapsedMs: elapsed,
    hourlyRate: session.hourlyRate,
    minimumCharge: billing.minimumCharge,
    billingIncrementSeconds: billing.billingIncrementSeconds,
  });

  return (
    <div>
      <p className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-wider tabular-nums text-[var(--color-primary)]">
        {formatDuration(elapsed)}
      </p>
      <p className="mt-1 text-sm text-[var(--color-text)]/60">
        Est. table: {money(charge)} + extras {money(session.addonsTotal)}
      </p>
    </div>
  );
}

export default function TablesPage() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [billing, setBilling] = useState<ClubBilling>({
    minimumCharge: 0,
    billingIncrementSeconds: 1,
    defaultHourlyRate: 500,
    vipHourlyRate: 800,
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [stopModal, setStopModal] = useState<{
    tableId: string;
    preview: { tableCharge: number; addons: number; total: number; duration: string };
  } | null>(null);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    number: "",
    hourlyRate: "",
    isVip: false,
  });

  const load = useCallback(async () => {
    const [tRes, pRes, sRes] = await Promise.all([
      fetch("/api/tables"),
      fetch("/api/products"),
      fetch("/api/settings"),
    ]);
    const tJson = await tRes.json();
    const pJson = await pRes.json();
    const sJson = await sRes.json();
    setTables(tJson.tables || []);
    setProducts(pJson.products || []);
    if (sJson.settings) {
      setBilling({
        minimumCharge: sJson.settings.minimumCharge ?? 0,
        billingIncrementSeconds: sJson.settings.billingIncrementSeconds ?? 1,
        defaultHourlyRate: sJson.settings.defaultHourlyRate ?? 500,
        vipHourlyRate: sJson.settings.vipHourlyRate ?? 800,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  async function runAction(
    tableId: string,
    action: string,
    extra?: Record<string, unknown>,
  ) {
    setBusyId(tableId);
    try {
      const res = await fetch(`/api/tables/${tableId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Action failed");
        return null;
      }
      await load();
      return json;
    } finally {
      setBusyId(null);
    }
  }

  async function onAddTable(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        number: Number(form.number),
        isVip: form.isVip,
        hourlyRate: form.hourlyRate
          ? Number(form.hourlyRate)
          : form.isVip
            ? billing.vipHourlyRate
            : billing.defaultHourlyRate,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Could not add table");
      return;
    }
    setForm({ name: "", number: "", hourlyRate: "", isVip: false });
    setShowAdd(false);
    await load();
  }

  async function prepareStop(table: TableRow) {
    if (!table.activeSession) return;
    const elapsed = getElapsedMs(table.activeSession);
    const tableChargeExact = calculateTableCharge({
      elapsedMs: elapsed,
      hourlyRate: table.activeSession.hourlyRate,
      minimumCharge: billing.minimumCharge,
      billingIncrementSeconds: billing.billingIncrementSeconds,
    });
    const addons = table.activeSession.addonsTotal;
    const tableCharge = Math.round(tableChargeExact);
    const addonsRounded = Math.round(addons);
    setStopModal({
      tableId: table.id,
      preview: {
        tableCharge,
        addons: addonsRounded,
        total: Math.round(tableCharge + addonsRounded),
        duration: formatDuration(elapsed),
      },
    });
  }

  async function confirmStop(markPaid: boolean) {
    if (!stopModal) return;
    await runAction(stopModal.tableId, "stop", { markPaid });
    setStopModal(null);
  }

  async function addProduct(sessionId: string, product: Product) {
    await fetch(`/api/sessions/${sessionId}/addons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity: 1,
      }),
    });
    await load();
  }

  async function removeProduct(sessionId: string, addonId: string) {
    const res = await fetch(`/api/sessions/${sessionId}/addons/${addonId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || "Could not remove extra");
      return;
    }
    await load();
  }

  const occupied = useMemo(
    () => tables.filter((t) => t.status !== "AVAILABLE").length,
    [tables],
  );

  return (
    <div>
      <PageHeader
        title="Tables floor"
        description={`${tables.length} tables · ${occupied} in play. Start, pause, stop, and reset each table timer.`}
        actions={
          <Button variant="secondary" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add table
          </Button>
        }
      />

      {showAdd ? (
        <form
          onSubmit={onAddTable}
          className="mb-6 rounded-xl border border-[var(--color-primary)]/10 bg-white/90 p-4 shadow-sm"
        >
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <Label htmlFor="tname">Name</Label>
              <Input
                id="tname"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="VIP 1"
                required
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="tnum">Number</Label>
              <Input
                id="tnum"
                type="number"
                min={1}
                value={form.number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, number: e.target.value }))
                }
                required
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="trate">Hourly rate</Label>
              <Input
                id="trate"
                type="number"
                min={1}
                step="0.01"
                value={form.hourlyRate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hourlyRate: e.target.value }))
                }
                placeholder={String(
                  form.isVip ? billing.vipHourlyRate : billing.defaultHourlyRate,
                )}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="tvip">Table type</Label>
              <div
                id="tvip"
                className="flex h-[42px] items-center gap-3 rounded-lg border border-[var(--color-primary)]/20 bg-white px-3"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
                    checked={form.isVip}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isVip: e.target.checked }))
                    }
                  />
                  VIP table
                </label>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text)]/50">
            Leave hourly rate empty to use the{" "}
            {form.isVip ? "VIP" : "standard"} rate from Settings (
            {money(form.isVip ? billing.vipHourlyRate : billing.defaultHourlyRate)}
            /hr).
          </p>
          <div className="mt-3 flex justify-end">
            <Button type="submit" variant="primary">
              Save table
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/70" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => {
            const session = table.activeSession;
            const statusColor =
              table.status === "AVAILABLE"
                ? "bg-emerald-500"
                : table.status === "PAUSED"
                  ? "bg-amber-500"
                  : "bg-[var(--color-primary)]";

            return (
              <article
                key={table.id}
                className={cn(
                  "animate-fade-up flex flex-col rounded-2xl border border-[var(--color-primary)]/10 bg-white/95 p-5 shadow-sm transition-colors duration-200",
                  table.status !== "AVAILABLE" && "ring-1 ring-[var(--color-primary)]/20",
                )}
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", statusColor)} />
                      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text)]">
                        {table.name}
                      </h2>
                      {table.isVip ? (
                        <span className="rounded bg-[var(--color-cta)]/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7F1D1D]">
                          VIP
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text)]/55">
                      #{table.number} ·{" "}
                      {money(
                        session
                          ? session.hourlyRate
                          : table.isVip
                            ? billing.vipHourlyRate
                            : billing.defaultHourlyRate,
                      )}
                      /hr
                      {session ? " (this game)" : ""} ·{" "}
                      <span className="uppercase tracking-wide">{table.status}</span>
                    </p>
                  </div>
                  <Timer className="h-5 w-5 text-[var(--color-primary)]/40" />
                </div>

                {session ? (
                  <div className="mb-4 space-y-3">
                    <LiveTimer session={session} billing={billing} />
                    <p className="text-sm text-[var(--color-text)]/70">
                      Player:{" "}
                      <span className="font-semibold">
                        {session.customerName || "Walk-in"}
                      </span>
                    </p>
                    {session.addons.length > 0 ? (
                      <ul className="space-y-1 text-xs text-[var(--color-text)]/60">
                        {session.addons.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-[var(--color-primary)]/5 px-2 py-1.5"
                          >
                            <span>
                              {a.quantity}× {a.name} — {money(a.lineTotal)}
                            </span>
                            <button
                              type="button"
                              className="cursor-pointer rounded p-0.5 text-[var(--color-text)]/40 transition-colors duration-200 hover:bg-red-100 hover:text-red-600"
                              onClick={() => removeProduct(session.id, a.id)}
                              aria-label={`Remove ${a.name}`}
                              title="Remove extra"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {products.length > 0 ? (
                      <div>
                        <Label>Add extra</Label>
                        <Select
                          defaultValue=""
                          onChange={(e) => {
                            const p = products.find((x) => x.id === e.target.value);
                            if (p) addProduct(session.id, p);
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>
                            Select product…
                          </option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({money(p.price)})
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-text)]/45">
                        No extras configured — add them under F&amp;B / Extras.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mb-4">
                    <Label htmlFor={`cust-${table.id}`}>Customer name (optional)</Label>
                    <Input
                      id={`cust-${table.id}`}
                      placeholder="Walk-in"
                      value={customerNames[table.id] || ""}
                      onChange={(e) =>
                        setCustomerNames((prev) => ({
                          ...prev,
                          [table.id]: e.target.value,
                        }))
                      }
                    />
                    <p className="mt-6 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-wider text-[var(--color-text)]/20">
                      00:00:00
                    </p>
                  </div>
                )}

                <div className="mt-auto grid grid-cols-2 gap-2">
                  {!session ? (
                    <Button
                      className="col-span-2"
                      variant="success"
                      disabled={busyId === table.id}
                      onClick={() =>
                        runAction(table.id, "start", {
                          customerName: customerNames[table.id] || undefined,
                        }).then(() =>
                          setCustomerNames((prev) => ({ ...prev, [table.id]: "" })),
                        )
                      }
                    >
                      <Play className="h-4 w-4" />
                      Start game
                    </Button>
                  ) : (
                    <>
                      {session.status === "ACTIVE" ? (
                        <Button
                          variant="warning"
                          disabled={busyId === table.id}
                          onClick={() => runAction(table.id, "pause")}
                        >
                          <Pause className="h-4 w-4" />
                          Pause
                        </Button>
                      ) : (
                        <Button
                          variant="success"
                          disabled={busyId === table.id}
                          onClick={() => runAction(table.id, "resume")}
                        >
                          <Play className="h-4 w-4" />
                          Resume
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        disabled={busyId === table.id}
                        onClick={() => prepareStop(table)}
                      >
                        <Square className="h-4 w-4" />
                        Stop
                      </Button>
                      <Button
                        className="col-span-2"
                        variant="ghost"
                        disabled={busyId === table.id}
                        onClick={() => {
                          if (
                            confirm(
                              "Reset cancels the game with no charge. Continue?",
                            )
                          ) {
                            runAction(table.id, "reset");
                          }
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset table
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {stopModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-primary)]">
              End game & bill
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text)]/65">
              Duration {stopModal.preview.duration}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Table time</dt>
                <dd className="font-semibold">
                  {money(stopModal.preview.tableCharge, "Rs", { whole: true })}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Extras</dt>
                <dd className="font-semibold">
                  {money(stopModal.preview.addons, "Rs", { whole: true })}
                </dd>
              </div>
              <div className="flex justify-between border-t border-[var(--color-primary)]/10 pt-2 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-[family-name:var(--font-heading)] font-bold">
                  {money(stopModal.preview.total, "Rs", { whole: true })}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-col gap-2">
              <Button variant="success" onClick={() => confirmStop(true)}>
                Stop & mark paid
              </Button>
              <Button variant="secondary" onClick={() => confirmStop(false)}>
                Stop · pay later
              </Button>
              <Button variant="ghost" onClick={() => setStopModal(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
