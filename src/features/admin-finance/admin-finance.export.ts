import type { AdminFinancePageData } from "./admin-finance.types";

type CsvCell = number | string | null | undefined;
type CsvRows = CsvCell[][];

export function buildAdminFinanceCsv({
  data,
  generatedAt = new Date(),
}: {
  data: AdminFinancePageData;
  generatedAt?: Date;
}) {
  const rows: CsvRows = [
    [data.title === "Assinaturas" ? "Relatório de assinaturas" : "Relatório financeiro"],
    ["Visão organizada do período selecionado"],
    [],
    ["Informações do relatório"],
    ["Período", periodLabel(data.query)],
    ["Data de geração", formatDateTime(generatedAt)],
    ["Fuso horário", "América/São Paulo"],
    [],
  ];

  appendSection(rows, "Resumo das métricas");
  rows.push(["Indicador", "Valor", "Situação"]);
  data.metrics.forEach((metric) => {
    rows.push([
      metric.label,
      isAmountMetric(metric.key) ? formatCurrency(metric.value) : metric.value ?? "Sem dados suficientes",
      metric.status === "available" ? "Disponível" : "Sem dados suficientes",
    ]);
  });

  appendSection(
    rows,
    data.title === "Assinaturas" ? "Assinaturas do período" : "Transações do período",
  );
  const fieldLabels = fieldLabelsFor(data.title);
  rows.push(["Situação", ...fieldLabels]);
  if (data.rows.length === 0) {
    rows.push(["Sem registros no período"]);
  } else {
    data.rows.forEach((row) => {
      const fields = new Map(row.fields.map((field) => [field.label, field.value]));
      rows.push([
        statusLabel(row.statusLabel),
        ...fieldLabels.map((label) => fields.get(label) ?? "Não informado"),
      ]);
    });
  }

  appendSection(rows, "Indicadores complementares");
  rows.push(["Indicador", "Observação"]);
  rows.push(
    [
      "Total de registros",
      `${data.page.total} registro(s) corresponde(m) aos filtros selecionados.`,
    ],
    [
      "Leitura do relatório",
      "Valores e situações refletem a consulta realizada no momento da geração.",
    ],
  );

  return serializeCsv(rows);
}

function appendSection(rows: CsvRows, title: string) {
  rows.push([], [title]);
}

function fieldLabelsFor(title: string) {
  return title === "Assinaturas"
    ? ["Terapeuta", "Plano atual", "Início do ciclo", "Próxima cobrança", "Última cobrança"]
    : ["Data e hora", "Atendimento", "Cliente", "Profissional", "Forma de pagamento", "Valor bruto", "Repasse terapeuta", "Comissão TES", "Taxas Stripe", "Repasse"];
}

function isAmountMetric(key: string) {
  return key.endsWith("-amount") || key.endsWith("-amount-cents");
}

function periodLabel(query: AdminFinancePageData["query"]) {
  if (query.period === "custom" && query.start && query.end) {
    return `${formatLocalDate(query.start)} a ${formatLocalDate(query.end)}`;
  }
  const labels: Record<string, string> = {
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias",
  };
  return labels[query.period ?? "30d"] ?? "Período selecionado";
}

function statusLabel(value: string | undefined) {
  const labels: Record<string, string> = {
    active: "Ativa",
    canceled: "Cancelada",
    failed: "Falhou",
    incomplete: "Incompleta",
    paid: "Confirmado",
    partially_refunded: "Reembolso parcial",
    past_due: "Em atraso",
    pending: "Pendente",
    processing: "Em processamento",
    refunded: "Reembolsado",
    trialing: "Período de avaliação",
    unpaid: "Inadimplente",
  };
  return value ? (labels[value] ?? value) : "Não informado";
}

function formatCurrency(cents: number | null) {
  if (typeof cents !== "number" || !Number.isFinite(cents)) {
    return "Sem dados suficientes";
  }
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(cents / 100);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(value);
}

function formatLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
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
