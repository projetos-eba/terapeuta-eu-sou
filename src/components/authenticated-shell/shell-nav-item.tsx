"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  BrainCircuit,
  CalendarDays,
  ChartNoAxesCombined,
  CircleHelp,
  CreditCard,
  Heart,
  House,
  MessageSquareDot,
  Route as RouteIcon,
  Search,
  Settings,
  Sparkles,
  Star,
  UserRound,
  UserRoundPen,
  WalletCards,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { ShellNavigationItem } from "./authenticated-shell";

const icons = {
  brain: BrainCircuit,
  calendar: CalendarDays,
  chart: ChartNoAxesCombined,
  "credit-card": CreditCard,
  heart: Heart,
  help: CircleHelp,
  home: House,
  message: MessageSquareDot,
  route: RouteIcon,
  search: Search,
  settings: Settings,
  sparkles: Sparkles,
  star: Star,
  user: UserRound,
  "user-pen": UserRoundPen,
  wallet: WalletCards,
};

export function ShellNavItem({
  item,
  onNavigate,
}: {
  item: ShellNavigationItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const Icon = icons[item.icon];
  const isNamespaceRoot = ["/app", "/terapeuta"].includes(item.href);
  const isActive =
    pathname === item.href ||
    (!isNamespaceRoot && pathname.startsWith(`${item.href}/`));
  const isLocked = item.accessState === "locked";
  const destination =
    isLocked && item.upgradeHref ? item.upgradeHref : item.href;

  return (
    <Link
      aria-disabled={isLocked && !item.upgradeHref ? true : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex h-12 w-full shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20",
        isActive
          ? "bg-brand-lavenderSoft text-brand-primary"
          : isLocked
            ? "text-tesText-muted hover:bg-surface-soft"
            : "text-tesText-secondary hover:bg-surface-soft hover:text-brand-primary",
      )}
      href={destination as Route<string>}
      onClick={onNavigate}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.planLabel ? (
        <span className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full bg-status-warningBg px-2 text-xs font-semibold text-brand-deep">
          <Star aria-hidden="true" className="size-3" />
          <span className="sr-only">{item.planLabel}</span>
        </span>
      ) : null}
      {item.badge && item.badge > 0 ? (
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-lavenderSoft text-xs font-semibold text-brand-primary">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}
