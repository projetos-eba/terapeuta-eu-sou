import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  parsePublicMetricEventBatch,
  PublicMetricEventContractError,
} from "@/features/public-metrics";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const knownBotPattern =
  /bot|crawler|spider|preview|facebookexternalhit|slurp|bingpreview/i;

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!userAgent || knownBotPattern.test(userAgent)) {
    return NextResponse.json(
      { accepted: false, status: "ignored" },
      { headers: noStoreHeaders, status: 202 },
    );
  }

  let payload: ReturnType<typeof parsePublicMetricEventBatch>;

  try {
    payload = parsePublicMetricEventBatch(await request.json());
  } catch (error) {
    const message =
      error instanceof PublicMetricEventContractError
        ? "Evento de produto inválido."
        : "Envie os dados em formato válido.";
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message } },
      { headers: noStoreHeaders, status: 422 },
    );
  }

  const config = getSupabasePublicConfig();
  if (!config) {
    return unavailable("configuration_missing");
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/rpc/record_public_therapist_metric_events_v1`,
      {
        body: JSON.stringify({
          p_events: payload.events,
          p_session_id: payload.sessionId,
        }),
        cache: "no-store",
        headers: {
          apikey: config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      const rpcBody = (await response.json().catch(() => null)) as unknown;
      const message =
        isRecord(rpcBody) && typeof rpcBody.message === "string"
          ? rpcBody.message
          : "";

      if (message === "VALIDATION_ERROR") {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Evento de produto inválido.",
            },
          },
          { headers: noStoreHeaders, status: 422 },
        );
      }

      if (message === "RATE_LIMITED") {
        return NextResponse.json(
          { accepted: false, status: "rate_limited" },
          { headers: noStoreHeaders, status: 202 },
        );
      }

      return unavailable("query_failed");
    }

    const result = (await response.json()) as unknown;
    const status =
      isRecord(result) && typeof result.status === "string"
        ? result.status
        : "accepted";

    return NextResponse.json(
      {
        accepted: status === "accepted",
        status,
      },
      { headers: noStoreHeaders, status: 202 },
    );
  } catch {
    return unavailable("query_failed");
  }
}

function unavailable(category: "configuration_missing" | "query_failed") {
  const correlationId = randomUUID();
  console.error(
    JSON.stringify({
      category,
      correlationId,
      event: "public_metric_ingestion_failed",
      operation: "record_public_therapist_metric_events_v1",
    }),
  );

  return NextResponse.json(
    {
      error: {
        code: "UNAVAILABLE",
        correlationId,
        message: "Não foi possível registrar este evento agora.",
      },
    },
    { headers: noStoreHeaders, status: 503 },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
