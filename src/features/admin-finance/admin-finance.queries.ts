import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { parseContentRangeTotal } from "../admin-dashboard/admin-dashboard.utils";
import { mapAdminFinanceRows } from "./admin-finance.mappers";
import type {
  AdminFinanceMetric,
  AdminFinanceModuleKey,
  AdminFinancePageData,
  AdminFinancePageResult,
} from "./admin-finance.types";

type CountSpec = {
  description: string;
  key: string;
  label: string;
  query: string;
  source: string;
  tone: AdminFinanceMetric["tone"];
};

type ModuleSpec = {
  description: string;
  emptyMessage: string;
  metrics: CountSpec[];
  rowsFactory?: (metrics: AdminFinanceMetric[]) => unknown[];
  rowsQuery?: string;
  rowsTitle: string;
  safetyNotes: string[];
  sourceLabel: string;
  title: string;
};

const MODULES: Record<AdminFinanceModuleKey, ModuleSpec> = {
  payments: {
    description:
      "Visão financeira read-only de sessões, refunds, disputas, ledger, transfers e repasses.",
    emptyMessage: "Nenhum pagamento de sessão acessível para a sessão administrativa atual.",
    metrics: [
      metric("pending-session-payments", "Pendentes", "Aguardando autoridade financeira.", "session_payments?financial_status=eq.pending", "session_payments", "warning"),
      metric("paid-session-payments", "Pagos", "Confirmados por Stripe/webhook/reconciliação.", "session_payments?financial_status=in.(paid,partially_refunded)", "session_payments", "success"),
      metric("failed-session-payments", "Falhos", "Tentativas ou pagamentos recusados.", "session_payments?financial_status=eq.failed", "session_payments", "danger"),
      metric("pending-refunds", "Refunds pendentes", "Reembolsos ainda não finalizados.", "session_refunds?status=eq.pending", "session_refunds", "warning"),
      metric("open-disputes", "Disputas abertas", "Disputas sem fechamento.", "session_disputes?closed_at=is.null", "session_disputes", "danger"),
      metric("open-payout-batches", "Repasses abertos", "Lotes de repasse em aberto/processamento.", "payout_batches?status=in.(draft,open,processing)", "payout_batches", "info"),
      metric("ledger-entries", "Ledger", "Lançamentos financeiros auditáveis.", "financial_ledger_entries", "financial_ledger_entries", "info"),
      metric("stripe-transfers", "Transfers", "Transferências registradas sem expor IDs externos.", "stripe_transfers", "stripe_transfers", "info"),
    ],
    rowsQuery:
      "session_payments?select=id,booking_id,financial_status,service_status,transfer_status,gross_amount_cents,therapist_amount_cents,platform_gross_commission_cents,currency,refund_pending,disputed_at,updated_at&order=updated_at.desc&limit=12",
    rowsTitle: "Pagamentos recentes",
    safetyNotes: [
      "Esta página não exibe PaymentIntent, Checkout Session, Charge, Balance Transaction ou payload Stripe.",
      "Refunds, disputas e ajustes permanecem read-only até existir comando com RBAC, motivo, idempotência e auditoria.",
      "Ledger e repasses são fontes de conferência. A UI não altera lançamento financeiro diretamente.",
    ],
    sourceLabel:
      "session_payments, session_refunds, session_disputes, financial_ledger_entries, payout_batches, stripe_transfers",
    title: "Financeiro",
  },
  reports: {
    description:
      "Mapa de relatórios administrativos seguros, com exportação server-side pendente de contrato auditado.",
    emptyMessage: "Nenhuma área de relatório configurada para esta fase.",
    metrics: [
      metric("report-professionals", "Profissionais", "Base operacional de terapeutas.", "therapist_profiles", "therapist_profiles", "info"),
      metric("report-patients", "Clientes", "Base de clientes sem dados clínicos.", "patient_profiles", "patient_profiles", "info"),
      metric("report-sessions", "Sessões", "Reservas e estados operacionais.", "bookings", "bookings", "info"),
      metric("report-payments", "Pagamentos", "Pagamentos de sessão.", "session_payments", "session_payments", "info"),
      metric("report-subscriptions", "Assinaturas", "Assinaturas de terapeutas.", "therapist_subscriptions", "therapist_subscriptions", "info"),
      metric("report-stripe-failures", "Falhas Stripe", "Eventos Stripe com falha.", "stripe_webhook_events?processing_status=eq.failed", "stripe_webhook_events", "danger"),
    ],
    rowsFactory: buildReportRows,
    rowsTitle: "Relatórios disponíveis",
    safetyNotes: [
      "Exports ainda não são gerados no cliente; devem nascer server-side, paginados, auditados e protegidos contra CSV injection.",
      "Relatórios genéricos não carregam PII desnecessária, documento privado, conteúdo clínico ou payload de webhook.",
      "Falha de leitura fica indisponível e não é tratada como zero.",
    ],
    sourceLabel:
      "therapist_profiles, patient_profiles, bookings, session_payments, therapist_subscriptions",
    title: "Relatórios",
  },
  subscriptions: {
    description:
      "Acompanhe Billing de terapeutas sem editar plano local nem simular ativação de assinatura.",
    emptyMessage: "Nenhuma assinatura acessível para a sessão administrativa atual.",
    metrics: [
      metric("active-subscriptions", "Ativas", "Assinaturas active ou trialing.", "therapist_subscriptions?status=in.(trialing,active)", "therapist_subscriptions", "success"),
      metric("attention-subscriptions", "Em atenção", "Cobrança incompleta, inadimplente ou sem pagamento.", "therapist_subscriptions?status=in.(past_due,unpaid,incomplete)", "therapist_subscriptions", "warning"),
      metric("ending-subscriptions", "Cancelam no fim", "Assinaturas marcadas para cancelamento futuro.", "therapist_subscriptions?cancel_at_period_end=eq.true", "therapist_subscriptions", "warning"),
      metric("failed-invoices", "Faturas falhas", "Invoices que pedem revisão operacional.", "billing_invoices?status=in.(uncollectible,void,open)", "billing_invoices", "warning"),
      metric("active-prices", "Preços ativos", "Price IDs allowlisted no catálogo de Billing.", "billing_plan_prices?is_active=eq.true", "billing_plan_prices", "info"),
      metric("stripe-customers", "Customers", "Vínculos de customer por perfil.", "stripe_customers", "stripe_customers", "info"),
    ],
    rowsQuery:
      "therapist_subscriptions?select=id,therapist_profile_id,plan_code,status,current_period_start,current_period_end,cancel_at_period_end,canceled_at,ended_at,updated_at&order=updated_at.desc&limit=12",
    rowsTitle: "Assinaturas recentes",
    safetyNotes: [
      "A lista não expõe subscription ID, checkout session, latest invoice, invoice URL ou metadados brutos.",
      "Plano do terapeuta só deve mudar por webhook Stripe assinado ou reconciliação server-side autenticada.",
      "Eventos fora de ordem precisam convergir consultando o estado atual da Stripe antes de qualquer mudança.",
    ],
    sourceLabel:
      "therapist_subscriptions, billing_plan_prices, stripe_customers, billing_invoices",
    title: "Assinaturas",
  },
};

export const getAdminFinancePage = cache(async function getAdminFinancePage({
  accessToken,
  module,
}: {
  accessToken: string;
  module: AdminFinanceModuleKey;
}): Promise<AdminFinancePageResult> {
  const config = getSupabasePublicConfig();
  const spec = MODULES[module];

  if (!config) {
    return {
      message: "Configuração Supabase ausente para carregar este módulo.",
      status: "error",
    };
  }

  const metrics = await fetchMetrics(config, accessToken, spec.metrics);
  const rowsResult = spec.rowsQuery
    ? await fetchRows(config, accessToken, spec.rowsQuery)
    : { rows: spec.rowsFactory?.(metrics) ?? [], status: "available" as const };

  return {
    data: {
      description: spec.description,
      emptyMessage: spec.emptyMessage,
      generatedAt: new Date().toISOString(),
      metrics,
      rows: rowsResult.status === "available"
        ? mapAdminFinanceRows({ module, rows: rowsResult.rows })
        : [],
      rowsStatus: rowsResult.status,
      rowsTitle: spec.rowsTitle,
      rowsUnavailableMessage:
        rowsResult.status === "unavailable"
          ? "A leitura foi bloqueada ou falhou. Isso não é tratado como lista vazia."
          : undefined,
      safetyNotes: spec.safetyNotes,
      sourceLabel: spec.sourceLabel,
      title: spec.title,
    },
    status: "success",
  };
});

async function fetchMetrics(
  config: { apiKey: string; url: string },
  accessToken: string,
  specs: CountSpec[],
) {
  return Promise.all(
    specs.map(async (spec): Promise<AdminFinanceMetric> => {
      const value = await fetchCount(config, accessToken, spec.query);

      return {
        description: spec.description,
        key: spec.key,
        label: spec.label,
        source: spec.source,
        status: value === null ? "unavailable" : "available",
        tone: spec.tone,
        value,
      };
    }),
  );
}

async function fetchCount(
  config: { apiKey: string; url: string },
  accessToken: string,
  query: string,
) {
  try {
    const separator = query.includes("?") ? "&" : "?";
    const response = await fetch(
      `${config.url}/rest/v1/${query}${separator}select=id&limit=1`,
      {
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${accessToken}`,
          Prefer: "count=exact",
        },
      },
    );

    if (!response.ok) return null;

    return parseContentRangeTotal(response.headers.get("content-range"));
  } catch {
    return null;
  }
}

async function fetchRows(
  config: { apiKey: string; url: string },
  accessToken: string,
  query: string,
): Promise<{ rows: unknown[]; status: "available" } | { status: "unavailable" }> {
  try {
    const response = await fetch(`${config.url}/rest/v1/${query}`, {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return { status: "unavailable" };

    const rows = await response.json().catch(() => null);

    return Array.isArray(rows)
      ? { rows, status: "available" }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

function buildReportRows(metrics: AdminFinanceMetric[]) {
  return [
    reportRow("professionals", "Relatório de profissionais", "Status, publicação, plano e prontidão operacional.", "therapist_profiles", metrics),
    reportRow("patients", "Relatório de clientes", "Base de clientes com mínimo operacional, sem conteúdo clínico.", "patient_profiles", metrics),
    reportRow("sessions", "Relatório de sessões", "Reservas, estados, janelas e conciliação operacional.", "bookings", metrics),
    reportRow("payments", "Relatório financeiro", "Pagamentos, refunds, disputes, ledger e repasses.", "session_payments", metrics),
    reportRow("subscriptions", "Relatório de assinaturas", "Billing de terapeutas, planos e estados de cobrança.", "therapist_subscriptions", metrics),
  ];
}

function reportRow(
  id: string,
  title: string,
  description: string,
  source: string,
  metrics: AdminFinanceMetric[],
) {
  const hasUnavailableSource = metrics.some(
    (metricItem) =>
      metricItem.source === source && metricItem.status === "unavailable",
  );

  return {
    description,
    export_status: "Pendente de comando auditado",
    id,
    privacy: "Mínimo necessário",
    scope: "Admin read-only",
    source,
    status: hasUnavailableSource ? "Indisponível" : "Planejado",
    title,
  };
}

function metric(
  key: string,
  label: string,
  description: string,
  query: string,
  source: string,
  tone: AdminFinanceMetric["tone"],
): CountSpec {
  return {
    description,
    key,
    label,
    query,
    source,
    tone,
  };
}
