import type {
  AdminFinanceDetailPageData,
  AdminFinanceDetailSection,
  AdminFinanceEvent,
  AdminFinanceField,
  AdminFinanceModuleKey,
  AdminFinanceRow,
} from "./admin-finance.types";
import { routes } from "@/lib/routes";

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
  const id = asText(row.id) || `payment-${index}`;

  return {
    detailHref: getAdminFinanceDetailHref("payments", id),
    fields: compactFields([
      field("Cliente", asText(row.patient_name)),
      field("Profissional", asText(row.therapist_name)),
      field("Forma de pagamento", formatPaymentMethod(row.payment_method_type)),
      field(
        "Atendimento",
        formatServiceStatus(
          row.service_status,
          row.financial_status,
          row.booking_status,
        ),
      ),
      field("Repasse", formatPaymentTransferStatus(row)),
      field(
        "Valor bruto",
        formatCurrency(row.gross_amount_cents, row.currency),
      ),
      field(
        "Repasse terapeuta",
        formatCurrency(row.therapist_amount_cents, row.currency),
      ),
      field(
        "Compensação",
        formatPositiveCurrency(row.debt_offset_amount_cents, row.currency),
      ),
      field("Valor encaminhado", formatEffectiveTransferAmount(row)),
      field(
        "Comissão TES",
        formatCurrency(row.platform_gross_commission_cents, row.currency),
      ),
      field(
        "Taxas Stripe",
        formatCurrency(row.stripe_fee_amount_cents, row.currency),
      ),
      field("Reembolso pendente", asBooleanLabel(row.refund_pending)),
      field("Revisão TES", formatFinancialReview(row.financial_review_status)),
      field("Disputa", formatDate(row.disputed_at)),
      field("Data e hora", formatDate(row.updated_at)),
    ]),
    id,
    statusLabel: asText(row.financial_status),
    subtitle: asText(row.booking_id)
      ? `Reserva ${shortId(asText(row.booking_id))}`
      : "Reserva não vinculada na listagem.",
    title: asText(row.service_title) || "Pagamento de sessão",
  } satisfies AdminFinanceRow;
}

function formatFinancialReview(value: unknown) {
  return asText(value) === "therapist_change_refund_review"
    ? "Reembolso em análise"
    : "";
}

function mapSubscriptionRow(row: UnknownRecord, index: number) {
  const id = asText(row.id) || `subscription-${index}`;
  const plan = formatPlan(row.plan_code);

  return {
    detailHref: getAdminFinanceDetailHref("subscriptions", id),
    fields: compactFields([
      field("Plano", plan),
      field("Terapeuta", asText(row.therapist_name)),
      field("Plano no perfil", formatPlan(row.therapist_current_plan)),
      field(
        "Ciclo atual",
        formatPeriod(row.current_period_start, row.current_period_end),
      ),
      field("Cancelamento futuro", asBooleanLabel(row.cancel_at_period_end)),
      field("Faturas", formatCount(row.invoice_count)),
      field("Última fatura", asText(row.latest_invoice_status)),
      field("Cancelada em", formatDate(row.canceled_at)),
      field("Encerrada em", formatDate(row.ended_at)),
      field("Atualizada", formatDate(row.updated_at)),
    ]),
    id,
    statusLabel: asText(row.status),
    subtitle:
      "O plano exibido deve refletir uma confirmação financeira válida.",
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

export function mapAdminFinanceDetail({
  events,
  generatedAt,
  module,
  record,
}: {
  events: unknown[];
  generatedAt: string;
  module: Extract<AdminFinanceModuleKey, "payments" | "subscriptions">;
  record: UnknownRecord;
}): AdminFinanceDetailPageData {
  const id = asText(record.id);
  const row = mapAdminFinanceRows({ module, rows: [record] })[0];

  return {
    backHref:
      module === "payments"
        ? routes.admin.payments
        : routes.admin.subscriptions,
    events: events
      .filter(isRecord)
      .map((event) => mapFinanceEvent(event, record)),
    generatedAt,
    id,
    module,
    safetyNotes: getDetailSafetyNotes(module),
    sections: getDetailSections(module, record),
    statusLabel: row?.statusLabel,
    subtitle: row?.subtitle,
    title: row?.title ?? getFallbackDetailTitle(module, id),
  };
}

function getDetailSections(
  module: Extract<AdminFinanceModuleKey, "payments" | "subscriptions">,
  record: UnknownRecord,
): AdminFinanceDetailSection[] {
  if (module === "payments") {
    return [
      section("Pagamento", [
        field("Pagamento local", asText(record.id)),
        field("Reserva", asText(record.booking_id)),
        field("Status financeiro", asText(record.financial_status)),
        field(
          "Status do atendimento",
          formatServiceStatus(
            record.service_status,
            record.financial_status,
            record.booking_status,
          ),
        ),
        field("Repasse", formatPaymentTransferStatus(record)),
        field("Bloqueio de repasse", asText(record.transfer_blocked_reason)),
      ]),
      section("Valores", [
        field(
          "Valor bruto",
          formatCurrency(record.gross_amount_cents, record.currency),
        ),
        field(
          "Repasse terapeuta",
          formatCurrency(record.therapist_amount_cents, record.currency),
        ),
        field(
          "Compensação",
          formatPositiveCurrency(
            record.debt_offset_amount_cents,
            record.currency,
          ),
        ),
        field("Valor encaminhado", formatEffectiveTransferAmount(record)),
        field(
          "Custos da plataforma",
          formatCurrency(
            record.platform_gross_commission_cents,
            record.currency,
          ),
        ),
        field(
          "Taxas da plataforma",
          formatCurrency(record.stripe_fee_amount_cents, record.currency),
        ),
        field(
          "Valor líquido",
          formatCurrency(record.stripe_net_amount_cents, record.currency),
        ),
      ]),
      section("Participantes e sessão", [
        field("Terapeuta", asText(record.therapist_name)),
        field("Perfil terapeuta", asText(record.therapist_profile_id)),
        field("Cliente", asText(record.patient_name)),
        field("Perfil cliente", asText(record.patient_profile_id)),
        field("Serviço", asText(record.service_title)),
        field("Início", formatDate(record.starts_at)),
        field("Término", formatDate(record.ends_at)),
      ]),
      section("Conciliação segura", [
        field(
          "Pagamento iniciado",
          asBooleanLabel(record.has_checkout_session),
        ),
        field(
          "Tentativa de pagamento registrada",
          asBooleanLabel(record.has_payment_intent),
        ),
        field("Cobrança registrada", asBooleanLabel(record.has_charge)),
        field(
          "Movimentação registrada",
          asBooleanLabel(record.has_balance_transaction),
        ),
        field("Última confirmação", formatDate(record.stripe_event_created_at)),
        field(
          "Informações adicionais presentes",
          asBooleanLabel(record.metadata_present),
        ),
      ]),
      section("Risco e repasse", [
        field("Reembolso pendente", asBooleanLabel(record.refund_pending)),
        field("Reembolsos", formatCount(record.refund_count)),
        field(
          "Valor reembolsado",
          formatCurrency(record.refunded_amount_cents, record.currency),
        ),
        field("Disputas", formatCount(record.dispute_count)),
        field("Transferências", formatCount(record.transfer_count)),
        field("Lançamentos", formatCount(record.ledger_entry_count)),
        field("Elegível em", formatDate(record.eligible_at)),
        field(
          "Pago ao banco em",
          formatBankDate(record.bank_paid_date) ||
            formatDate(record.bank_paid_at),
        ),
      ]),
      timestampSection(record),
    ];
  }

  return [
    section("Assinatura", [
      field("Assinatura local", asText(record.id)),
      field("Terapeuta", asText(record.therapist_name)),
      field("Perfil terapeuta", asText(record.therapist_profile_id)),
      field("Plano", formatPlan(record.plan_code)),
      field("Plano no perfil", formatPlan(record.therapist_current_plan)),
      field("Status", asText(record.status)),
    ]),
    section("Ciclo e preço", [
      field(
        "Ciclo atual",
        formatPeriod(record.current_period_start, record.current_period_end),
      ),
      field("Valor", formatCurrency(record.unit_amount_cents, record.currency)),
      field("Intervalo", asText(record.interval)),
      field("Cancelar no fim", asBooleanLabel(record.cancel_at_period_end)),
      field("Cancelada em", formatDate(record.canceled_at)),
      field("Encerrada em", formatDate(record.ended_at)),
    ]),
    section("Conciliação segura", [
      field("Conta vinculada", asBooleanLabel(record.customer_linked)),
      field("Contexto da conta", asText(record.customer_environment)),
      field("Conta ativa", asBooleanLabel(record.customer_livemode)),
      field(
        "E-mail da conta presente",
        asBooleanLabel(record.customer_email_present),
      ),
      field(
        "Assinatura confirmada",
        asBooleanLabel(record.has_subscription_reference),
      ),
      field("Pagamento iniciado", asBooleanLabel(record.has_checkout_session)),
      field(
        "Última fatura recebida",
        asBooleanLabel(record.has_latest_invoice_reference),
      ),
      field("Última confirmação", formatDate(record.stripe_event_created_at)),
      field(
        "Informações adicionais presentes",
        asBooleanLabel(record.metadata_present),
      ),
    ]),
    section("Faturas e eventos", [
      field("Faturas", formatCount(record.invoice_count)),
      field("Faturas abertas", formatCount(record.open_invoice_count)),
      field("Faturas pagas", formatCount(record.paid_invoice_count)),
      field("Eventos de assinatura", formatCount(record.event_count)),
    ]),
    timestampSection(record),
  ];
}

function compactFields(fields: Array<AdminFinanceField | null>) {
  return fields.filter(Boolean) as AdminFinanceField[];
}

function section(
  title: string,
  fields: Array<AdminFinanceField | null>,
  description?: string,
): AdminFinanceDetailSection {
  return {
    description,
    fields: compactFields(fields),
    title,
  };
}

function timestampSection(record: UnknownRecord) {
  return section("Rastreabilidade", [
    field("Criado em", formatDate(record.created_at)),
    field("Atualizado em", formatDate(record.updated_at)),
    field("Pagamento confirmado em", formatDate(record.paid_at)),
    field("Falhou em", formatDate(record.failed_at)),
    field("Cancelado em", formatDate(record.canceled_at)),
  ]);
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

export function formatTransferStatus(value: unknown) {
  const status = asText(value).trim().toLowerCase();

  if (!status) return "";

  const labels: Record<string, string> = {
    batched: "Em processamento",
    blocked: "Bloqueado",
    eligible: "Disponível para repasse",
    failed: "Falhou",
    not_eligible: "Ainda não elegível",
    reversed: "Repasse revertido",
    transfer_pending: "Em processamento",
    transferred: "Processando",
    waiting_confirmation: "Aguardando confirmação",
    waiting_safety_period: "Em liquidação",
    waiting_settlement: "Em liquidação",
  };

  return labels[status] ?? "Situação do repasse não identificada";
}

function formatPaymentTransferStatus(record: UnknownRecord) {
  const financialStatus = asText(record.financial_status).trim().toLowerCase();
  const transferStatus = asText(record.transfer_status).trim().toLowerCase();
  const payoutDisplayStatus = asText(record.payout_display_status)
    .trim()
    .toLowerCase();

  const payoutLabels: Record<string, string> = {
    bank_pending: "A caminho do banco",
    compensated: "Compensado",
    compensation_pending: "Valor a compensar",
    failed: "Falhou",
    needs_review: "Em análise",
    paid: "Pago",
    processing: "Processando",
    refunded: "Repasse encerrado",
    reversed: "Repasse revertido",
  };

  if (payoutDisplayStatus && payoutLabels[payoutDisplayStatus]) {
    return payoutLabels[payoutDisplayStatus];
  }

  if (financialStatus === "refunded") {
    if (transferStatus === "reversed") return "Repasse revertido";
    if (transferStatus === "transferred") return "Valor a compensar";
    return "Repasse encerrado";
  }

  return formatTransferStatus(transferStatus);
}

function formatServiceStatus(
  value: unknown,
  financialStatus: unknown,
  bookingStatus?: unknown,
) {
  if (asText(financialStatus).trim().toLowerCase() === "refunded") {
    return "Encerrado";
  }

  const booking = asText(bookingStatus).trim().toLowerCase();
  const bookingLabels: Record<string, string> = {
    cancelled_by_payment: "Cancelado",
    cancelled_by_patient: "Cancelado",
    cancelled_by_therapist: "Cancelado",
    completed: "Concluído",
    no_show_both: "Não realizado",
    no_show_patient: "Não realizado",
    no_show_therapist: "Não realizado",
    payment_cancelled: "Cancelado",
    refunded: "Encerrado",
  };

  if (bookingLabels[booking]) return bookingLabels[booking];

  const status = asText(value).trim().toLowerCase();
  const labels: Record<string, string> = {
    canceled: "Cancelado",
    completed: "Concluído",
    not_performed: "Não realizado",
    refunded: "Encerrado",
    scheduled: "Agendado",
  };
  return labels[status] ?? asText(value);
}

function formatCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("pt-BR").format(value);
  }

  return "";
}

function formatPlan(value: unknown) {
  if (value === "premium_plus") return "Premium Plus";
  if (value === "premium") return "Premium";
  if (value === "free") return "Free";

  return asText(value);
}

function formatPaymentMethod(value: unknown) {
  const normalized = asText(value).trim().toLowerCase();
  const labels: Record<string, string> = {
    boleto: "Boleto",
    card: "Cartão",
    card_present: "Cartão",
    pix: "Pix",
  };

  return labels[normalized] ?? "";
}

function formatCurrency(amount: unknown, currency: unknown) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "";
  const currencyCode =
    typeof currency === "string" && currency ? currency : "BRL";

  return new Intl.NumberFormat("pt-BR", {
    currency: currencyCode.toUpperCase(),
    style: "currency",
  }).format(amount / 100);
}

function formatPositiveCurrency(amount: unknown, currency: unknown) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return formatCurrency(amount, currency);
}

function formatEffectiveTransferAmount(record: UnknownRecord) {
  if (
    typeof record.transfer_effective_amount_cents !== "number" ||
    !Number.isFinite(record.transfer_effective_amount_cents)
  ) {
    return "";
  }

  return formatCurrency(
    record.transfer_effective_amount_cents,
    record.currency,
  );
}

function formatPeriod(start: unknown, end: unknown) {
  const formattedStart = formatDate(start);
  const formattedEnd = formatDate(end);

  if (formattedStart && formattedEnd)
    return `${formattedStart} até ${formattedEnd}`;
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

function formatBankDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function shortId(value: string) {
  return value ? value.slice(0, 8) : "";
}

function getAdminFinanceDetailHref(
  module: Extract<AdminFinanceModuleKey, "payments" | "subscriptions">,
  id: string,
) {
  if (!id) return undefined;
  if (module === "payments") return routes.admin.paymentDetail(id);

  return routes.admin.subscriptionDetail(id);
}

function getFallbackDetailTitle(
  module: Extract<AdminFinanceModuleKey, "payments" | "subscriptions">,
  id: string,
) {
  return module === "payments"
    ? `Pagamento ${shortId(id)}`
    : `Assinatura ${shortId(id)}`;
}

function getDetailSafetyNotes(
  module: Extract<AdminFinanceModuleKey, "payments" | "subscriptions">,
) {
  if (module === "payments") {
    return [
      "A devolução integral de uma sessão requer decisão registrada e conferência do resultado.",
      "Identificadores externos e dados sensíveis ficam fora da interface.",
      "Qualquer mudança financeira precisa de uma ação autorizada e conferida.",
    ];
  }

  return [
    "O plano só deve mudar após confirmação financeira autorizada.",
    "A página não ativa, cancela ou altera assinatura por parâmetro de URL ou ação visual.",
    "IDs externos, invoice URL, PDF e metadados brutos não são carregados no DTO.",
  ];
}

function mapFinanceEvent(
  event: UnknownRecord,
  record: UnknownRecord,
): AdminFinanceEvent {
  const kind = asText(event.kind);
  const currency = asText(event.currency) || asText(record.currency);
  const amountLabel = formatEventAmount(event, currency);

  if (kind === "ledger_entry") {
    return {
      amountLabel,
      createdAt: asText(event.occurred_at) || asText(event.recorded_at),
      id: asText(event.id),
      kind,
      subtitle:
        asText(event.direction) === "credit"
          ? "Entrada registrada"
          : "Saída registrada",
      title: financialEventLabel(asText(event.entry_type)),
    };
  }

  if (kind === "invoice") {
    return {
      amountLabel,
      createdAt: asText(event.created_at),
      id: asText(event.id),
      kind,
      subtitle: `Pago em ${formatDate(event.paid_at) || "não informado"} · vencimento ${formatDate(event.due_at) || "não informado"}`,
      title: `Fatura ${asText(event.status) || "sem status"}`,
    };
  }

  return {
    createdAt: asText(event.created_at),
    id: asText(event.id),
    kind,
    subtitle: `${formatPlan(event.previous_plan)} → ${formatPlan(event.next_plan)}`,
    title: asText(event.event_type) || "Evento de assinatura",
  };
}

function financialEventLabel(code: string) {
  const labels: Record<string, string> = {
    session_gross_payment: "Pagamento da sessão",
    therapist_payable: "Valor destinado ao profissional",
    platform_gross_commission: "Parcela da plataforma",
    stripe_fee: "Taxa de processamento",
    refund: "Devolução ao cliente",
    adjustment: "Ajuste financeiro",
    transfer: "Valor encaminhado ao profissional",
    transfer_reversal: "Valor recuperado do profissional",
    dispute: "Pagamento contestado",
    loss: "Perda registrada",
    recovery: "Valor recuperado",
    subscription_revenue: "Receita de assinatura",
    therapist_debt: "Valor a compensar",
    therapist_debt_offset: "Compensação aplicada",
  };
  return labels[code] ?? "Movimentação financeira";
}

function formatEventAmount(event: UnknownRecord, currency: string) {
  const amount =
    typeof event.amount_cents === "number"
      ? event.amount_cents
      : typeof event.amount_paid_cents === "number"
        ? event.amount_paid_cents
        : typeof event.amount_due_cents === "number"
          ? event.amount_due_cents
          : null;

  return amount === null ? undefined : formatCurrency(amount, currency);
}
