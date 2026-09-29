import { NextResponse } from "next/server";

import { canUseTherapistCapability } from "@/domain/tes";
import { getTherapistFinancePage } from "@/features/therapist-finance/therapist-finance.service";
import { buildTherapistFinanceCsv } from "@/features/therapist-finance/therapist-finance.export";
import { resolveTherapistFinanceDateRange } from "@/features/therapist-finance/therapist-finance-date-range";
import type { TherapistFinanceFilters } from "@/features/therapist-finance/therapist-finance.types";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const correlationId = crypto.randomUUID();
  const url = new URL(request.url);
  const session = await requireTherapistSession(therapistRoutePolicies.finance);
  const dateRange = resolveTherapistFinanceDateRange(
    url.searchParams.get("period") ?? undefined,
    url.searchParams.get("start") ?? undefined,
    url.searchParams.get("end") ?? undefined,
  );

  const result = await getTherapistFinancePage({
    accessToken: session.accessToken,
    dateRange,
    filters: parseFilters(url.searchParams),
    includeAdvancedFinancials: canUseTherapistCapability(
      session.plan,
      "advanced_financials",
    ),
    includeMetrics: canUseTherapistCapability(session.plan, "advanced_metrics"),
    plan: session.plan,
    profileId: session.profileId,
  });

  if (result.status === "error") {
    return NextResponse.json(
      { message: "Não foi possível preparar o relatório agora.", ok: false },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  const csv = buildTherapistFinanceCsv({
    overview: result.data.overview,
    payouts: result.data.payouts,
    receipts: result.data.receipts,
  });

  return new NextResponse(csv, {
    headers: {
      ...noStoreHeaders,
      "Content-Disposition": `attachment; filename="tes-financeiro-${dateRange.start}-${dateRange.end}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Correlation-Id": correlationId,
    },
    status: 200,
  });
}

function parseFilters(params: URLSearchParams): TherapistFinanceFilters {
  const status = params.get("status");
  const agendaDays = Number.parseInt(params.get("agendaDays") ?? "15", 10);
  const page = 84;

  return {
    agendaDays: agendaDays === 7 || agendaDays === 30 ? agendaDays : 15,
    page,
    payoutStatus: null,
    search: cleanText(params.get("q")),
    status: isReceiptStatus(status) ? status : null,
    therapyId: isUuid(params.get("therapyId")) ? params.get("therapyId") : null,
  };
}

function cleanText(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
}

function isReceiptStatus(value: string | null): value is TherapistFinanceFilters["status"] {
  return Boolean(
    value &&
      [
        "approved",
        "canceled",
        "failed",
        "processing",
        "refunded",
        "scheduled",
        "under_review",
      ].includes(value),
  );
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}
