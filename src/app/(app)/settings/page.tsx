"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button, Input, Label, PageHeader } from "@/components/ui";

type Settings = {
  clubName: string;
  currency: string;
  currencySymbol: string;
  defaultHourlyRate: number;
  vipHourlyRate: number;
  minimumCharge: number;
  billingIncrementSeconds: number;
  timezone: string;
};

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [syncNote, setSyncNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/settings");
    const json = await res.json();
    setForm({
      ...json.settings,
      vipHourlyRate: json.settings.vipHourlyRate ?? 800,
      billingIncrementSeconds:
        json.settings.billingIncrementSeconds ??
        json.settings.billingIncrementMinutes ??
        1,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubName: form.clubName,
          currency: form.currency,
          currencySymbol: form.currencySymbol,
          defaultHourlyRate: Number(form.defaultHourlyRate),
          vipHourlyRate: Number(form.vipHourlyRate),
          minimumCharge: Number(form.minimumCharge),
          billingIncrementSeconds: Number(form.billingIncrementSeconds),
          timezone: form.timezone,
        }),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) {
        alert(json.error || "Failed to save settings");
        return;
      }
      setForm({
        ...json.settings,
        vipHourlyRate: json.settings?.vipHourlyRate ?? form.vipHourlyRate,
        billingIncrementSeconds: json.settings?.billingIncrementSeconds ?? 1,
      });
      const synced = json.synced as
        | { standardTables?: number; vipTables?: number }
        | undefined;
      setSaved(true);
      if (synced) {
        const parts = [];
        if (synced.standardTables)
          parts.push(`${synced.standardTables} standard`);
        if (synced.vipTables) parts.push(`${synced.vipTables} VIP`);
        if (parts.length) {
          setSyncNote(
            `Rates applied to ${parts.join(" + ")} table(s). New games use these prices.`,
          );
        } else {
          setSyncNote("Settings saved.");
        }
      } else {
        setSyncNote("Settings saved.");
      }
      setTimeout(() => {
        setSaved(false);
        setSyncNote("");
      }, 4000);
    } catch (err) {
      console.error(err);
      alert("Could not save settings. Try refreshing the page.");
    }
  }

  if (!form) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/70" />;
  }

  return (
    <div>
      <PageHeader
        title="Club settings"
        description="Standard and VIP hourly rates, currency, and per-second billing rules. Saving rates updates all matching tables."
      />

      <form
        onSubmit={onSubmit}
        className="max-w-xl space-y-4 rounded-xl border border-[var(--color-primary)]/10 bg-white/90 p-5 shadow-sm"
      >
        <div>
          <Label htmlFor="clubName">Club name</Label>
          <Input
            id="clubName"
            value={form.clubName}
            onChange={(e) => setForm({ ...form, clubName: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="currency">Currency code</Label>
            <Input
              id="currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              value={form.currencySymbol}
              onChange={(e) =>
                setForm({ ...form, currencySymbol: e.target.value })
              }
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rate">Standard table rate (/hr)</Label>
            <Input
              id="rate"
              type="number"
              min={1}
              step="0.01"
              value={form.defaultHourlyRate}
              onChange={(e) =>
                setForm({ ...form, defaultHourlyRate: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label htmlFor="vipRate">VIP table rate (/hr)</Label>
            <Input
              id="vipRate"
              type="number"
              min={1}
              step="0.01"
              value={form.vipHourlyRate}
              onChange={(e) =>
                setForm({ ...form, vipHourlyRate: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="min">Minimum charge</Label>
            <Input
              id="min"
              type="number"
              min={0}
              step="0.01"
              value={form.minimumCharge}
              onChange={(e) =>
                setForm({ ...form, minimumCharge: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label htmlFor="inc">Billing increment (seconds)</Label>
            <Input
              id="inc"
              type="number"
              min={1}
              value={form.billingIncrementSeconds}
              onChange={(e) =>
                setForm({
                  ...form,
                  billingIncrementSeconds: Number(e.target.value),
                })
              }
            />
          </div>
        </div>
        <p className="text-xs text-[var(--color-text)]/50">
          Play time is rounded up to this many seconds when charging (e.g. 1 = every
          second, 30 = half-minute blocks).
        </p>
        <div>
          <Label htmlFor="tz">Timezone</Label>
          <Input
            id="tz"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary">
              Save settings
            </Button>
            {saved ? (
              <span className="text-sm font-medium text-emerald-700">Saved</span>
            ) : null}
          </div>
          {syncNote ? (
            <p className="text-sm text-emerald-700">{syncNote}</p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
