import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  mapTherapistInterestMetrics,
  mapTherapistSessionMetrics,
} from "@/features/therapist-metrics/therapist-metrics.detail-mappers";
import { TherapistMetricsError } from "@/features/therapist-metrics/therapist-metrics.errors";
import { buildTherapistMetricsCsv } from "@/features/therapist-metrics/therapist-metrics.export";
import { mapTherapistMetricsOverview } from "@/features/therapist-metrics/therapist-metrics.mappers";
import {
  queryTherapistInterestMetrics,
  queryTherapistMetricsOverview,
  queryTherapistSessionMetrics,
} from "@/features/therapist-metrics/therapist-metrics.queries";
import type {
  TherapistMetricsPeriodDays,
  TherapistMetricsTab,
} from "@/features/therapist-metrics/therapist-metrics.types";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const correlationId = crypto.randomUUID();
  const url = new URL(request.url);
  const tab = parseTab(url.searchParams.get("tab"));
  const periodDays = parsePeriod(url.searchParams.get("period"));

  if (!tab || !periodDays) {
    return failure(
      "Escolha uma visão e um período válidos para exportar.",
      422,
      "VALIDATION_ERROR",
      correlationId,
    );
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;
  if (!accessToken) {
    return failure(
      "Entre na sua conta para exportar o relatório.",
      401,
      "SESSION_EXPIRED",
      correlationId,
    );
  }

  try {
    const data =
      tab === "sessions"
        ? mapTherapistSessionMetrics(
            await queryTherapistSessionMetrics(accessToken, periodDays),
          )
        : tab === "interest"
          ? mapTherapistInterestMetrics(
              await queryTherapistInterestMetrics(accessToken, periodDays),
            )
          : mapTherapistMetricsOverview(
              await queryTherapistMetricsOverview(accessToken, periodDays),
            );
    const csv = buildTherapistMetricsCsv({ data, tab });

    return new NextResponse(csv, {
      headers: {
        ...noStoreHeaders,
        "Content-Disposition": `attachment; filename="tes-metricas-${tab}-${periodDays}d.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Correlation-Id": correlationId,
      },
      status: 200,
    });
  } catch (error) {
    const code =
      error instanceof TherapistMetricsError
        ? error.code
        : error instanceof Error && error.message === "CAPABILITY_NOT_ALLOWED"
          ? "forbidden"
          : "unavailable";

    console.error(
      JSON.stringify({
        category: code,
        correlationId,
        operation: "therapist_metrics_export",
        tab,
      }),
    );

    if (code === "session_expired") {
      return failure(
        "Sua sessão expirou. Entre novamente para exportar.",
        401,
        "SESSION_EXPIRED",
        correlationId,
      );
    }

    if (code === "forbidden") {
      return failure(
        "Este relatório não está disponível no seu plano.",
        403,
        "CAPABILITY_NOT_ALLOWED",
        correlationId,
      );
    }

    return failure(
      "Não foi possível preparar o relatório agora.",
      503,
      "UNAVAILABLE",
      correlationId,
    );
  }
}

function failure(
  message: string,
  status: number,
  code: string,
  correlationId: string,
) {
  return NextResponse.json(
    {
      error: {
        code,
        correlationId,
        message,
      },
      ok: false,
    },
    {
      headers: {
        ...noStoreHeaders,
        "X-Correlation-Id": correlationId,
      },
      status,
    },
  );
}

function parseTab(value: string | null): TherapistMetricsTab | null {
  if (value === "overview" || value === "sessions" || value === "interest") {
    return value;
  }
  return null;
}

function parsePeriod(value: string | null): TherapistMetricsPeriodDays | null {
  if (value === "30") return 30;
  if (value === "60") return 60;
  if (value === "90") return 90;
  if (value === "120") return 120;
  return null;
}
