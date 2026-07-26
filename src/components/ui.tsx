import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  accent = "red",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "red" | "gold" | "green" | "slate";
  className?: string;
}) {
  const accents = {
    red: "border-l-[var(--color-primary)]",
    gold: "border-l-[var(--color-cta)]",
    green: "border-l-emerald-600",
    slate: "border-l-slate-400",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-primary)]/10 border-l-4 bg-white/90 p-4 shadow-sm transition-colors duration-200",
        accents[accent],
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text)]/55">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-[var(--color-text)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--color-text)]/50">{hint}</p>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-[var(--color-primary)] md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-xl text-sm text-[var(--color-text)]/65">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
}) {
  const variants = {
    primary:
      "bg-[var(--color-cta)] text-[#7F1D1D] hover:bg-[#F59E0B] shadow-sm",
    secondary:
      "bg-[var(--color-primary)] text-white hover:bg-[var(--color-secondary)]",
    ghost: "bg-transparent hover:bg-[var(--color-primary)]/8 text-[var(--color-text)]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    warning: "bg-amber-500 text-white hover:bg-amber-600",
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-[var(--color-primary)]/20 bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none transition-colors duration-200 placeholder:text-[var(--color-text)]/40 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full cursor-pointer rounded-lg border border-[var(--color-primary)]/20 bg-white px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text)]/60"
    >
      {children}
    </label>
  );
}
