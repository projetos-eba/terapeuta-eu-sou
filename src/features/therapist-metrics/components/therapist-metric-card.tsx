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

const directionStyles: Record<TherapistMetricDirection, string> = {
  down: "bg-status-dangerBg text-status-danger",
  stable: "bg-brand-lavenderSoft text-brand-primary",
  up: "bg-status-successBg text-status-success",
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
      className="grid min-h-[250px] content-between gap-6 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden={true} size={22} />
        </span>
        <p className="pt-1 text-sm font-extrabold leading-5 text-tesText-secondary">
          {label}
        </p>
      </div>

      <div>
        <p className="text-[36px] font-extrabold leading-tight text-brand-deep sm:text-[42px]">
          {formatMetricValue(
            counter.value,
            counter.unit,
            counter.status === "empty",
          )}
        </p>
        {counter.status === "empty" ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-muted">
            Ainda sem registros concluídos neste período.
          </p>
        ) : null}
      </div>

      <div className="border-t border-brand-lavender pt-4">
        <span
          className={[
            "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold",
            directionStyles[counter.direction],
          ].join(" ")}
        >
          <DirectionIcon aria-hidden={true} size={16} />
          {directionLabels[counter.direction]}
        </span>
        <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
          <span className="sr-only">Comparação: </span>
          {copy}
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-tesText-muted">
          Período anterior:{" "}
          {formatMetricValue(
            counter.previousValue,
            counter.unit,
            counter.status === "empty",
          )}
        </p>
      </div>
    </TESCard>
  );
}

export function formatMetricValue(
  value: number,
  unit: "events" | "minutes" | "people" | "sessions",
  empty = false,
) {
  if (empty) return "-";

  if (unit !== "minutes") {
    return new Intl.NumberFormat("pt-BR").format(value);
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
