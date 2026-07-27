"use client";

import {
  LayoutDashboard,
  Table2,
  Wallet,
  History,
  Users,
  ShoppingBag,
  Settings,
  ClipboardCheck,
  LogOut,
  CircleDot,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export const CLUB_NAME_UPDATED_EVENT = "cueledger:club-name-updated";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tables", label: "Tables", icon: Table2 },
  { href: "/sessions", label: "History", icon: History },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/products", label: "F&B / Extras", icon: ShoppingBag },
  { href: "/closing", label: "Daily Close", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  clubName,
}: {
  children: React.ReactNode;
  clubName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(clubName || "Snooker Club");

  useEffect(() => {
    setDisplayName(clubName || "Snooker Club");
  }, [clubName]);

  useEffect(() => {
    function onClubNameUpdated(event: Event) {
      const detail = (event as CustomEvent<{ clubName?: string }>).detail;
      if (detail?.clubName) setDisplayName(detail.clubName);
    }
    window.addEventListener(CLUB_NAME_UPDATED_EVENT, onClubNameUpdated);
    return () =>
      window.removeEventListener(CLUB_NAME_UPDATED_EVENT, onClubNameUpdated);
  }, []);

  async function handleLogout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[var(--color-primary)]/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[var(--color-cta)]/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--color-dot) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--color-primary)]/10 bg-[var(--color-surface-muted)] p-4 backdrop-blur-md md:flex">
          <div className="mb-8 flex items-start gap-3 px-2 pt-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-md">
              <CircleDot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="break-words font-[family-name:var(--font-heading)] text-sm font-bold leading-snug tracking-tight text-[var(--color-primary)]"
                title={displayName}
              >
                {displayName}
              </p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                    active
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "text-[var(--color-text)]/80 hover:bg-[var(--color-primary)]/8 hover:text-[var(--color-primary)]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--color-text)]/70 transition-colors duration-200 hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-primary)]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[var(--color-primary)]/10 bg-[var(--color-surface-muted)] px-4 py-3 backdrop-blur-md md:hidden">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" />
                <p
                  className="break-words font-[family-name:var(--font-heading)] font-bold leading-snug text-[var(--color-primary)]"
                  title={displayName}
                >
                  {displayName}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="cursor-pointer rounded-lg p-2 hover:bg-[var(--color-danger-soft)]"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <nav className="mt-3 flex gap-1 overflow-x-auto pb-1">
              {nav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
                      active
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-primary)]/8 text-[var(--color-text)]",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
