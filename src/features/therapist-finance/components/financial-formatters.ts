import type {
  FinancialMetricComparison,
  TherapistFinancialStatus,
  TherapistPayoutStatus,
  TherapistReceiptStatus,
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
  TherapistReceiptStatus,
  FinancialReceiptCopy
> = {
  bank_pending: receiptCopy(
    "A caminho do banco",
    "O Transfer foi concluído e aguarda o Payout bancário.",
  ),
  blocked: receiptCopy(
    "Recebimentos bloqueados",
    "Estes valores precisam de uma análise antes de seguir.",
  ),
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
      "Veja os valores já depositados por Payout pago e integralmente conciliado.",
    emptyDescription:
      "Não há recebimentos pagos neste período. Tente outro período ou limpe os filtros.",
    emptyTitle: "Nenhum recebimento pago encontrado",
    title: "Recebimentos pagos",
  },
  eligible: receiptCopy(
    "Elegíveis para o próximo repasse",
    "Estes valores já atendem a todas as regras e aguardam o lote semanal.",
  ),
  payout_processing: receiptCopy(
    "Repasses em processamento",
    "Estes valores já entraram em lote ou têm Transfer em andamento.",
  ),
  receivable: receiptCopy(
    "Valores a receber",
    "Sessões futuras pagas que ainda vão cumprir as etapas do repasse.",
  ),
  refunded: {
    description:
      "Veja cada recebimento, a sessão e a forma de pagamento. O valor foi devolvido ao cliente.",
    emptyDescription:
      "Não há recebimentos reembolsados neste período. Tente outro período ou limpe os filtros.",
    emptyTitle: "Nenhum recebimento reembolsado encontrado",
    title: "Recebimentos reembolsados",
  },
  reversed: receiptCopy(
    "Repasses revertidos",
    "Estes valores tiveram o Transfer revertido e precisam de conferência.",
  ),
  waiting_confirmation: receiptCopy(
    "Aguardando confirmação",
    "Sessões pagas que ainda aguardam a confirmação da realização.",
  ),
  waiting_safety_period: receiptCopy(
    "Em liquidação",
    "Pagamento confirmado aguardando a disponibilização do saldo pela Stripe.",
  ),
  waiting_settlement: receiptCopy(
    "Em liquidação",
    "A Stripe ainda não disponibilizou estes valores para repasse.",
  ),
};

function receiptCopy(title: string, description: string): FinancialReceiptCopy {
  return {
    description,
    emptyDescription: `Não há ${title.toLocaleLowerCase("pt-BR")} neste período. Tente outro período ou limpe os filtros.`,
    emptyTitle: `Nenhum item em ${title.toLocaleLowerCase("pt-BR")}`,
    title,
  };
}

export const receiptStatusLabels: Record<TherapistReceiptStatus, string> = {
  bank_pending: "A caminho do banco",
  blocked: "Bloqueado",
  canceled: "Cancelado",
  disputed: "Contestado",
  eligible: "Elegível para o próximo repasse",
  failed: "Falhou",
  paid: "Pago",
  payout_processing: "Repasse em processamento",
  receivable: "A receber",
  refunded: "Reembolsado",
  reversed: "Revertido",
  waiting_confirmation: "Aguardando confirmação",
  waiting_safety_period: "Em liquidação",
  waiting_settlement: "Em liquidação",
};

export const payoutStatusLabels: Record<TherapistPayoutStatus, string> = {
  bank_pending: "A caminho do banco",
  batched: "Incluído no próximo repasse",
  blocked: "Bloqueado",
  eligible: "Disponível",
  failed: "Falhou",
  paid: "Pago",
  reversed: "Estornado",
  transferred: "Transferido",
  transfer_pending: "Processando",
  waiting_confirmation: "Aguardando confirmação",
  waiting_safety_period: "Em liquidação",
  waiting_settlement: "Em liquidação",
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
