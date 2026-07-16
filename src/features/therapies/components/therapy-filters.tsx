import Link from "next/link";
import type { Route } from "next";
import { ArrowDownAZ, Flame, Search, Sparkles, Star, X } from "lucide-react";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { buildHref } from "./category-filter";
import { therapySortOptions } from "../schemas/therapy-search-params";
import type { TherapySearchParams, TherapySort } from "../types";

type TherapyFiltersProps = {
  params: TherapySearchParams;
  totalCount: number;
};

const quickSorts: Array<{
  icon: typeof Flame;
  label: string;
  value: TherapySort;
}> = [
  { icon: Flame, label: "Mais procuradas", value: "most_searched" },
  { icon: Star, label: "Mais populares", value: "popular" },
  { icon: Sparkles, label: "Novas terapias", value: "newest" },
  { icon: ArrowDownAZ, label: "A-Z Nome", value: "az" },
];

export function TherapyFilters({ params, totalCount }: TherapyFiltersProps) {
  return (
    <section className="border-y border-brand-lavender/70 bg-white/86 py-6 backdrop-blur">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          {quickSorts.map((item) => {
            const Icon = item.icon;
            const active = params.sort === item.value;
            return (
              <Link
                key={item.value}
                href={buildHref(params, { page: 1, sort: item.value }) as Route<string>}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-sm font-extrabold transition focus:outline-none focus:ring-4 focus:ring-ring/20",
                  active
                    ? "border-brand-primary bg-brand-primary text-white shadow-card"
                    : "border-brand-lavender bg-white text-brand-primary hover:bg-brand-lavenderSoft",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}

          {(params.q || params.category || params.sort !== "relevance") && (
            <Link
              href={routes.public.therapies as Route<string>}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-lavender bg-white px-5 text-sm font-extrabold text-text-secondary transition hover:bg-brand-lavenderSoft hover:text-brand-primary focus:outline-none focus:ring-4 focus:ring-ring/20"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Limpar filtros
            </Link>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-xl font-extrabold text-text-secondary">
            {totalCount === 1
              ? "Encontramos 1 terapia"
              : `Encontramos ${totalCount} terapias`}
          </p>

          <form action={routes.public.therapies} className="flex items-center gap-3">
            {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
            {params.category ? (
              <input type="hidden" name="category" value={params.category} />
            ) : null}
            <label className="sr-only" htmlFor="therapy-sort">
              Ordenar terapias
            </label>
            <select
              id="therapy-sort"
              name="sort"
              defaultValue={params.sort}
              className="min-h-12 rounded-full border border-brand-lavender bg-white px-5 pr-10 text-sm font-extrabold text-text-secondary shadow-card outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
            >
              {therapySortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Ordenar por: {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus:outline-none focus:ring-4 focus:ring-ring/20"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Aplicar
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
