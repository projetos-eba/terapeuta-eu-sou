"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Crown,
  LogOut,
  Mail,
  Settings2,
  UserRound,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { ShellUser } from "./authenticated-shell";

export function ShellUserMenu({
  accountHref,
  logoutAction,
  logoutHref,
  planLabel,
  user,
}: {
  accountHref: string;
  logoutAction?: () => void | Promise<void>;
  logoutHref: string;
  planLabel?: string;
  user: ShellUser;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = `shell-account-menu-${useId().replace(/:/g, "")}`;
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const accountName = user.fullName ?? user.name;
  const effectivePlanLabel = planLabel ?? user.planLabel;

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <div className="relative z-dropdown" ref={menuRef}>
      <button
        aria-controls={isOpen ? menuId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Abrir menu da conta de ${accountName}`}
        className="group flex min-h-12 items-center gap-2 rounded-md px-1 text-left outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span className="relative inline-flex size-[54px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-soft text-brand-primary">
          {user.avatarUrl ? (
            <Image
              alt=""
              className="object-cover"
              fill
              sizes="54px"
              src={user.avatarUrl}
            />
          ) : (
            <UserRound aria-hidden="true" className="size-6" />
          )}
        </span>
        <span className="hidden min-w-0 max-w-[12rem] sm:block">
          <span className="block truncate text-sm font-semibold text-brand-deep">
            Olá, {user.name}
          </span>
          {effectivePlanLabel ? (
            <span className="mt-1 inline-flex min-h-6 items-center rounded-full bg-status-warningBg px-2 text-xs font-semibold text-brand-deep">
              TES {effectivePlanLabel}
            </span>
          ) : (
            <span className="mt-0.5 block truncate text-xs text-[var(--tes-color-text-secondary-app)]">
              {user.roleLabel}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "ml-0.5 size-4 shrink-0 text-brand-primary transition-transform",
            isOpen && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>

      {isOpen ? (
        <div
          aria-label="Menu da conta"
          className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-panel border border-[var(--tes-color-border)] bg-surface-elevated shadow-float"
          id={menuId}
        >
          <div className="border-b border-[var(--tes-color-border)] px-4 py-4">
            <p className="text-sm font-semibold text-tesText-primary">
              {accountName}
            </p>
            <p className="mt-1 text-sm text-tesText-secondary">
              {user.roleLabel}
              {effectivePlanLabel ? ` · TES ${effectivePlanLabel}` : ""}
            </p>
            <div className="mt-3 flex min-w-0 items-center gap-2 text-sm text-tesText-secondary">
              <Mail
                aria-hidden="true"
                className="size-4 shrink-0 text-brand-primary"
              />
              <span className="truncate" title={user.email ?? undefined}>
                {user.email ?? "E-mail não informado"}
              </span>
            </div>
          </div>

          <div className="p-2">
            <Link
              className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-tesText-primary outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20"
              href={accountHref}
              onClick={closeMenu}
            >
              <Settings2
                aria-hidden="true"
                className="size-5 text-brand-primary"
                strokeWidth={1.8}
              />
              <span className="flex-1">Minha conta</span>
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-tesText-muted"
              />
            </Link>

            {effectivePlanLabel ? (
              <Link
                aria-label={`Abrir planos. Plano atual: TES ${effectivePlanLabel}`}
                className="mt-1 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-tesText-primary outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20"
                href={routes.therapist.plan}
                onClick={closeMenu}
              >
                <Crown
                  aria-hidden="true"
                  className="size-5 text-status-warning"
                  strokeWidth={1.8}
                />
                <span className="flex-1">Ver planos</span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-tesText-muted"
                />
              </Link>
            ) : null}

            <div className="mt-1 border-t border-[var(--tes-color-border)] pt-1">
              {logoutAction ? (
                <form action={logoutAction}>
                  <button
                    className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-status-danger outline-none transition hover:bg-status-dangerBg focus-visible:ring-4 focus-visible:ring-ring/20"
                    type="submit"
                  >
                    <LogOut
                      aria-hidden="true"
                      className="size-5"
                      strokeWidth={1.8}
                    />
                    Sair
                  </button>
                </form>
              ) : (
                <a
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-status-danger outline-none transition hover:bg-status-dangerBg focus-visible:ring-4 focus-visible:ring-ring/20"
                  href={logoutHref}
                >
                  <LogOut
                    aria-hidden="true"
                    className="size-5"
                    strokeWidth={1.8}
                  />
                  Sair
                </a>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
