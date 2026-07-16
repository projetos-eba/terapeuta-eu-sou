import Link from "next/link";
import type { Route } from "next";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

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
    <div className="rounded-[28px] border border-brand-lavender/80 bg-white p-5 shadow-[0_18px_48px_rgba(38,20,51,0.08)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-primary">
        Categorias
      </p>
      <h2 className="mt-2 text-2xl font-extrabold text-brand-deep">
        Encontre por intenção
      </h2>
      <nav className="mt-5 grid gap-2" aria-label="Categorias de terapias">
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
        "flex min-h-12 items-center justify-between rounded-2xl px-4 text-sm font-extrabold transition focus:outline-none focus:ring-4 focus:ring-ring/20",
        active
          ? "bg-brand-primary text-white shadow-card"
          : "bg-brand-lavenderSoft/60 text-text-secondary hover:bg-brand-lavenderSoft hover:text-brand-primary",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs",
          active ? "bg-white/18 text-white" : "bg-white text-brand-primary",
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
