import Link from "next/link";
import type { Route } from "next";
import { ArrowDownAZ, Flame, Sparkles, Star, X } from "lucide-react";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { buildHref } from "./category-filter";
import { TherapySortSelect } from "./therapy-sort-select";
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
  const firstItem =
    totalCount === 0 ? 0 : (params.page - 1) * params.pageSize + 1;
  const lastItem = Math.min(params.page * params.pageSize, totalCount);

  return (
    <section className="bg-[#FBF8FF] py-7">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-[68px]">
        <div className="-mx-5 flex snap-x snap-mandatory items-center gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {quickSorts.map((item) => {
            const Icon = item.icon;
            const active = params.sort === item.value;
            return (
              <Link
                key={item.value}
                href={
                  buildHref(params, {
                    page: 1,
                    sort: item.value,
                  }) as Route<string>
                }
                className={cn(
                  "inline-flex min-h-[50px] min-w-[172px] shrink-0 snap-start items-center justify-center gap-2 rounded-[13px] border px-5 text-sm font-extrabold shadow-[0_8px_11px_rgba(46,26,71,0.05)] transition focus:outline-none focus:ring-4 focus:ring-ring/20",
                  active
                    ? "border-2 border-brand-primary bg-brand-lavenderSoft/60 text-brand-primary"
                    : "border-[#E8E2F6] bg-white text-brand-primary hover:bg-brand-lavenderSoft",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}

          {(params.q || params.category || params.sort !== "relevance") && (
            <Link
              href={routes.public.therapies as Route<string>}
              className="inline-flex min-h-[50px] min-w-[172px] shrink-0 snap-start items-center justify-center gap-2 rounded-[13px] border border-[#E8E2F6] bg-white px-5 text-sm font-extrabold text-brand-primary shadow-[0_8px_11px_rgba(46,26,71,0.05)] transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
            >
              <X className="h-5 w-5" aria-hidden="true" />
              Limpar filtros
            </Link>
          )}
        </div>

        <div className="mt-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-[0.95rem] font-extrabold text-tesText-secondary">
            {totalCount === 0
              ? "Mostrando 0 terapias"
              : `Mostrando ${firstItem}–${lastItem} de ${totalCount} terapias`}
          </p>

          <TherapySortSelect
            action={routes.public.therapies}
            category={params.category}
            currentSort={params.sort}
            options={therapySortOptions}
            q={params.q}
          />
        </div>
      </div>
    </section>
  );
}
