import type { ReactNode } from "react";

type TooltipValue = number | string | readonly (number | string)[];

type TooltipPayloadItem = {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: TooltipValue;
};

export type TherapistChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  labelFormatter?: (value: string | number) => string;
  payload?: readonly TooltipPayloadItem[];
};

export function TherapistChartTooltip({
  active,
  label,
  labelFormatter = String,
  payload,
}: TherapistChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const items = payload
    .filter((item) => item.value !== undefined)
    .map((item) => ({
      color: item.color ?? "var(--tes-color-brand-primary)",
      label: chartItemLabel(item),
      value: formatTooltipValue(item.value),
    }));

  if (!items.length) return null;

  const title =
    label === undefined ? "Detalhes do ponto" : labelFormatter(label);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none min-w-[176px] max-w-[250px] rounded-[14px] border border-brand-lavender/80 bg-white/95 px-4 py-3 text-left shadow-[0_16px_36px_rgba(61,42,90,0.14)] backdrop-blur-sm"
      role="tooltip"
    >
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-primary">
        {title}
      </p>
      <ul className="mt-2 grid gap-2">
        {items.map((item, index) => (
          <li
            className="flex items-center gap-2 text-sm"
            key={`${item.label}-${index}`}
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full ring-2 ring-brand-lavenderSoft"
              style={{ backgroundColor: item.color }}
            />
            <span className="min-w-0 flex-1 truncate font-semibold text-tesText-secondary">
              {item.label}
            </span>
            <strong className="shrink-0 font-extrabold text-brand-deep">
              {item.value}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function chartItemLabel(item: TooltipPayloadItem) {
  const label = item.name ?? item.dataKey ?? "Valor";
  if (String(label) === "value") return "Valor";
  return String(label);
}

function formatTooltipValue(value: TooltipValue | undefined): ReactNode {
  if (value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number")
    return new Intl.NumberFormat("pt-BR").format(value);
  return value;
}
