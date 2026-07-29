import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { TherapistFinanceConnectAction } from "@/features/therapist-finance/therapist-finance.types";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

type EdgeEnvelope =
  | {
      data?: {
        url?: string;
      };
      ok: true;
    }
  | {
      error?: {
        code?: string;
        message?: string;
        requestId?: string;
      };
      ok: false;
    };

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return failure("Envie uma solicitação válida.", 400);
  }

  const action = parseAction(rawBody);
  if (!action) {
    return failure("Ação financeira inválida.", 422);
  }

  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_therapist_access_token")?.value;

  if (!config || !accessToken) {
    return failure("Entre na sua conta de terapeuta para continuar.", 401);
  }

  try {
    if (action === "sync") {
      const sync = await callConnectFunction(
        config.url,
        accessToken,
        "stripe-connect-sync-account",
      );
      if (!sync.ok) return relayFailure(sync, 502);

      return NextResponse.json(
        { ok: true, data: { message: "Conta sincronizada." } },
        { headers: noStoreHeaders },
      );
    }

    if (action === "login") {
      const loginLink = await callConnectFunction(
        config.url,
        accessToken,
        "stripe-connect-create-login-link",
      );
      return relayConnectLink(loginLink);
    }

    const account = await callConnectFunction(
      config.url,
      accessToken,
      "stripe-connect-create-account",
    );
    if (!account.ok) return relayFailure(account, 502);

    const accountLink = await callConnectFunction(
      config.url,
      accessToken,
      "stripe-connect-create-account-link",
    );
    return relayConnectLink(accountLink);
  } catch {
    return failure("Não foi possível conectar com a Stripe agora.", 503);
  }
}

function parseAction(value: unknown): TherapistFinanceConnectAction | null {
  if (!isRecord(value)) return null;
  if (
    value.action === "create_or_continue" ||
    value.action === "login" ||
    value.action === "sync"
  ) {
    return value.action;
  }
  return null;
}

async function callConnectFunction(
  supabaseUrl: string,
  accessToken: string,
  name: string,
) {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/${encodeURIComponent(name)}`,
    {
      body: "{}",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = (await response
    .json()
    .catch(() => null)) as EdgeEnvelope | null;

  if (!payload) {
    return {
      ok: false,
      error: {
        message: "Não foi possível ler a resposta da Stripe.",
      },
    } satisfies EdgeEnvelope;
  }

  return payload;
}

function relayConnectLink(envelope: EdgeEnvelope) {
  if (!envelope.ok) return relayFailure(envelope, 502);

  if (!envelope.data?.url) {
    return failure("A Stripe não retornou um link válido.", 502);
  }

  return NextResponse.json(
    { ok: true, data: { url: envelope.data.url } },
    { headers: noStoreHeaders },
  );
}

function relayFailure(envelope: EdgeEnvelope, status: number) {
  if (envelope.ok) {
    return failure("Não foi possível concluir a operação.", status);
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        message:
          envelope.error?.message ??
          "Não foi possível atualizar sua conta de recebimento.",
        requestId: envelope.error?.requestId,
      },
    },
    { headers: noStoreHeaders, status },
  );
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
