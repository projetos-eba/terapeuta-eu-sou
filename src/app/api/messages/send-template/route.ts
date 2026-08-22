import { NextResponse } from "next/server";

import {
  getStructuredMessageSession,
  parseStructuredMessageBody,
  readRpcError,
} from "../structured-message";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato válido.", 400);
  }

  const parsed = parseStructuredMessageBody(body);
  if (!parsed) return failure("Revise o template selecionado.", 422);

  const session = await getStructuredMessageSession(parsed.actorRole);
  if (!session) return failure("Entre na sua conta para continuar.", 401);
  if ("forbidden" in session)
    return failure("A sessão não corresponde ao perfil selecionado.", 403);

  try {
    const response = await fetch(
      `${session.config.url}/rest/v1/rpc/send_structured_participant_message_v2`,
      {
        body: JSON.stringify({
          p_booking_id: parsed.bookingId ?? null,
          p_conversation_id: parsed.conversationId,
          p_parameters: parsed.parameters,
          p_template_key: parsed.templateKey,
        }),
        cache: "no-store",
        headers: {
          apikey: session.config.apiKey,
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      const mapped = await readRpcError(response);
      return failure(mapped.message, mapped.status);
    }

    return NextResponse.json(
      { ok: true },
      { headers: noStoreHeaders, status: 201 },
    );
  } catch {
    return failure("Não foi possível enviar este template agora.", 503);
  }
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
