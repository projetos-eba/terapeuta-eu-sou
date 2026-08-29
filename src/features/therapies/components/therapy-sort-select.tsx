"use client";

import type { TherapySort } from "../types";

type TherapySortOption = {
  label: string;
  value: TherapySort;
};

export function TherapySortSelect({
  action,
  theme,
  currentSort,
  options,
  q,
}: {
  action: string;
  theme?: string;
  currentSort: TherapySort;
  options: TherapySortOption[];
  q?: string;
}) {
  return (
    <form
      action={action}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      {q ? <input type="hidden" name="q" value={q} /> : null}
      {theme ? (
        <input type="hidden" name="theme" value={theme} />
      ) : null}
      <label className="sr-only" htmlFor="therapy-sort">
        Ordenar terapias
      </label>
      <select
        id="therapy-sort"
        name="sort"
        defaultValue={currentSort}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="min-h-11 w-full rounded-[12px] border border-[#E8E2F6] bg-white px-5 pr-10 text-sm font-extrabold text-brand-primary shadow-[0_8px_22px_rgba(46,26,71,0.05)] outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20 sm:w-auto"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            Ordenar por: {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}
