"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { ShellHelpCard } from "./shell-help-card";
import type { ShellNavigationItem } from "./authenticated-shell";
import { ShellNavItem, shellIcons } from "./shell-nav-item";

type ShellSidebarProps = {
  helpCardVariant?: "default" | "priority" | "therapist";
  helpHref?: string;
  helpLabel?: string;
  logoutAction?: () => void | Promise<void>;
  logoutHref?: string;
  navigation: ShellNavigationItem[];
  onNavigate?: () => void;
};

export function ShellSidebar({
  helpCardVariant,
  helpHref,
  helpLabel,
  logoutAction,
  logoutHref = "/cliente/login",
  navigation,
  onNavigate,
}: ShellSidebarProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    setExpandedGroups((current) => {
      const next = { ...current };

      for (const item of navigation) {
        const visibleChildren =
          item.children?.filter((child) => child.accessState !== "hidden") ??
          [];
        if (
          visibleChildren.length > 0 &&
          (pathname === item.href ||
            visibleChildren.some(
              (child) =>
                pathname === child.href ||
                pathname.startsWith(`${child.href}/`),
            ))
        ) {
          next[item.href] = true;
        }
      }

      return next;
    });
  }, [navigation, pathname]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-[13px] pb-4 pt-3">
      <div className="flex h-[74px] items-center px-3">
        <Image
          alt="Terapeuta Eu Sou"
          className="h-auto w-[174px]"
          height={93}
          priority
          src="/logo-oficial-terapeuta-eu-sou.png"
          width={174}
        />
      </div>

      <nav aria-label="Seções do ambiente" className="mt-3 flex flex-col gap-1">
        {navigation
          .filter((item) => item.accessState !== "hidden")
          .map((item) => {
            const children =
              item.children?.filter(
                (child) => child.accessState !== "hidden",
              ) ?? [];
            const isGroup = children.length > 0;

            return (
              <div className="flex flex-col gap-1" key={item.href}>
                {isGroup ? (
                  <SidebarGroup
                    expanded={expandedGroups[item.href] ?? false}
                    item={item}
                    onNavigate={onNavigate}
                    panelId={`sidebar-group-${item.href.replace(/[^a-z0-9]+/gi, "-")}`}
                    onToggle={() =>
                      setExpandedGroups((current) => ({
                        ...current,
                        [item.href]: !(current[item.href] ?? false),
                      }))
                    }
                  />
                ) : (
                  <ShellNavItem item={item} onNavigate={onNavigate} />
                )}
                {isGroup && (expandedGroups[item.href] ?? false) ? (
                  <div
                    aria-label={`Subseções de ${item.label}`}
                    className="flex flex-col gap-1"
                    id={`sidebar-group-${item.href.replace(/[^a-z0-9]+/gi, "-")}`}
                  >
                    {children.map((child) => (
                      <ShellNavItem
                        depth={1}
                        item={child}
                        key={child.href}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
      </nav>

      <div className="mt-8">
        {logoutAction ? (
          <form action={logoutAction}>
            <button
              className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-tesText-secondary outline-none transition hover:bg-surface-soft hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
              type="submit"
            >
              <LogOut aria-hidden="true" className="size-5" strokeWidth={1.8} />
              Sair
            </button>
          </form>
        ) : (
          <a
            className="flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-medium text-tesText-secondary outline-none transition hover:bg-surface-soft hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-ring/20"
            href={logoutHref}
          >
            <LogOut aria-hidden="true" className="size-5" strokeWidth={1.8} />
            Sair
          </a>
        )}
      </div>

      {helpHref ? (
        <div className="mt-auto pt-8">
          <ShellHelpCard
            href={helpHref}
            label={helpLabel}
            variant={helpCardVariant}
          />
        </div>
      ) : null}
    </div>
  );
}

function SidebarGroup({
  expanded,
  item,
  onNavigate,
  panelId,
  onToggle,
}: {
  expanded: boolean;
  item: ShellNavigationItem;
  onNavigate?: () => void;
  panelId: string;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const Icon = shellIcons[item.icon];
  const isActive =
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    item.children?.some(
      (child) =>
        pathname === child.href || pathname.startsWith(`${child.href}/`),
    );

  return (
    <div className="flex items-center gap-1">
      <Link
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group flex h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20",
          isActive
            ? "bg-brand-lavenderSoft text-brand-primary"
            : "text-tesText-secondary hover:bg-surface-soft hover:text-brand-primary",
        )}
        href={item.href}
        onClick={onNavigate}
      >
        <Icon
          aria-hidden="true"
          className="pointer-events-none size-5 shrink-0"
          strokeWidth={1.8}
        />
        <span className="pointer-events-none min-w-0 flex-1 truncate">
          {item.label}
        </span>
      </Link>
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? `Recolher subseções de ${item.label}`
            : `Expandir subseções de ${item.label}`
        }
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-md outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20",
          isActive
            ? "bg-brand-lavenderSoft text-brand-primary"
            : "text-tesText-secondary hover:bg-surface-soft hover:text-brand-primary",
        )}
        onClick={onToggle}
        type="button"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 transition", expanded && "rotate-180")}
          strokeWidth={2}
        />
      </button>
    </div>
  );
}
