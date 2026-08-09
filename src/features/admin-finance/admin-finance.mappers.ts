import type {
  AdminFinanceField,
  AdminFinanceModuleKey,
  AdminFinanceRow,
} from "./admin-finance.types";

type UnknownRecord = Record<string, unknown>;

export function mapAdminFinanceRows({
  module,
  rows,
}: {
  module: AdminFinanceModuleKey;
  rows: unknown[];
}): AdminFinanceRow[] {
  return rows.filter(isRecord).map((row, index) => {
    if (module === "subscriptions") return mapSubscriptionRow(row, index);
    if (module === "reports") return mapReportRow(row, index);

    return mapPaymentRow(row, index);
  });
}

function mapPaymentRow(row: UnknownRecord, index: number) {
  return {
    fields: compactFields([
      field("Atendimento", asText(row.service_status)),
      field("Transferência", asText(row.transfer_status)),
      field("Valor bruto", formatCurrency(row.gross_amount_cents, row.currency)),
      field("Terapeuta", formatCurrency(row.therapist_amount_cents, row.currency)),
      field(
        "Comissão TES",
        formatCurrency(row.platform_gross_commission_cents, row.currency),
      ),
      field("Reembolso pendente", asBooleanLabel(row.refund_pending)),
      field("Disputa", formatDate(row.disputed_at)),
      field("Atualizado", formatDate(row.updated_at)),
    ]),
    id: asText(row.id) || `payment-${index}`,
    statusLabel: asText(row.financial_status),
    subtitle: asText(row.booking_id)
      ? `Reserva ${shortId(asText(row.booking_id))}`
      : "Reserva não vinculada na listagem.",
    title: "Pagamento de sessão",
  } satisfies AdminFinanceRow;
}

function mapSubscriptionRow(row: UnknownRecord, index: number) {
  const plan = formatPlan(row.plan_code);

  return {
    fields: compactFields([
      field("Plano", plan),
      field("Perfil", shortId(asText(row.therapist_profile_id))),
      field("Ciclo atual", formatPeriod(row.current_period_start, row.current_period_end)),
      field("Cancelamento futuro", asBooleanLabel(row.cancel_at_period_end)),
      field("Cancelada em", formatDate(row.canceled_at)),
      field("Encerrada em", formatDate(row.ended_at)),
      field("Atualizada", formatDate(row.updated_at)),
    ]),
    id: asText(row.id) || `subscription-${index}`,
    statusLabel: asText(row.status),
    subtitle:
      "Plano local deve refletir Billing somente após webhook ou reconciliação server-side.",
    title: `Assinatura ${plan || "sem plano"}`,
  } satisfies AdminFinanceRow;
}

function mapReportRow(row: UnknownRecord, index: number) {
  return {
    fields: compactFields([
      field("Fonte", asText(row.source)),
      field("Escopo", asText(row.scope)),
      field("Exportação", asText(row.export_status)),
      field("Privacidade", asText(row.privacy)),
    ]),
    id: asText(row.id) || `report-${index}`,
    statusLabel: asText(row.status),
    subtitle: asText(row.description),
    title: asText(row.title) || "Relatório administrativo",
  } satisfies AdminFinanceRow;
}

function compactFields(fields: Array<AdminFinanceField | null>) {
  return fields.filter(Boolean) as AdminFinanceField[];
}

function field(label: string, value: string) {
  return value ? { label, value } : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function asBooleanLabel(value: unknown) {
  if (value === true) return "Sim";
  if (value === false) return "Não";

  return "";
}

function formatPlan(value: unknown) {
  if (value === "premium_plus") return "Premium Plus";
  if (value === "premium") return "Premium";
  if (value === "free") return "Free";

  return asText(value);
}

function formatCurrency(amount: unknown, currency: unknown) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "";
  const currencyCode = typeof currency === "string" && currency ? currency : "BRL";

  return new Intl.NumberFormat("pt-BR", {
    currency: currencyCode.toUpperCase(),
    style: "currency",
  }).format(amount / 100);
}

function formatPeriod(start: unknown, end: unknown) {
  const formattedStart = formatDate(start);
  const formattedEnd = formatDate(end);

  if (formattedStart && formattedEnd) return `${formattedStart} até ${formattedEnd}`;
  if (formattedStart) return `Desde ${formattedStart}`;
  if (formattedEnd) return `Até ${formattedEnd}`;

  return "";
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function shortId(value: string) {
  return value ? value.slice(0, 8) : "";
}
