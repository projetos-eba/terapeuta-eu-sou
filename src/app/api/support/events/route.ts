import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { canUseAdminPermission } from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import {
  getSupportEventSubscriptions,
  type SupportEventActorRole,
} from "@/features/support/support-event-subscriptions";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ActorRole = SupportEventActorRole;

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const role = readRole(search.get("role"));
  const ticketId = search.get("ticketId");
  if (!role || (ticketId && !UUID.test(ticketId))) {
    return failure("Contexto de atualização inválido.", 422);
  }

  const context = await getContext(role);
  if (!context.ok) return failure(context.message, context.status);
  if (ticketId && role !== "admin") {
    const tickets = await requestSupabase<{ id: string }[]>(
      context.config,
      context.accessToken,
      `/rest/v1/support_tickets?select=id&id=eq.${ticketId}&requester_profile_id=eq.${context.userId}&limit=1`,
    ).catch(() => []);
    if (!tickets[0]) return failure("Chamado não encontrado.", 404);
  }

  const realtime = createClient(context.config.url, context.config.apiKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  realtime.realtime.setAuth(context.accessToken);
  const channel = realtime.channel(
    `support-events:${role}:${ticketId ?? "inbox"}:${crypto.randomUUID()}`,
  );
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const close = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    void realtime.removeChannel(channel);
    controllerRef?.close();
  };
  const emit = () => {
    if (!closed)
      controllerRef?.enqueue(encoder.encode('data: {"type":"refresh"}\n\n'));
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      controller.enqueue(encoder.encode(": connected\n\n"));
      for (const subscription of getSupportEventSubscriptions({
        role,
        ticketId,
        userId: context.userId,
      })) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            filter: subscription.filter,
            schema: "public",
            table: subscription.table,
          },
          emit,
        );
      }
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") close();
      });
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 20_000);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel: close,
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}

async function getContext(role: ActorRole) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(`tes_${role}_access_token`)?.value;
  if (!config || !accessToken) {
    return { ok: false as const, message: "Entre na sua conta.", status: 401 };
  }
  if (role === "admin") {
    const session = await readAdminSessionFromAccessToken(
      config,
      accessToken,
    ).catch(() => null);
    if (
      !session ||
      !canUseAdminPermission(session.permissions, "admin.support.read")
    ) {
      return {
        ok: false as const,
        message: "Acesso administrativo necessário.",
        status: 403,
      };
    }
    return { accessToken, config, ok: true as const, userId: session.userId };
  }

  try {
    const user = await requestSupabase<{ id: string }>(
      config,
      accessToken,
      "/auth/v1/user",
    );
    const profiles = await requestSupabase<Array<{ role: string }>>(
      config,
      accessToken,
      `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    );
    if (profiles[0]?.role !== role) {
      return {
        ok: false as const,
        message: "Acesso de paciente ou terapeuta necessário.",
        status: 403,
      };
    }
    return { accessToken, config, ok: true as const, userId: user.id };
  } catch {
    return { ok: false as const, message: "Entre na sua conta.", status: 401 };
  }
}

async function requestSupabase<T>(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  path: string,
) {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: { apikey: config.apiKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Support event context failed");
  return (await response.json()) as T;
}

function readRole(value: string | null): ActorRole | null {
  return value === "admin" || value === "patient" || value === "therapist"
    ? value
    : null;
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: { "Cache-Control": "no-store" }, status },
  );
}
