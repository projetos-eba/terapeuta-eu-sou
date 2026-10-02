import type {
  TherapistFinancialOverview,
  TherapistPayoutsContract,
  TherapistReceiptsContract,
} from "./therapist-finance.types";

type CsvCell = number | string | null | undefined;
type CsvRows = CsvCell[][];

export function buildTherapistFinanceCsv({
  generatedAt = new Date(),
  overview,
  payouts,
  receipts,
}: {
  generatedAt?: Date;
  overview: TherapistFinancialOverview;
  payouts: TherapistPayoutsContract;
  receipts: TherapistReceiptsContract;
}) {
  const rows: CsvRows = [
    ["Relatório financeiro"],
    ["Visão organizada dos seus recebimentos e repasses"],
    [],
    ["Informações do relatório"],
    ["Período", formatPeriod(overview.periodStart, overview.periodEnd)],
    ["Data de geração", formatDateTime(generatedAt, overview.timezone)],
    ["Fuso horário", formatTimezone(overview.timezone)],
    [],
  ];

  appendSection(rows, "Resumo financeiro");
  rows.push(["Indicador", "Valor"]);
  rows.push(
    ["Pagamentos confirmados", formatCurrency(overview.grossPaidCents)],
    ["Comissão TES", formatCurrency(overview.tesCommissionCents)],
    ["Reembolsos concluídos", formatCurrency(overview.refundedToCustomersCents)],
    ["Valor líquido", formatCurrency(overview.therapistNetCents)],
    ["Disponível para repasse", formatCurrency(overview.eligibleForPayoutCents)],
    ["A caminho da conta", formatCurrency(overview.transferredCents)],
  );

  appendSection(rows, "Recebimentos do período");
  rows.push([
    "Data da sessão",
    "Terapia",
    "Pessoa atendida",
    "Situação da cobrança",
    "Valor bruto",
    "Comissão TES",
    "Valor para você",
    "Reembolso",
  ]);
  if (receipts.items.length === 0) {
    rows.push(["Sem recebimentos no período"]);
  } else {
    receipts.items.forEach((item) => {
      rows.push([
        formatDate(item.sessionDate, receipts.filters.timezone),
        item.therapyNameSnapshot,
        item.patientDisplayName,
        chargeStatusLabel(item.chargeStatus),
        formatCurrency(item.grossAmountCents),
        formatCurrency(item.tesCommissionCents),
        formatCurrency(item.therapistNetAmountCents),
        formatCurrency(item.refundedAmountCents),
      ]);
    });
  }

  appendSection(rows, "Repasses");
  rows.push(["Situação", "Data", "Sessões", "Valor"]);
  const payoutRows = [
    ...payouts.agenda.inTransit,
    ...payouts.agenda.predicted,
    ...payouts.agenda.balanceAvailable,
    ...payouts.agenda.awaitingBankDate,
  ];
  if (payoutRows.length === 0 && payouts.historyItems.length === 0) {
    rows.push(["Sem repasses no período"]);
  } else {
    payoutRows.forEach((item) => {
      rows.push([
        payoutAgendaLabel(item.status),
        item.date ? formatLocalDate(item.date) : "Data ainda não informada",
        item.sessionCount,
        formatCurrency(item.amountCents),
      ]);
    });
    payouts.historyItems.forEach((item) => {
      rows.push([
        item.status === "received" ? "Recebido" : "Em análise",
        formatLocalDate(item.date),
        item.sessionCount,
        formatCurrency(item.amountCents),
      ]);
    });
  }

  appendSection(rows, "Indicadores complementares");
  rows.push(["Indicador", "Valor", "Observação"]);
  rows.push(
    [
      "Cobranças programadas para os próximos 30 dias",
      formatCurrency(receipts.summary.upcomingScheduled.amountCents),
      `${receipts.summary.upcomingScheduled.sessionCount} sessão(ões) com cobrança agendada`,
    ],
    [
      "Repasses previstos",
      formatCurrency(payouts.summary.expectedCents),
      "Valores previstos podem mudar até a confirmação.",
    ],
    [
      "Repasses recebidos no período",
      formatCurrency(payouts.summary.receivedCents),
      "Valores já conciliados na conta de recebimento.",
    ],
  );

  return serializeCsv(rows);
}

function appendSection(rows: CsvRows, title: string) {
  rows.push([], [title]);
}

function chargeStatusLabel(value: string) {
  const labels: Record<string, string> = {
    approved: "Confirmada",
    canceled: "Cancelada",
    failed: "Falhou",
    processing: "Em processamento",
    refunded: "Reembolsada",
    scheduled: "Programada",
    under_review: "Em análise",
  };
  return labels[value] ?? "Situação não informada";
}

function payoutAgendaLabel(value: string) {
  const labels: Record<string, string> = {
    awaiting_bank_date: "Aguardando data do banco",
    balance_schedule: "Disponível para repasse",
    in_transit: "A caminho da conta",
    predicted: "Previsto",
  };
  return labels[value] ?? "Situação não informada";
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(cents / 100);
}

function formatPeriod(start: string, end: string) {
  return `${formatLocalDate(start)} a ${formatLocalDate(end)}`;
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(value);
}

function formatLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatTimezone(value: string) {
  return value === "America/Sao_Paulo" ? "América/São Paulo" : value;
}

function serializeCsv(rows: CsvRows) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

function csvCell(value: CsvCell) {
  const text = value == null ? "" : String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (!/[;"\r\n]/.test(safeText)) return safeText;
  return `"${safeText.replaceAll('"', '""')}"`;
}
