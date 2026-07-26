"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Video } from "lucide-react";

import type { ZoomAccessState } from "@/domain/tes";
import { getZoomAccessLabel } from "@/features/bookings";

type ZoomMeetingPayload = {
  customerKey: string;
  meetingNumber: string;
  passWord?: string;
  role: 0 | 1;
  sdkKey: string;
  signature: string;
  userName: string;
  zak?: string;
};

type ApiResponse =
  | {
      data: {
        access: ZoomAccessState;
        meeting?: ZoomMeetingPayload;
      } & Partial<ZoomMeetingPayload>;
      ok: true;
    }
  | {
      data?: { access?: ZoomAccessState };
      error?: { message?: string };
      message?: string;
      ok: false;
    };

type ZoomMtgLike = {
  init(options: {
    error?: (error: unknown) => void;
    leaveUrl: string;
    patchJsMedia?: boolean;
    success?: () => void;
  }): void;
  join(options: {
    customerKey: string;
    error?: (error: unknown) => void;
    meetingNumber: string;
    passWord?: string;
    sdkKey: string;
    signature: string;
    success?: () => void;
    userName: string;
    zak?: string;
  }): void;
  prepareWebSDK(): void;
  preLoadWasm(): void;
};

export function ZoomMeetingAdapter({
  access,
  actorRole,
  bookingId,
}: {
  access: ZoomAccessState | null;
  actorRole: "patient" | "therapist";
  bookingId: string;
}) {
  const [state, setState] = useState<
    "idle" | "loading" | "joining" | "joined" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  async function joinMeeting() {
    if (inFlight.current) return;
    inFlight.current = true;
    setState("loading");
    setMessage("Preparando sua sala...");

    try {
      const response = await fetch("/api/zoom/meeting-access", {
        body: JSON.stringify({ actorRole, bookingId, intent: "join" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(
          (!payload.ok && (payload.error?.message ?? payload.message)) ||
            "Nao conseguimos abrir a sala agora.",
        );
      }
      const meeting = payload.data.meeting ?? parseLegacyMeeting(payload.data);

      setState("joining");
      setMessage("Carregando Zoom...");

      const meetingSdkModule = await import("@zoom/meetingsdk");
      const ZoomMtg = (meetingSdkModule as unknown as { ZoomMtg: ZoomMtgLike })
        .ZoomMtg;

      ZoomMtg.preLoadWasm();
      ZoomMtg.prepareWebSDK();
      ZoomMtg.init({
        error: (error) => {
          if (!mounted.current) return;
          setState("error");
          setMessage(formatZoomError(error));
        },
        leaveUrl: window.location.href,
        patchJsMedia: true,
        success: () => {
          ZoomMtg.join({
            customerKey: meeting.customerKey,
            error: (error) => {
              if (!mounted.current) return;
              setState("error");
              setMessage(formatZoomError(error));
            },
            meetingNumber: meeting.meetingNumber,
            passWord: meeting.passWord,
            sdkKey: meeting.sdkKey,
            signature: meeting.signature,
            success: () => {
              if (!mounted.current) return;
              setState("joined");
              setMessage("Voce entrou na sala.");
            },
            userName: meeting.userName,
            zak: meeting.zak,
          });
        },
      });
    } catch (error) {
      if (!mounted.current) return;
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao conseguimos abrir a sala agora.",
      );
    } finally {
      inFlight.current = false;
    }
  }

  if (access && !access.allowed) {
    return (
      <button
        className="mt-6 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-brand-lavenderSoft px-6 text-sm font-extrabold text-tesText-secondary"
        disabled
        type="button"
      >
        <Video aria-hidden="true" size={20} />
        {getZoomAccessLabel(access)}
      </button>
    );
  }

  return (
    <div className="mt-6">
      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-80"
        disabled={state === "loading" || state === "joining"}
        onClick={joinMeeting}
        type="button"
      >
        {state === "loading" || state === "joining" ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={20} />
        ) : (
          <Video aria-hidden="true" size={20} />
        )}
        {state === "joining" ? "Entrando..." : "Entrar na sessao"}
      </button>

      {message ? (
        <p
          aria-live="polite"
          className="mt-3 flex gap-2 text-xs font-semibold leading-5 text-tesText-secondary"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-brand-primary"
            size={16}
          />
          {message}
        </p>
      ) : null}
    </div>
  );
}

function parseLegacyMeeting(
  value: Partial<ZoomMeetingPayload>,
): ZoomMeetingPayload {
  if (
    typeof value.customerKey !== "string" ||
    typeof value.meetingNumber !== "string" ||
    (value.role !== 0 && value.role !== 1) ||
    typeof value.sdkKey !== "string" ||
    typeof value.signature !== "string" ||
    typeof value.userName !== "string"
  ) {
    throw new Error("Não conseguimos validar a sala agora.");
  }

  return {
    customerKey: value.customerKey,
    meetingNumber: value.meetingNumber,
    passWord: value.passWord,
    role: value.role,
    sdkKey: value.sdkKey,
    signature: value.signature,
    userName: value.userName,
    zak: value.zak,
  };
}

function formatZoomError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;

  return "Nao conseguimos carregar o Zoom. Verifique camera, microfone e conexao.";
}
