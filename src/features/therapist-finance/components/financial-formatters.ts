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

export function formatCurrencyOrDash(cents: number, hasData: boolean) {
  return hasData ? formatCurrency(cents) : "-";
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

export function formatDateOnly(
  value: string | null,
  timezone = "America/Sao_Paulo",
) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
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
  if (value === null) return "Sem dados";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value)}%`;
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatIntegerOrDash(value: number, hasData: boolean) {
  return hasData ? formatInteger(value) : "-";
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

export type FinancialReceiptCopy = {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  title: string;
};

export const defaultFinancialReceiptCopy: FinancialReceiptCopy = {
  description: "Veja cada recebimento, sua sessão e a forma de pagamento.",
  emptyDescription:
    "Quando uma sessão tiver pagamento confirmado, ela aparecerá aqui.",
  emptyTitle: "Nenhum recebimento encontrado",
  title: "Recebimentos do período",
};

export const financialReceiptCopyByStatus: Record<
  TherapistFinancialStatus,
  FinancialReceiptCopy
> = {
  canceled: {
    description:
      "Veja cada recebimento, a sessão cancelada e a forma de pagamento. Essa sessão não aconteceu.",
    emptyDescription:
      "Não há recebimentos cancelados neste período. Tente outro período ou limpe os filtros.",
    emptyTitle: "Nenhum recebimento cancelado encontrado",
    title: "Recebimentos cancelados",
  },
  disputed: {
    description:
      "Veja cada recebimento, a sessão e a forma de pagamento. O pagamento está sendo analisado.",
    emptyDescription:
      "Não há recebimentos em disputa neste período. Tente outro período ou limpe os filtros.",
    emptyTitle: "Nenhum recebimento em disputa encontrado",
    title: "Recebimentos em disputa",
  },
  failed: {
    description:
      "Veja cada recebimento, a sessão e a forma de pagamento. O pagamento não foi concluído.",
    emptyDescription:
      "Não há recebimentos com falha neste período. Tente outro período ou limpe os filtros.",
    emptyTitle: "Nenhum recebimento com falha encontrado",
    title: "Recebimentos com falha",
  },
  paid: {
    description:
      "Veja cada recebimento, a sessão e a forma de pagamento. O pagamento foi confirmado.",
    emptyDescription:
      "Não há recebimentos pagos neste período. Tente outro período ou limpe os filtros.",
    emptyTitle: "Nenhum recebimento pago encontrado",
    title: "Recebimentos pagos",
  },
  partially_refunded: {
    description:
      "Veja cada recebimento, a sessão e a forma de pagamento. Parte do valor foi devolvida ao cliente.",
    emptyDescription:
      "Não há recebimentos com reembolso parcial neste período. Tente outro período ou limpe os filtros.",
    emptyTitle: "Nenhum recebimento com reembolso parcial encontrado",
    title: "Recebimentos com reembolso parcial",
  },
  pending: {
    description:
      "Veja cada recebimento, a sessão e a forma de pagamento. O pagamento ainda aguarda confirmação.",
    emptyDescription:
      "Não há recebimentos pendentes neste período. Tente outro período ou limpe os filtros.",
    emptyTitle: "Nenhum recebimento pendente encontrado",
    title: "Recebimentos pendentes",
  },
  processing: {
    description:
      "Veja cada recebimento, a sessão e a forma de pagamento. O pagamento ainda está sendo processado.",
    emptyDescription:
      "Não há recebimentos em processamento neste período. Tente outro período ou limpe os filtros.",
    emptyTitle: "Nenhum recebimento em processamento encontrado",
    title: "Recebimentos em processamento",
  },
  refunded: {
    description:
      "Veja cada recebimento, a sessão e a forma de pagamento. O valor foi devolvido ao cliente.",
    emptyDescription:
      "Não há recebimentos reembolsados neste período. Tente outro período ou limpe os filtros.",
    emptyTitle: "Nenhum recebimento reembolsado encontrado",
    title: "Recebimentos reembolsados",
  },
};

export const payoutStatusLabels: Record<TherapistPayoutStatus, string> = {
  batched: "Incluído no próximo repasse",
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
    stripe_checkout: "Pagamento online",
    unknown: "Origem não informada",
  };

  return labels[value] ?? value;
}
