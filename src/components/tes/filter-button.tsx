import type { ComponentType } from "react";
import { ChevronDown } from "lucide-react";

export type FilterButtonProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
};

export function FilterButton({ icon: Icon, label }: FilterButtonProps) {
  return (
    <button className="flex h-12 min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 text-sm font-extrabold text-tesText-secondary shadow-card transition hover:border-brand-lavender focus:outline-none focus:ring-4 focus:ring-ring/20">
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="size-5 shrink-0 text-brand-primary" />
        <span className="truncate">{label}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-brand-primary" />
    </button>
  );
}
