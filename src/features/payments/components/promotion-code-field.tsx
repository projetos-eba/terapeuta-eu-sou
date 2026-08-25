"use client";

import { CheckCircle2, Loader2, Tag, X } from "lucide-react";
import type { FormEvent } from "react";

import type {
  PromotionCheckoutAmounts,
  PromotionSummary,
} from "../promotion-code";

export function PromotionCodeField({
  amounts,
  appliedPromotion,
  disabled,
  error,
  isLoading,
  onApply,
  onChange,
  onRemove,
  value,
}: {
  amounts?: PromotionCheckoutAmounts | null;
  appliedPromotion?: PromotionSummary | null;
  disabled?: boolean;
  error?: string | null;
  isLoading?: boolean;
  onApply: () => void;
  onChange: (value: string) => void;
  onRemove: () => void;
  value: string;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disabled && !isLoading && value.trim()) onApply();
  }

  return (
    <div className="space-y-3">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
        <label className="sr-only" htmlFor="tes-promotion-code">
          Código promocional
        </label>
        <div className="relative min-w-0 flex-1">
          <Tag
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-primary"
          />
          <input
            id="tes-promotion-code"
            autoComplete="off"
            className="min-h-11 w-full rounded-2xl border border-brand-lavender bg-white py-2.5 pl-10 pr-3 text-sm font-semibold uppercase text-brand-deep outline-none transition placeholder:normal-case placeholder:text-tesText-muted focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:cursor-not-allowed disabled:bg-surface-soft disabled:opacity-70"
            disabled={disabled || isLoading || Boolean(appliedPromotion)}
            inputMode="text"
            maxLength={500}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Digite seu código"
            value={value}
          />
        </div>
        {appliedPromotion ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-brand-primary/30 bg-white px-4 py-2.5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || isLoading}
            onClick={onRemove}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <X className="size-4" aria-hidden="true" />
            )}
            Remover
          </button>
        ) : (
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-brand-primary px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || isLoading || !value.trim()}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Aplicar
          </button>
        )}
      </form>

      <div aria-live="polite" aria-atomic="true" className="min-h-5">
        {error ? (
          <p className="text-sm font-semibold leading-5 text-status-danger">
            {error}
          </p>
        ) : appliedPromotion ? (
          <p className="flex items-center gap-2 text-sm font-bold text-status-success">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Código aplicado
          </p>
        ) : null}
      </div>

      {amounts && amounts.discountAmountCents > 0 ? (
        <dl className="space-y-2 border-t border-brand-lavender pt-3 text-sm">
          <AmountRow
            label="Subtotal"
            value={formatMoney(amounts.originalAmountCents, amounts.currency)}
          />
          <AmountRow
            discount
            label="Desconto"
            value={`− ${formatMoney(amounts.discountAmountCents, amounts.currency)}`}
          />
          <AmountRow
            emphasized
            label="Total"
            value={formatMoney(amounts.totalAmountCents, amounts.currency)}
          />
        </dl>
      ) : null}
    </div>
  );
}

function AmountRow({
  discount,
  emphasized,
  label,
  value,
}: {
  discount?: boolean;
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        emphasized ? "font-extrabold text-brand-deep" : "font-semibold"
      } ${discount ? "text-status-success" : "text-tesText-secondary"}`}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    currency: currency.toUpperCase(),
    style: "currency",
  }).format(amountCents / 100);
}
