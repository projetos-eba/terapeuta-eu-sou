"use client";

import Image from "next/image";
import { UserRound } from "lucide-react";
import Link from "next/link";

import { routes } from "@/lib/routes";

import type { ShellUser } from "./authenticated-shell";

export function ShellUserMenu({
  planLabel,
  user,
}: {
  planLabel?: string;
  user: ShellUser;
}) {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-md px-1 text-left outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20">
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
      <span className="hidden min-w-0 sm:block">
        <span className="block truncate text-sm font-semibold text-[var(--tes-color-primary-dark)]">
          Olá, {user.name}
        </span>
        {(planLabel ?? user.planLabel) ? (
          <Link
            aria-label={`Abrir planos. Plano atual: TES ${planLabel ?? user.planLabel}`}
            className="mt-1 inline-flex min-h-6 items-center rounded-full bg-status-warningBg px-2 text-xs font-semibold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
            href={routes.therapist.plan}
          >
            TES {planLabel ?? user.planLabel}
          </Link>
        ) : (
          <span className="mt-0.5 block text-xs text-[var(--tes-color-text-secondary-app)]">
            {user.roleLabel}
          </span>
        )}
      </span>
    </div>
  );
}
