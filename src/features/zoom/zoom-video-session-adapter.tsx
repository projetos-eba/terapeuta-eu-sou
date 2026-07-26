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

type ZoomParticipant = {
  bVideoOn?: boolean;
  displayName?: string;
  userId: number;
};

type ZoomVideoClient = {
  getAllUser?: () => ZoomParticipant[];
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
  detachVideo?: (userId: number) => Promise<HTMLElement | HTMLElement[] | void>;
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

type SessionState =
  | "idle"
  | "loading"
  | "joining"
  | "joined"
  | "reconnecting"
  | "leaving"
  | "ended"
  | "error";

type CleanupFailure = {
  operation: string;
  reason: string;
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
  const [state, setState] = useState<SessionState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0);
  const [roleType, setRoleType] = useState<0 | 1 | null>(null);
  const [cleanupFailures, setCleanupFailures] = useState<CleanupFailure[]>([]);
  const clientRef = useRef<ZoomVideoClient | null>(null);
  const streamRef = useRef<ZoomMediaStream | null>(null);
  const zoomModuleRef = useRef<ZoomVideoModule["default"] | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const leavingRef = useRef(false);
  const localVideoRef = useRef<HTMLCanvasElement | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const localUserIdRef = useRef<number | null>(null);
  const remoteUserElementsRef = useRef<Map<number, HTMLElement[]>>(new Map());
  const listenersRef = useRef<
    Array<{ event: string; handler: (...args: unknown[]) => void }>
  >([]);
  const cleanupPromiseRef = useRef<Promise<CleanupFailure[]> | null>(null);
  const cleanupRef = useRef<
    | ((input: {
        destroyClient: boolean;
        endSession: boolean;
      }) => Promise<CleanupFailure[]>)
    | null
  >(null);

  cleanupRef.current = cleanup;

  useEffect(() => {
    const handlePageHide = () => {
      void cleanupRef.current?.({ destroyClient: true, endSession: false });
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      mounted.current = false;
      window.removeEventListener("pagehide", handlePageHide);
      void cleanupRef.current?.({ destroyClient: true, endSession: false });
    };
  }, []);

  async function joinSession() {
    if (inFlight.current || clientRef.current) return;
    inFlight.current = true;
    setCleanupFailures([]);
    setState("loading");
    setMessage("Preparando sua sala...");

    try {
      const response = await fetch("/api/zoom/video-session-access", {
        body: JSON.stringify({ bookingId, intent: "join" }),
        cache: "no-store",
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
      zoomModuleRef.current = ZoomVideo;
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
      localUserIdRef.current = stream.getCurrentUserInfo?.().userId ?? null;
      await stream.startAudio?.();
      await stream.muteAudio?.();
      await renderExistingRemoteVideos();

      if (!mounted.current) {
        await cleanup({ destroyClient: true, endSession: false });
        return;
      }
      setAudioMuted(true);
      setState("joined");
      setMessage(
        actorRole === "therapist"
          ? "Voce entrou como responsavel pela sessao."
          : "Voce entrou na sessao. Aguarde se a outra pessoa ainda nao estiver presente.",
      );
    } catch (error) {
      if (mounted.current) {
        setState("error");
        setMessage(formatZoomError(error));
      }
      await cleanup({ destroyClient: true, endSession: false });
    } finally {
      inFlight.current = false;
    }
  }

  async function toggleAudio() {
    const stream = streamRef.current;
    if (!stream || state !== "joined" || leavingRef.current) return;

    try {
      if (audioMuted) {
        await stream.unmuteAudio?.();
        setAudioMuted(false);
      } else {
        await stream.muteAudio?.();
        setAudioMuted(true);
      }
    } catch (error) {
      setMessage(formatMediaError(error, "audio"));
    }
  }

  async function toggleVideo() {
    const stream = streamRef.current;
    const canvas = localVideoRef.current;
    if (!stream || !canvas || state !== "joined" || leavingRef.current) return;

    try {
      if (videoOn) {
        const userId =
          localUserIdRef.current ?? stream.getCurrentUserInfo?.().userId;
        if (userId) await stream.stopRenderVideo?.(canvas, userId);
        await stream.stopVideo?.();
        setVideoOn(false);
        return;
      }

      await stream.startVideo?.();
      const userId = stream.getCurrentUserInfo?.().userId;
      localUserIdRef.current = userId ?? null;
      if (userId) {
        await stream.renderVideo?.(canvas, userId, 320, 180, 0, 0, 2);
      }
      setVideoOn(true);
    } catch (error) {
      setMessage(formatMediaError(error, "camera"));
    }
  }

  async function leaveSession(endSession = false) {
    if (leavingRef.current) return;
    if (
      endSession &&
      !window.confirm(
        "Encerrar a sessao para todos? A outra pessoa tambem sera desconectada.",
      )
    ) {
      return;
    }

    leavingRef.current = true;
    setState("leaving");
    setMessage(endSession ? "Encerrando a sessao..." : "Saindo da sessao...");

    const failures = await cleanup({ destroyClient: true, endSession });
    leavingRef.current = false;

    if (!mounted.current) return;
    setState(failures.length > 0 ? "error" : "ended");
    setMessage(
      failures.length > 0
        ? "A sessao tentou encerrar, mas houve falha parcial de cleanup. Confira sua conexao e tente novamente."
        : endSession
          ? "A sessao foi encerrada para todos."
          : "Voce saiu da sessao.",
    );
  }

  async function cleanup(input: {
    destroyClient: boolean;
    endSession: boolean;
  }) {
    if (cleanupPromiseRef.current) return cleanupPromiseRef.current;

    cleanupPromiseRef.current = runCleanup(input).finally(() => {
      cleanupPromiseRef.current = null;
    });

    return cleanupPromiseRef.current;
  }

  async function runCleanup(input: {
    destroyClient: boolean;
    endSession: boolean;
  }): Promise<CleanupFailure[]> {
    const failures: CleanupFailure[] = [];
    const client = clientRef.current;
    const stream = streamRef.current;

    for (const listener of listenersRef.current) {
      await recordCleanupFailure(failures, `listener:${listener.event}`, () =>
        client?.off?.(listener.event, listener.handler),
      );
    }
    listenersRef.current = [];

    await stopAllRemoteVideos(failures);

    const localCanvas = localVideoRef.current;
    const localUserId = localUserIdRef.current;
    if (stream && localCanvas && localUserId) {
      await recordCleanupFailure(failures, "stopRenderVideo:local", () =>
        stream.stopRenderVideo?.(localCanvas, localUserId),
      );
    }
    await recordCleanupFailure(failures, "stopVideo", () =>
      stream?.stopVideo?.(),
    );
    await recordCleanupFailure(failures, "stopAudio", () =>
      stream?.stopAudio?.(),
    );
    await recordCleanupFailure(failures, "leave", () =>
      client?.leave(input.endSession),
    );
    if (input.destroyClient) {
      await recordCleanupFailure(failures, "destroyClient", () =>
        zoomModuleRef.current?.destroyClient?.(),
      );
    }

    clientRef.current = null;
    streamRef.current = null;
    zoomModuleRef.current = null;
    localUserIdRef.current = null;
    remoteUserElementsRef.current.clear();
    setRemoteParticipantCount(0);
    setVideoOn(false);
    setAudioMuted(true);

    if (failures.length > 0) {
      setCleanupFailures(failures);
      console.warn(
        JSON.stringify({
          code: "ZOOM_VIDEO_CLEANUP_PARTIAL_FAILURE",
          operations: failures.map((failure) => failure.operation),
        }),
      );
    }

    return failures;
  }

  function registerClientListeners(client: ZoomVideoClient) {
    const connectionChange = (payload: unknown) => {
      if (!mounted.current) return;
      const normalized = normalizeConnectionChange(payload);
      if (normalized.state === "Reconnecting") {
        setState("reconnecting");
        setMessage("Reconectando a sessao...");
      } else if (normalized.state === "Connected") {
        setState("joined");
        setMessage("Conexao restabelecida.");
      } else if (normalized.state === "Closed") {
        setState("ended");
        setMessage(formatClosedReason(normalized.reason));
        void cleanup({ destroyClient: true, endSession: false });
      } else if (normalized.state === "Fail") {
        setState("error");
        setMessage("Falha ao manter a conexao da sessao.");
        void cleanup({ destroyClient: true, endSession: false });
      }
    };
    const userAdded = (payload: unknown) => {
      if (!mounted.current) return;
      setMessage("A outra pessoa entrou na sessao.");
      void renderRemoteParticipants(asParticipantArray(payload));
    };
    const userRemoved = (payload: unknown) => {
      if (!mounted.current) return;
      setMessage("A outra pessoa saiu da sessao.");
      void detachRemoteParticipants(asParticipantArray(payload));
    };
    const userUpdated = (payload: unknown) => {
      void renderRemoteParticipants(asParticipantArray(payload));
    };
    const peerVideoStateChange = (payload: unknown) => {
      const event = payload as { action?: unknown; userId?: unknown };
      const userId =
        typeof event.userId === "number" && event.userId > 0
          ? event.userId
          : null;
      if (!userId || userId === localUserIdRef.current) return;

      if (event.action === "Start") {
        void attachRemoteVideo(userId);
      } else if (event.action === "Stop") {
        void detachRemoteVideo(userId);
      }
    };
    const mediaFailed = (payload: unknown) => {
      if (!mounted.current) return;
      setMessage(formatMediaError(payload, "midia"));
    };
    const devicePermissionChange = (payload: unknown) => {
      const permission = payload as { name?: unknown; state?: unknown };
      if (permission.state === "denied") {
        setMessage("Permissao de camera ou microfone negada no navegador.");
      }
    };
    const events = [
      ["connection-change", connectionChange],
      ["user-added", userAdded],
      ["user-removed", userRemoved],
      ["user-updated", userUpdated],
      ["peer-video-state-change", peerVideoStateChange],
      ["active-media-failed", mediaFailed],
      ["device-permission-change", devicePermissionChange],
    ] satisfies Array<[string, (...args: unknown[]) => void]>;

    for (const [event, handler] of events) {
      client.on?.(event, handler);
      listenersRef.current.push({ event, handler });
    }
  }

  async function renderExistingRemoteVideos() {
    const users = clientRef.current?.getAllUser?.() ?? [];
    await renderRemoteParticipants(users);
  }

  async function renderRemoteParticipants(users: ZoomParticipant[]) {
    const remoteUsers = users.filter(
      (user) => user.userId && user.userId !== localUserIdRef.current,
    );

    for (const user of remoteUsers) {
      if (user.bVideoOn) {
        await attachRemoteVideo(user.userId);
      }
    }

    setRemoteParticipantCount(
      Math.max(remoteUsers.length, remoteUserElementsRef.current.size),
    );
  }

  async function attachRemoteVideo(userId: number) {
    const stream = streamRef.current;
    const container = remoteVideoRef.current;
    if (!stream?.attachVideo || !container) return;
    if (remoteUserElementsRef.current.has(userId)) return;

    try {
      const attached = await stream.attachVideo(userId, 2);
      const elements = Array.isArray(attached) ? attached : [attached];
      for (const element of elements) {
        element.classList.add("h-full", "w-full", "object-cover");
        container.appendChild(element);
      }
      remoteUserElementsRef.current.set(userId, elements);
      setRemoteParticipantCount((current) =>
        Math.max(current, remoteUserElementsRef.current.size),
      );
    } catch (error) {
      setMessage(formatMediaError(error, "video remoto"));
    }
  }

  async function detachRemoteParticipants(users: ZoomParticipant[]) {
    for (const user of users) {
      if (user.userId && user.userId !== localUserIdRef.current) {
        await detachRemoteVideo(user.userId);
      }
    }

    setRemoteParticipantCount(remoteUserElementsRef.current.size);
  }

  async function detachRemoteVideo(userId: number) {
    const failures: CleanupFailure[] = [];
    await detachRemoteVideoWithFailures(userId, failures);
    if (failures.length > 0) {
      setCleanupFailures((current) => [...current, ...failures]);
    }
  }

  async function stopAllRemoteVideos(failures: CleanupFailure[]) {
    const userIds = [...remoteUserElementsRef.current.keys()];
    for (const userId of userIds) {
      await detachRemoteVideoWithFailures(userId, failures);
    }
  }

  async function detachRemoteVideoWithFailures(
    userId: number,
    failures: CleanupFailure[],
  ) {
    const stream = streamRef.current;
    await recordCleanupFailure(failures, `detachVideo:${userId}`, () =>
      stream?.detachVideo?.(userId),
    );

    const elements = remoteUserElementsRef.current.get(userId) ?? [];
    for (const element of elements) {
      element.remove();
    }
    remoteUserElementsRef.current.delete(userId);
    setRemoteParticipantCount(remoteUserElementsRef.current.size);
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

  const isBusy =
    state === "loading" ||
    state === "joining" ||
    state === "leaving" ||
    inFlight.current ||
    leavingRef.current;

  return (
    <section className="mt-6" aria-label="Sala de video">
      <div className="grid gap-4 rounded-lg border border-brand-lavender bg-surface-soft p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid min-h-[180px] overflow-hidden rounded-lg bg-brand-deep">
            <canvas
              aria-label="Seu video"
              className="h-full min-h-[180px] w-full"
              ref={localVideoRef}
            />
          </div>
          <div
            aria-label="Video remoto"
            className="relative grid min-h-[180px] overflow-hidden rounded-lg bg-white text-sm font-semibold text-tesText-secondary"
          >
            <div
              className="absolute inset-0 grid place-items-center px-4 text-center"
              hidden={remoteParticipantCount > 0}
            >
              Aguardando participante
            </div>
            <div
              aria-hidden={remoteParticipantCount === 0}
              className="h-full min-h-[180px] w-full"
              ref={remoteVideoRef}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {state !== "joined" && state !== "reconnecting" ? (
            <button
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-80 sm:flex-none"
              disabled={isBusy}
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
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
                disabled={isBusy}
                onClick={toggleAudio}
                type="button"
              >
                {audioMuted ? <MicOff size={18} /> : <Mic size={18} />}
                {audioMuted ? "Ativar audio" : "Silenciar"}
              </button>
              <button
                aria-pressed={videoOn}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
                disabled={isBusy}
                onClick={toggleVideo}
                type="button"
              >
                {videoOn ? <VideoOff size={18} /> : <Video size={18} />}
                {videoOn ? "Desligar camera" : "Ativar camera"}
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-status-error/30 bg-white px-4 text-sm font-extrabold text-status-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-error disabled:cursor-wait disabled:opacity-70"
                disabled={isBusy}
                onClick={() => void leaveSession(false)}
                type="button"
              >
                <PhoneOff size={18} />
                Sair
              </button>
              {roleType === 1 ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-status-error px-4 text-sm font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-error disabled:cursor-wait disabled:opacity-70"
                  disabled={isBusy}
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

      {cleanupFailures.length > 0 ? (
        <p
          aria-live="assertive"
          className="mt-2 text-xs font-semibold leading-5 text-status-error"
        >
          Algumas etapas de encerramento falharam. Tente recarregar a pagina se
          a sala parecer presa.
        </p>
      ) : null}
    </section>
  );
}

async function recordCleanupFailure(
  failures: CleanupFailure[],
  operation: string,
  callback: () => Promise<unknown> | unknown,
) {
  try {
    await callback();
  } catch (error) {
    failures.push({ operation, reason: sanitizeErrorReason(error) });
  }
}

function asParticipantArray(value: unknown): ZoomParticipant[] {
  const items = Array.isArray(value) ? value : [value];

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const user = item as {
      bVideoOn?: unknown;
      displayName?: unknown;
      userId?: unknown;
    };
    if (typeof user.userId !== "number") return [];

    return [
      {
        bVideoOn: user.bVideoOn === true,
        displayName:
          typeof user.displayName === "string" ? user.displayName : undefined,
        userId: user.userId,
      },
    ];
  });
}

function normalizeConnectionChange(payload: unknown) {
  const event =
    payload && typeof payload === "object"
      ? (payload as { reason?: unknown; state?: unknown })
      : {};

  return {
    reason: typeof event.reason === "string" ? event.reason : undefined,
    state: typeof event.state === "string" ? event.state : "",
  };
}

function formatClosedReason(reason: string | undefined) {
  if (!reason) return "A sessao foi encerrada.";
  if (/host/i.test(reason)) return "A sessao foi encerrada pelo responsavel.";
  if (/kick|remove/i.test(reason)) return "Seu acesso a sessao foi encerrado.";
  if (/leave/i.test(reason)) return "Voce saiu da sessao.";

  return "A sessao foi encerrada.";
}

function formatMediaError(error: unknown, target: string) {
  const detail = sanitizeErrorReason(error);
  return `Nao conseguimos ativar ${target}. Verifique permissoes, dispositivos e conexao.${detail ? ` (${detail})` : ""}`;
}

function formatZoomError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;

  return "Nao conseguimos carregar o video. Verifique camera, microfone e conexao.";
}

function sanitizeErrorReason(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");

  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(
      /(token|secret|signature|password)["'=:\s]+[^"',}\s]+/gi,
      "$1=[redacted]",
    )
    .replace(/[\r\n]+/g, " ")
    .slice(0, 160);
}
