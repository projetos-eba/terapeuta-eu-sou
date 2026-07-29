import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { TESCard } from "@/components/tes";

import type {
  TherapistMetricCounter,
  TherapistMetricDirection,
} from "../therapist-metrics.types";

const directionLabels: Record<TherapistMetricDirection, string> = {
  down: "Caiu",
  stable: "Estável",
  up: "Subiu",
};

const directionIcons: Record<TherapistMetricDirection, LucideIcon> = {
  down: TrendingDown,
  stable: Minus,
  up: TrendingUp,
};

export function TherapistMetricCard<
  TUnit extends "events" | "minutes" | "people" | "sessions",
>({
  copy,
  counter,
  icon: Icon,
  label,
}: {
  copy: string;
  counter: TherapistMetricCounter<TUnit>;
  icon: LucideIcon;
  label: string;
}) {
  const DirectionIcon = directionIcons[counter.direction];

  return (
    <TESCard
      as="article"
      className="grid min-h-[228px] content-between gap-6 p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden={true} size={22} />
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-brand-cyanSoft px-3 text-sm font-extrabold text-brand-deep">
          <DirectionIcon aria-hidden={true} size={16} />
          {directionLabels[counter.direction]}
        </span>
      </div>

      <div>
        <p className="text-sm font-extrabold leading-6 text-tesText-secondary">
          {label}
        </p>
        <p className="mt-1 text-[34px] font-extrabold leading-tight text-brand-deep sm:text-[40px]">
          {formatMetricValue(counter.value, counter.unit)}
        </p>
        {counter.status === "empty" ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-muted">
            Ainda sem registros concluídos neste período.
          </p>
        ) : null}
      </div>

      <div className="border-t border-brand-lavender pt-4">
        <p className="text-sm font-semibold leading-6 text-tesText-secondary">
          {copy}
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-brand-primary">
          Período anterior:{" "}
          {formatMetricValue(counter.previousValue, counter.unit)}
        </p>
      </div>
    </TESCard>
  );
}

export function formatMetricValue(
  value: number,
  unit: "events" | "minutes" | "people" | "sessions",
) {
  if (unit !== "minutes") {
    return new Intl.NumberFormat("pt-BR").format(value);
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
