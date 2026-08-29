import Link from "next/link";
import type { Route } from "next";
import { ChevronDown, Command, SlidersHorizontal } from "lucide-react";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { PublicTherapyTheme, TherapySearchParams } from "../types";

type ThemeFilterProps = {
  activeTheme?: string;
  themes: PublicTherapyTheme[];
  params: TherapySearchParams;
  totalCount: number;
};

export function ThemeFilter({
  activeTheme,
  themes,
  params,
  totalCount,
}: ThemeFilterProps) {
  return (
    <>
      <aside className="hidden min-w-0 lg:block">
        <ThemePanel
          activeTheme={activeTheme}
          themes={themes}
          params={params}
          totalCount={totalCount}
        />
      </aside>

      <details className="group min-w-0 rounded-[28px] border border-brand-lavender/80 bg-white p-4 shadow-card lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-extrabold text-brand-deep">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-brand-primary" />
            Filtros
          </span>
          <ChevronDown className="h-5 w-5 text-brand-primary transition group-open:rotate-180" />
        </summary>
        <div className="mt-4 min-w-0 border-t border-brand-lavender/70 pt-4">
          <ThemePanel
            activeTheme={activeTheme}
            themes={themes}
            params={params}
            totalCount={totalCount}
          />
        </div>
      </details>
    </>
  );
}

function ThemePanel({
  activeTheme,
  themes,
  params,
  totalCount,
}: ThemeFilterProps) {
  return (
    <div className="min-w-0 w-full overflow-hidden rounded-[14px] border border-brand-lavender/80 bg-white p-5 shadow-[0_12px_28px_rgba(46,26,71,0.07)]">
      <h2 className="text-xl font-extrabold leading-7 text-brand-deep">
        Temas do Match
      </h2>
      <nav className="mt-4 grid min-w-0 gap-1.5" aria-label="Temas do Match">
        <ThemeLink
          active={!activeTheme}
          count={totalCount}
          href={buildHref(params, { theme: undefined, page: 1 })}
          label="Todas as terapias"
        />
        {themes.map((theme) => (
          <ThemeLink
            key={theme.slug}
            active={activeTheme === theme.slug}
            count={theme.count}
            href={buildHref(params, { theme: theme.slug, page: 1 })}
            label={theme.name}
          />
        ))}
      </nav>
    </div>
  );
}

type ThemeLinkProps = {
  active: boolean;
  count: number;
  href: string;
  label: string;
};

function ThemeLink({ active, count, href, label }: ThemeLinkProps) {
  return (
    <Link
      href={href as Route<string>}
      className={cn(
        "flex min-h-[46px] w-full min-w-0 items-start gap-3 overflow-hidden rounded-[8px] px-3 py-3 text-sm font-extrabold leading-5 transition focus:outline-none focus:ring-4 focus:ring-ring/20",
        active
          ? "bg-brand-lavenderSoft text-brand-primary"
          : "bg-white text-tesText-secondary hover:bg-brand-lavenderSoft/70 hover:text-brand-primary",
      )}
    >
      <Command className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
      <span className="min-w-0 flex-1 break-words whitespace-normal">{label}</span>
      <span
        className={cn(
          "grid h-7 min-w-7 place-items-center rounded-full px-2 text-[0.7rem]",
          active ? "bg-white text-brand-primary" : "bg-brand-lavenderSoft text-brand-primary",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

export function buildHref(
  params: TherapySearchParams,
  overrides: Partial<TherapySearchParams>,
) {
  const next = {
    ...params,
    ...overrides,
  };
  const query = new URLSearchParams();

  if (next.q) query.set("q", next.q);
  if (next.theme) query.set("theme", next.theme);
  if (next.sort !== "relevance") query.set("sort", next.sort);
  if (next.page > 1) query.set("page", String(next.page));

  const suffix = query.toString();
  return suffix ? `${routes.public.therapies}?${suffix}` : routes.public.therapies;
}
