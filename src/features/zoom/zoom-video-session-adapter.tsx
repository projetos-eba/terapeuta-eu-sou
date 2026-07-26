"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";

import type { ZoomAccessState } from "@/domain/tes";
import { getZoomAccessLabel } from "@/features/bookings";

type VideoSessionPayload = {
  access: ZoomAccessState;
  roleType: 0 | 1;
  sdkKey: string;
  sessionName: string;
  sessionPasscode: string | null;
  token: string;
  userName: string;
};

type ApiResponse =
  | {
      data: VideoSessionPayload;
      ok: true;
    }
  | {
      data?: { access?: ZoomAccessState };
      error?: { message?: string };
      message?: string;
      ok: false;
    };

type ZoomVideoModule = {
  default: {
    checkSystemRequirements?: () => { audio?: boolean; video?: boolean };
    createClient: () => ZoomVideoClient;
    destroyClient?: () => void;
    preloadDependentAssets?: () => Promise<void> | void;
  };
};

type ZoomVideoClient = {
  getMediaStream: () => ZoomMediaStream;
  init: (
    language: string,
    region: string,
    options: Record<string, unknown>,
  ) => Promise<void>;
  join: (
    sessionName: string,
    token: string,
    userName: string,
    sessionPasscode?: string,
  ) => Promise<void>;
  leave: (endSession?: boolean) => Promise<void> | void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type ZoomMediaStream = {
  attachVideo?: (
    userId: number,
    quality?: number,
  ) => Promise<HTMLElement | HTMLElement[]>;
  detachVideo?: (userId: number) => Promise<void> | void;
  getCurrentUserInfo?: () => { userId?: number };
  muteAudio?: () => Promise<void> | void;
  renderVideo?: (
    canvas: HTMLCanvasElement,
    userId: number,
    width: number,
    height: number,
    x: number,
    y: number,
    quality: number,
  ) => Promise<void> | void;
  startAudio?: () => Promise<void> | void;
  startVideo?: () => Promise<void> | void;
  stopAudio?: () => Promise<void> | void;
  stopRenderVideo?: (
    canvas: HTMLCanvasElement,
    userId: number,
  ) => Promise<void> | void;
  stopVideo?: () => Promise<void> | void;
  unmuteAudio?: () => Promise<void> | void;
};

export function ZoomVideoSessionAdapter({
  access,
  actorRole,
  bookingId,
}: {
  access: ZoomAccessState | null;
  actorRole: "patient" | "therapist";
  bookingId: string;
}) {
  const [state, setState] = useState<
    "idle" | "loading" | "joining" | "joined" | "ended" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [roleType, setRoleType] = useState<0 | 1 | null>(null);
  const clientRef = useRef<ZoomVideoClient | null>(null);
  const streamRef = useRef<ZoomMediaStream | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const localVideoRef = useRef<HTMLCanvasElement | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const listenersRef = useRef<
    Array<{ event: string; handler: (...args: unknown[]) => void }>
  >([]);

  useEffect(() => {
    return () => {
      mounted.current = false;
      void cleanup(false);
    };
  }, []);

  async function joinSession() {
    if (inFlight.current) return;
    inFlight.current = true;
    setState("loading");
    setMessage("Preparando sua sala...");

    try {
      const response = await fetch("/api/zoom/video-session-access", {
        body: JSON.stringify({ bookingId, intent: "join" }),
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

      const videoPayload = payload.data;
      setRoleType(videoPayload.roleType);
      setState("joining");
      setMessage("Carregando video...");

      const zoomModule =
        (await import("@zoom/videosdk")) as unknown as ZoomVideoModule;
      const ZoomVideo = zoomModule.default;
      const requirements = ZoomVideo.checkSystemRequirements?.();

      if (requirements && (!requirements.audio || !requirements.video)) {
        throw new Error(
          "Seu navegador nao parece liberar audio e video para esta sessao.",
        );
      }

      await ZoomVideo.preloadDependentAssets?.();
      const client = ZoomVideo.createClient();
      clientRef.current = client;
      registerClientListeners(client);

      await client.init("pt-BR", "Global", {
        leaveOnPageUnload: true,
        patchJsMedia: true,
        stayAwake: true,
      });
      await client.join(
        videoPayload.sessionName,
        videoPayload.token,
        videoPayload.userName,
        videoPayload.sessionPasscode ?? undefined,
      );

      const stream = client.getMediaStream();
      streamRef.current = stream;
      await stream.startAudio?.();
      await stream.muteAudio?.();

      if (!mounted.current) return;
      setAudioMuted(true);
      setState("joined");
      setMessage(
        actorRole === "therapist"
          ? "Voce entrou como responsavel pela sessao."
          : "Voce entrou na sessao. Aguarde se a outra pessoa ainda nao estiver presente.",
      );
    } catch (error) {
      if (!mounted.current) return;
      setState("error");
      setMessage(formatZoomError(error));
      await cleanup(false);
    } finally {
      inFlight.current = false;
    }
  }

  async function toggleAudio() {
    const stream = streamRef.current;
    if (!stream || state !== "joined") return;

    if (audioMuted) {
      await stream.unmuteAudio?.();
      setAudioMuted(false);
    } else {
      await stream.muteAudio?.();
      setAudioMuted(true);
    }
  }

  async function toggleVideo() {
    const stream = streamRef.current;
    const canvas = localVideoRef.current;
    if (!stream || !canvas || state !== "joined") return;

    if (videoOn) {
      const userId = stream.getCurrentUserInfo?.().userId;
      if (userId) await stream.stopRenderVideo?.(canvas, userId);
      await stream.stopVideo?.();
      setVideoOn(false);
      return;
    }

    await stream.startVideo?.();
    const userId = stream.getCurrentUserInfo?.().userId;
    if (userId) {
      await stream.renderVideo?.(canvas, userId, 320, 180, 0, 0, 2);
    }
    setVideoOn(true);
  }

  async function leaveSession(endSession = false) {
    await cleanup(endSession);
    if (!mounted.current) return;
    setState("ended");
    setMessage(endSession ? "A sessao foi encerrada." : "Voce saiu da sessao.");
  }

  async function cleanup(endSession: boolean) {
    const client = clientRef.current;
    const stream = streamRef.current;

    for (const listener of listenersRef.current) {
      client?.off?.(listener.event, listener.handler);
    }
    listenersRef.current = [];

    try {
      await stream?.stopAudio?.();
      await stream?.stopVideo?.();
      await client?.leave(endSession);
    } catch {
      // Cleanup should be best-effort; user-facing state is handled upstream.
    } finally {
      clientRef.current = null;
      streamRef.current = null;
      setVideoOn(false);
      setAudioMuted(true);
      if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";
    }
  }

  function registerClientListeners(client: ZoomVideoClient) {
    const connectionChange = (...args: unknown[]) => {
      if (!mounted.current) return;
      setMessage(formatConnectionMessage(args));
    };
    const userAdded = (...args: unknown[]) => {
      if (!mounted.current) return;
      setMessage("A outra pessoa entrou na sessao.");
    };
    const userRemoved = (...args: unknown[]) => {
      if (!mounted.current) return;
      setMessage("A outra pessoa saiu da sessao.");
    };
    const events = [
      ["connection-change", connectionChange],
      ["user-added", userAdded],
      ["user-removed", userRemoved],
    ] satisfies Array<[string, (...args: unknown[]) => void]>;

    for (const [event, handler] of events) {
      client.on?.(event, handler);
      listenersRef.current.push({ event, handler });
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
    <section className="mt-6" aria-label="Sala de video">
      <div className="grid gap-4 rounded-lg border border-brand-lavender bg-surface-soft p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="min-h-[180px] overflow-hidden rounded-lg bg-brand-deep">
            <canvas
              aria-label="Seu video"
              className="h-full min-h-[180px] w-full"
              ref={localVideoRef}
            />
          </div>
          <div
            aria-label="Video remoto"
            className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-lg bg-white text-sm font-semibold text-tesText-secondary"
            ref={remoteVideoRef}
          >
            Aguardando participante
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {state !== "joined" ? (
            <button
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-80 sm:flex-none"
              disabled={state === "loading" || state === "joining"}
              onClick={joinSession}
              type="button"
            >
              {state === "loading" || state === "joining" ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={20}
                />
              ) : (
                <Video aria-hidden="true" size={20} />
              )}
              {state === "joining" ? "Entrando..." : "Entrar na sessao"}
            </button>
          ) : (
            <>
              <button
                aria-pressed={!audioMuted}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onClick={toggleAudio}
                type="button"
              >
                {audioMuted ? <MicOff size={18} /> : <Mic size={18} />}
                {audioMuted ? "Ativar audio" : "Silenciar"}
              </button>
              <button
                aria-pressed={videoOn}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onClick={toggleVideo}
                type="button"
              >
                {videoOn ? <VideoOff size={18} /> : <Video size={18} />}
                {videoOn ? "Desligar camera" : "Ativar camera"}
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-status-error/30 bg-white px-4 text-sm font-extrabold text-status-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-error"
                onClick={() => void leaveSession(false)}
                type="button"
              >
                <PhoneOff size={18} />
                Sair
              </button>
              {roleType === 1 ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-status-error px-4 text-sm font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-error"
                  onClick={() => void leaveSession(true)}
                  type="button"
                >
                  Encerrar sessao
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

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
    </section>
  );
}

function formatConnectionMessage(args: unknown[]) {
  const event = args[0];
  if (event && typeof event === "object" && "state" in event) {
    const state = String((event as { state?: unknown }).state ?? "");
    if (/reconnect/i.test(state)) return "Reconectando a sessao...";
    if (/closed|fail|disconnect/i.test(state)) {
      return "A conexao caiu. Tente entrar novamente se necessario.";
    }
  }

  return "Conexao da sessao atualizada.";
}

function formatZoomError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;

  return "Nao conseguimos carregar o video. Verifique camera, microfone e conexao.";
}
