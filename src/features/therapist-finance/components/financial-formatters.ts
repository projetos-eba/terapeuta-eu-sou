import type {
  FinancialMetricComparison,
  TherapistFinancialStatus,
  TherapistPayoutStatus,
} from "../therapist-finance.types";

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(cents / 100);
}

export function formatDateTime(
  value: string | null,
  timezone = "America/Sao_Paulo",
) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(new Date(value));
}

export function formatDate(value: string | null, timezone = "UTC") {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

export function formatPeriodLabel(start: string, end: string) {
  return `${formatDate(start)} a ${formatDate(end)}`;
}

export function formatPercent(value: number | null, fractionDigits = 1) {
  if (value === null) return "Sem base";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value)}%`;
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatComparison(
  comparison: FinancialMetricComparison,
  {
    formatter,
    unit = "",
  }: {
    formatter?: (value: number) => string;
    unit?: string;
  } = {},
) {
  if (comparison.comparisonStatus === "insufficient_data") {
    return "Dados insuficientes";
  }

  if (comparison.comparisonStatus === "no_previous_data") {
    return "Sem período anterior";
  }

  if (comparison.comparisonStatus === "division_by_zero") {
    return "Período anterior zerado";
  }

  const delta = comparison.absoluteDelta ?? 0;
  const prefix = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const formattedDelta = formatter
    ? formatter(Math.abs(delta))
    : `${formatInteger(Math.abs(delta))}${unit}`;
  const percent =
    comparison.percentageDelta === null
      ? ""
      : ` · ${comparison.percentageDelta > 0 ? "+" : ""}${formatPercent(
          comparison.percentageDelta,
        )}`;

  return `${prefix}${formattedDelta}${percent}`;
}

export const financialStatusLabels: Record<TherapistFinancialStatus, string> = {
  canceled: "Cancelado",
  disputed: "Disputado",
  failed: "Falhou",
  paid: "Pago",
  partially_refunded: "Reembolso parcial",
  pending: "Pendente",
  processing: "Processando",
  refunded: "Reembolsado",
};

export const payoutStatusLabels: Record<TherapistPayoutStatus, string> = {
  batched: "Em lote",
  blocked: "Bloqueado",
  eligible: "Disponível",
  failed: "Falhou",
  reversed: "Estornado",
  transferred: "Transferido",
  transfer_pending: "Processando",
  waiting_confirmation: "Aguardando confirmação",
  waiting_safety_period: "Período de segurança",
};

export function formatPaymentMethod(value: string | null) {
  if (!value) return "Não informado";

  const labels: Record<string, string> = {
    boleto: "Boleto",
    card: "Cartão",
    pix: "Pix",
  };

  return labels[value] ?? value;
}

export function formatPaymentOrigin(value: string) {
  const labels: Record<string, string> = {
    legacy_import: "Importação legada",
    stripe_checkout: "Checkout Stripe",
    unknown: "Origem não informada",
  };

  return labels[value] ?? value;
}
