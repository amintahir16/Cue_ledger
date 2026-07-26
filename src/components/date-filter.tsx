"use client";

import { Label, Select } from "@/components/ui";
import { toDateInputValue } from "@/lib/billing";

export type DateFilterValue = {
  /** Anchor date YYYY-MM-DD used by APIs */
  date: string;
  /** day = one day, month = whole month, year = whole year */
  scope: "day" | "month" | "year";
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function buildValue(
  year: number,
  month: number | "all",
  day: number | "all",
): DateFilterValue {
  if (month === "all") {
    return { date: `${year}-01-01`, scope: "year" };
  }
  if (day === "all") {
    return { date: `${year}-${pad(month)}-01`, scope: "month" };
  }
  const maxDay = daysInMonth(year, month - 1);
  const safeDay = Math.min(day, maxDay);
  return {
    date: `${year}-${pad(month)}-${pad(safeDay)}`,
    scope: "day",
  };
}

function parseParts(value: DateFilterValue) {
  const [ys, ms, ds] = (value.date || toDateInputValue()).split("-");
  const year = Number(ys);
  const monthNum = Number(ms);
  const dayNum = Number(ds);

  if (value.scope === "year") {
    return { year, month: "all" as const, day: "all" as const };
  }
  if (value.scope === "month") {
    return { year, month: monthNum, day: "all" as const };
  }
  return { year, month: monthNum, day: dayNum };
}

export function defaultDateFilter(
  scope: DateFilterValue["scope"] = "day",
): DateFilterValue {
  const today = toDateInputValue();
  if (scope === "year") {
    return { date: `${today.slice(0, 4)}-01-01`, scope: "year" };
  }
  if (scope === "month") {
    return { date: `${today.slice(0, 7)}-01`, scope: "month" };
  }
  return { date: today, scope: "day" };
}

export function filterToQuery(value: DateFilterValue) {
  return {
    date: value.date,
    period: value.scope,
  };
}

export function DateFilterControls({
  value,
  onChange,
  idPrefix = "filter",
}: {
  value: DateFilterValue;
  onChange: (next: DateFilterValue) => void;
  idPrefix?: string;
}) {
  const parts = parseParts(value);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i);
  const dayCount =
    parts.month === "all" ? 31 : daysInMonth(parts.year, parts.month - 1);

  function update(
    nextYear: number,
    nextMonth: number | "all",
    nextDay: number | "all",
  ) {
    onChange(buildValue(nextYear, nextMonth, nextDay));
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label htmlFor={`${idPrefix}-year`}>Year</Label>
        <Select
          id={`${idPrefix}-year`}
          value={String(parts.year)}
          onChange={(e) =>
            update(Number(e.target.value), parts.month, parts.day)
          }
          className="w-[100px]"
          aria-label="Year"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-month`}>Month</Label>
        <Select
          id={`${idPrefix}-month`}
          value={parts.month === "all" ? "all" : String(parts.month)}
          onChange={(e) => {
            const m =
              e.target.value === "all" ? "all" : Number(e.target.value);
            update(parts.year, m, m === "all" ? "all" : parts.day);
          }}
          className="w-[140px]"
          aria-label="Month"
        >
          <option value="all">All months</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-day`}>Day</Label>
        <Select
          id={`${idPrefix}-day`}
          value={parts.day === "all" ? "all" : String(parts.day)}
          disabled={parts.month === "all"}
          onChange={(e) => {
            const d =
              e.target.value === "all" ? "all" : Number(e.target.value);
            update(parts.year, parts.month === "all" ? "all" : parts.month, d);
          }}
          className="w-[110px] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Day"
        >
          <option value="all">All days</option>
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export function filterHint(value: DateFilterValue): string {
  const parts = parseParts(value);
  if (value.scope === "year") return `Whole year · ${parts.year}`;
  if (value.scope === "month" && parts.month !== "all") {
    return `Whole month · ${MONTHS[parts.month - 1]} ${parts.year}`;
  }
  if (parts.month !== "all" && parts.day !== "all") {
    return `Day · ${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
  }
  return "Select year / month / day";
}
