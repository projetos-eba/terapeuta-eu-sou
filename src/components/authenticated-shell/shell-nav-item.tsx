"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  CalendarDays,
  Heart,
  House,
  MessageSquareDot,
  Search,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { ShellNavigationItem } from "./authenticated-shell";

const icons = {
  calendar: CalendarDays,
  heart: Heart,
  home: House,
  message: MessageSquareDot,
  search: Search,
  user: UserRound,
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
  const isActive =
    pathname === item.href ||
    (item.href !== "/app" && pathname.startsWith(`${item.href}/`));

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20",
        isActive
          ? "bg-brand-lavenderSoft text-brand-primary"
          : "text-[#4f4a7a] hover:bg-surface-soft hover:text-brand-primary",
      )}
      href={item.href as Route<string>}
      onClick={onNavigate}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-lavenderSoft text-xs font-semibold text-brand-primary">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}
