import Link from "next/link";
import type { Route } from "next";
import { ChevronDown, Command, SlidersHorizontal } from "lucide-react";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { PublicTherapyCategory, TherapySearchParams } from "../types";

type CategoryFilterProps = {
  activeCategory?: string;
  categories: PublicTherapyCategory[];
  params: TherapySearchParams;
  totalCount: number;
};

export function CategoryFilter({
  activeCategory,
  categories,
  params,
  totalCount,
}: CategoryFilterProps) {
  return (
    <>
      <aside className="hidden lg:block">
        <CategoryPanel
          activeCategory={activeCategory}
          categories={categories}
          params={params}
          totalCount={totalCount}
        />
      </aside>

      <details className="group rounded-[28px] border border-brand-lavender/80 bg-white p-4 shadow-card lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-extrabold text-brand-deep">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-brand-primary" />
            Filtros
          </span>
          <ChevronDown className="h-5 w-5 text-brand-primary transition group-open:rotate-180" />
        </summary>
        <div className="mt-4 border-t border-brand-lavender/70 pt-4">
          <CategoryPanel
            activeCategory={activeCategory}
            categories={categories}
            params={params}
            totalCount={totalCount}
          />
        </div>
      </details>
    </>
  );
}

function CategoryPanel({
  activeCategory,
  categories,
  params,
  totalCount,
}: CategoryFilterProps) {
  return (
    <div className="rounded-[14px] border border-brand-lavender/80 bg-white p-5 shadow-[0_12px_28px_rgba(46,26,71,0.07)]">
      <h2 className="text-xl font-extrabold leading-7 text-brand-deep">
        Categorias
      </h2>
      <nav className="mt-4 grid gap-1.5" aria-label="Categorias de terapias">
        <CategoryLink
          active={!activeCategory}
          count={totalCount}
          href={buildHref(params, { category: undefined, page: 1 })}
          label="Todas as terapias"
        />
        {categories.map((category) => (
          <CategoryLink
            key={category.slug}
            active={activeCategory === category.slug}
            count={category.count}
            href={buildHref(params, { category: category.slug, page: 1 })}
            label={category.name}
          />
        ))}
      </nav>
    </div>
  );
}

type CategoryLinkProps = {
  active: boolean;
  count: number;
  href: string;
  label: string;
};

function CategoryLink({ active, count, href, label }: CategoryLinkProps) {
  return (
    <Link
      href={href as Route<string>}
      className={cn(
        "flex min-h-[46px] items-center gap-3 rounded-[8px] px-3 text-[0.82rem] font-extrabold transition focus:outline-none focus:ring-4 focus:ring-ring/20",
        active
          ? "bg-brand-lavenderSoft text-brand-primary"
          : "bg-white text-tesText-secondary hover:bg-brand-lavenderSoft/70 hover:text-brand-primary",
      )}
    >
      <Command className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
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
  if (next.category) query.set("category", next.category);
  if (next.sort !== "relevance") query.set("sort", next.sort);
  if (next.page > 1) query.set("page", String(next.page));

  const suffix = query.toString();
  return suffix ? `${routes.public.therapies}?${suffix}` : routes.public.therapies;
}
