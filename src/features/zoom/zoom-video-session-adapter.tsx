"use client";

import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Copy,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Video,
  VideoOff,
  Wifi,
} from "lucide-react";

import { ZoomAccessReason, type ZoomAccessState } from "@/domain/tes";
import {
  getZoomAccessLabel,
  getZoomWaitingRoomStatusFromAccess,
} from "@/features/bookings";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type VideoSessionPayload = {
  access: ZoomAccessState;
  roleType: 0 | 1;
  sdkKey: string;
  sessionName: string;
  sessionPasscode: string | null;
  token: string;
  userName: string;
};

type PreviewPayload = {
  access: ZoomAccessState;
};

type ApiResponse =
  | {
      data: PreviewPayload | VideoSessionPayload;
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
  getCurrentUserInfo?: () => ZoomParticipant;
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
  muteAudio?: () => Promise<void> | void;
  startAudio?: () => Promise<void> | void;
  startVideo?: () => Promise<void> | void;
  stopAudio?: () => Promise<void> | void;
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

const ACCESS_REQUEST_TIMEOUT_MS = 12_000;

export function ZoomVideoSessionAdapter({
  access,
  actorRole,
  bookingId,
  displayMode = "embedded",
}: {
  access: ZoomAccessState | null;
  actorRole: "patient" | "therapist";
  bookingId: string;
  displayMode?: "dedicated" | "embedded";
}) {
  const [state, setState] = useState<SessionState>("idle");
  const [currentAccess, setCurrentAccess] = useState(access);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(() =>
    getServerClockOffsetMs(access),
  );
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [audioMuted, setAudioMuted] = useState(true);
  const [videoOn, setVideoOn] = useState(false);
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0);
  const [roleType, setRoleType] = useState<0 | 1 | null>(null);
  const [cleanupFailures, setCleanupFailures] = useState<CleanupFailure[]>([]);
  const currentAccessRef = useRef(access);
  const isOnlineRef = useRef(isOnline);
  const clientRef = useRef<ZoomVideoClient | null>(null);
  const streamRef = useRef<ZoomMediaStream | null>(null);
  const zoomModuleRef = useRef<ZoomVideoModule["default"] | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const previewRequestRef = useRef<Promise<ZoomAccessState | null> | null>(
    null,
  );
  const previewAbortControllerRef = useRef<AbortController | null>(null);
  const joinAbortControllerRef = useRef<AbortController | null>(null);
  const leavingRef = useRef(false);
  const localVideoRef = useRef<HTMLElement | null>(null);
  const remoteVideoRef = useRef<HTMLElement | null>(null);
  const localUserIdRef = useRef<number | null>(null);
  const localUserElementsRef = useRef<HTMLElement[]>([]);
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

  const updateCurrentAccess = useCallback(
    (nextAccess: ZoomAccessState | null) => {
      currentAccessRef.current = nextAccess;
      setCurrentAccess(nextAccess);
      setServerClockOffsetMs(getServerClockOffsetMs(nextAccess));
    },
    [],
  );

  useEffect(() => {
    updateCurrentAccess(access);
  }, [access, updateCurrentAccess]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    const handlePageHide = () => {
      void cleanupRef.current?.({ destroyClient: true, endSession: false });
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      mounted.current = false;
      previewAbortControllerRef.current?.abort();
      joinAbortControllerRef.current?.abort();
      window.removeEventListener("pagehide", handlePageHide);
      void cleanupRef.current?.({ destroyClient: true, endSession: false });
    };
  }, []);

  const waitingForTherapist =
    actorRole === "patient" &&
    currentAccess?.reason === ZoomAccessReason.TherapistNotInSession;
  const waitingRoomKind = getZoomWaitingRoomStatusFromAccess(
    currentAccess,
    new Date(nowMs),
  );
  const sectionClassName = displayMode === "dedicated" ? "w-full" : "mt-6";

  useEffect(() => {
    if (!currentAccess?.hardEndsAt) return undefined;

    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [currentAccess?.hardEndsAt]);

  const refreshPreviewAccess = useCallback(
    (forceOnline = false) => {
      if (!isOnlineRef.current && !forceOnline) {
        setMessage(
          "Sem conexão com a internet. A sala será atualizada quando a conexão voltar.",
        );
        return Promise.resolve(currentAccessRef.current);
      }
      if (previewRequestRef.current) return previewRequestRef.current;

      const controller = new AbortController();
      previewAbortControllerRef.current = controller;
      setPreviewLoading(true);

      const request = (async () => {
        const timeout = window.setTimeout(
          () => controller.abort(),
          ACCESS_REQUEST_TIMEOUT_MS,
        );

        try {
          const response = await fetch("/api/zoom/video-session-access", {
            body: JSON.stringify({ actorRole, bookingId, intent: "preview" }),
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            method: "POST",
            signal: controller.signal,
          });
          const payload = (await response.json()) as ApiResponse;

          if (!response.ok || !payload.ok) {
            setMessage(
              "Nao conseguimos confirmar a sala agora. Tentaremos novamente automaticamente.",
            );
            return currentAccessRef.current;
          }

          const refreshedAccess = payload.data?.access;

          if (refreshedAccess) {
            updateCurrentAccess(refreshedAccess);
            if (refreshedAccess.allowed) {
              setMessage(
                "O terapeuta iniciou o encontro. Voce ja pode entrar.",
              );
            } else {
              setMessage(null);
            }
            return refreshedAccess;
          }

          setMessage(
            "Nao conseguimos confirmar a sala agora. Tentaremos novamente automaticamente.",
          );
        } catch (error) {
          setMessage(
            isAbortError(error)
              ? "A atualização demorou mais que o esperado. Tentaremos novamente automaticamente."
              : "Nao conseguimos atualizar a sala de espera agora.",
          );
        } finally {
          window.clearTimeout(timeout);
          previewAbortControllerRef.current = null;
          previewRequestRef.current = null;
          setPreviewLoading(false);
        }

        return currentAccessRef.current;
      })();

      previewRequestRef.current = request;
      return request;
    },
    [actorRole, bookingId, updateCurrentAccess],
  );

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setMessage(
        clientRef.current
          ? "Conexão interrompida. Estamos tentando reconectar o encontro."
          : "Sem conexão com a internet. Reconecte-se para acessar o encontro.",
      );
      if (clientRef.current) setState("reconnecting");
    };
    const handleOnline = () => {
      setIsOnline(true);
      if (clientRef.current) {
        setState("reconnecting");
        setMessage("Conexão restabelecida. Confirmando o encontro...");
        return;
      }
      setMessage("Conexão restabelecida. Atualizando a sala...");
      if (actorRole === "patient") void refreshPreviewAccess(true);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [actorRole, refreshPreviewAccess]);

  useEffect(() => {
    if (actorRole !== "patient" || currentAccess || state !== "idle") return;

    let cancelled = false;
    let delayMs = 3000;
    let timer: number | null = null;

    const refreshUntilAccessIsAvailable = async () => {
      if (document.visibilityState === "hidden") {
        timer = window.setTimeout(refreshUntilAccessIsAvailable, delayMs);
        return;
      }

      const refreshed = await refreshPreviewAccess();
      if (cancelled || refreshed) return;

      timer = window.setTimeout(refreshUntilAccessIsAvailable, delayMs);
      delayMs = Math.min(Math.round(delayMs * 1.5), 15_000);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshUntilAccessIsAvailable();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    void refreshUntilAccessIsAvailable();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [actorRole, currentAccess, refreshPreviewAccess, state]);

  useEffect(() => {
    if (!waitingForTherapist || state !== "idle") return undefined;

    let cancelled = false;
    let delayMs = 5000;
    let timer: number | null = null;

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = window.setTimeout(async () => {
        if (document.visibilityState === "hidden") {
          schedule(Math.min(delayMs, 15000));
          return;
        }

        const refreshed = await refreshPreviewAccess();
        if (cancelled || refreshed?.allowed) return;

        delayMs = Math.min(Math.round(delayMs * 1.5), 15000);
        schedule(delayMs);
      }, ms);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshPreviewAccess();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    schedule(delayMs);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshPreviewAccess, state, waitingForTherapist]);

  async function joinSession() {
    if (inFlight.current || clientRef.current) return;
    if (!isOnline) {
      setState("error");
      setMessage(
        "Sem conexão com a internet. Reconecte-se antes de entrar no encontro.",
      );
      return;
    }
    inFlight.current = true;
    setCleanupFailures([]);
    setState("loading");
    setRecoveryMessage(null);
    setMessage("Preparando sua sala...");

    try {
      const controller = new AbortController();
      joinAbortControllerRef.current = controller;
      const timeout = window.setTimeout(
        () => controller.abort(),
        ACCESS_REQUEST_TIMEOUT_MS,
      );
      let response: Response;

      try {
        response = await fetch("/api/zoom/video-session-access", {
          body: JSON.stringify({ actorRole, bookingId, intent: "join" }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
        joinAbortControllerRef.current = null;
      }

      if (!mounted.current) return;
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(
          (!payload.ok && (payload.error?.message ?? payload.message)) ||
            "Nao conseguimos abrir a sala agora.",
        );
      }

      const videoPayload = payload.data;
      if (!isVideoSessionPayload(videoPayload)) {
        throw new Error("Nao conseguimos abrir a sala agora.");
      }
      updateCurrentAccess(videoPayload.access);
      setRoleType(videoPayload.roleType);
      setState("joining");
      setMessage("Carregando video...");

      const zoomModule =
        (await import("@zoom/videosdk")) as unknown as ZoomVideoModule;
      if (!mounted.current) return;
      const ZoomVideo = zoomModule.default;
      zoomModuleRef.current = ZoomVideo;
      const requirements = ZoomVideo.checkSystemRequirements?.();

      if (requirements && (!requirements.audio || !requirements.video)) {
        throw new Error(
          "Seu navegador nao parece liberar audio e video para este encontro.",
        );
      }

      await ZoomVideo.preloadDependentAssets?.();
      if (!mounted.current) return;
      const client = ZoomVideo.createClient();
      clientRef.current = client;
      registerClientListeners(client);

      await client.init("pt-BR", "Global", {
        leaveOnPageUnload: true,
        patchJsMedia: true,
        stayAwake: true,
      });
      if (!mounted.current) {
        await cleanup({ destroyClient: true, endSession: false });
        return;
      }
      await client.join(
        videoPayload.sessionName,
        videoPayload.token,
        videoPayload.userName,
        videoPayload.sessionPasscode ?? undefined,
      );

      const stream = client.getMediaStream();
      streamRef.current = stream;
      localUserIdRef.current = client.getCurrentUserInfo?.().userId ?? null;
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
          ? "Voce entrou como responsavel pelo encontro."
          : "Voce entrou no encontro. Aguarde se a outra pessoa ainda nao estiver presente.",
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

  async function reviewPermissions() {
    setRecoveryMessage(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setRecoveryMessage(
          "Seu navegador nao oferece teste de camera e microfone nesta pagina.",
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      setRecoveryMessage("Permissoes liberadas. Tente entrar novamente.");
    } catch {
      setRecoveryMessage(
        "Permissao negada ou dispositivo indisponivel. Revise o bloqueio do navegador.",
      );
    }
  }

  async function copySupportReference() {
    const reference = `TES-${bookingId.slice(0, 8)}-${state}-${waitingRoomKind}`;

    try {
      await navigator.clipboard?.writeText(reference);
      setRecoveryMessage("Referencia copiada para o suporte.");
    } catch {
      setRecoveryMessage(`Referencia do encontro: ${reference}`);
    }
  }

  function backToWaitingRoom() {
    setState("idle");
    setMessage(null);
    setRecoveryMessage(null);
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
    const container = localVideoRef.current;
    if (!stream || !container || state !== "joined" || leavingRef.current)
      return;

    try {
      if (videoOn) {
        const userId =
          localUserIdRef.current ??
          clientRef.current?.getCurrentUserInfo?.().userId;
        if (userId) await stream.detachVideo?.(userId);
        removeVideoElements(localUserElementsRef.current);
        localUserElementsRef.current = [];
        await stream.stopVideo?.();
        setVideoOn(false);
        return;
      }

      await stream.startVideo?.();
      const userId = clientRef.current?.getCurrentUserInfo?.().userId;
      if (!userId) {
        await stream.stopVideo?.();
        throw new Error("participant_not_ready");
      }
      localUserIdRef.current = userId ?? null;
      const attached = await stream.attachVideo?.(userId, 2);
      const elements = normalizeVideoElements(attached);
      if (elements.length === 0) {
        await stream.stopVideo?.();
        throw new Error("local_video_not_attached");
      }
      for (const element of elements) {
        styleVideoElement(element);
        container.appendChild(element);
      }
      localUserElementsRef.current = elements;
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
        "Encerrar o encontro para todos? A outra pessoa tambem sera desconectada.",
      )
    ) {
      return;
    }

    leavingRef.current = true;
    setState("leaving");
    setMessage(
      endSession ? "Encerrando o encontro..." : "Saindo do encontro...",
    );

    const failures = await cleanup({ destroyClient: true, endSession });
    leavingRef.current = false;

    if (!mounted.current) return;
    setState(failures.length > 0 ? "error" : "ended");
    setMessage(
      failures.length > 0
        ? "Nao foi possivel concluir todas as etapas de encerramento. Confira sua conexao e tente novamente."
        : endSession
          ? "O encontro foi encerrado para todos."
          : "Voce saiu do encontro.",
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

    const localUserId = localUserIdRef.current;
    if (stream && localUserId) {
      await recordCleanupFailure(failures, "detachVideo:local", () =>
        stream.detachVideo?.(localUserId),
      );
    }
    removeVideoElements(localUserElementsRef.current);
    localUserElementsRef.current = [];
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
        setMessage("Reconectando o encontro...");
      } else if (normalized.state === "Connected") {
        setState("joined");
        setMessage("Conexao restabelecida.");
      } else if (normalized.state === "Closed") {
        setState("ended");
        setMessage(formatClosedReason(normalized.reason));
        void cleanup({ destroyClient: true, endSession: false });
      } else if (normalized.state === "Fail") {
        setState("error");
        setMessage("Falha ao manter a conexao do encontro.");
        void cleanup({ destroyClient: true, endSession: false });
      }
    };
    const userAdded = (payload: unknown) => {
      if (!mounted.current) return;
      setMessage("A outra pessoa entrou no encontro.");
      void renderRemoteParticipants(asParticipantArray(payload));
    };
    const userRemoved = (payload: unknown) => {
      if (!mounted.current) return;
      setMessage("A outra pessoa saiu do encontro.");
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
      const elements = normalizeVideoElements(attached);
      if (elements.length === 0) throw new Error("remote_video_not_attached");
      for (const element of elements) {
        styleVideoElement(element);
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

  if (waitingForTherapist) {
    return (
      <section className={sectionClassName} aria-label="Sala de espera">
        <div className="grid gap-3 rounded-lg border border-brand-lavender bg-surface-soft p-4">
          <div
            aria-hidden="true"
            className="relative min-h-36 overflow-hidden rounded-lg bg-[url('/client-auth/client-auth-journey-room.png')] bg-cover bg-center"
          >
            <div className="absolute inset-0 bg-brand-deep/10" />
          </div>
          <p
            aria-live="polite"
            className="text-sm font-extrabold text-brand-deep"
          >
            {waitingRoomKind === "therapist_absent_prolonged"
              ? "Ausência prolongada do terapeuta."
              : "Aguardando o terapeuta iniciar o encontro."}
          </p>
          <p className="text-xs font-semibold leading-5 text-tesText-secondary">
            Assim que a presença for confirmada pelo Zoom, a entrada será
            liberada automaticamente. Se a espera se prolongar, acione o suporte
            com a referência do encontro.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
              disabled={previewLoading || !isOnline}
              onClick={() => void refreshPreviewAccess()}
              type="button"
            >
              {previewLoading ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={18}
                />
              ) : (
                <Video aria-hidden="true" size={18} />
              )}
              Atualizar sala
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
              disabled={previewLoading || !isOnline}
              onClick={() => void refreshPreviewAccess()}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={18} />
              Renovar acesso
            </button>
            {waitingRoomKind === "therapist_absent_prolonged" ? (
              <>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  onClick={() => void copySupportReference()}
                  type="button"
                >
                  <Copy aria-hidden="true" size={18} />
                  Copiar referência
                </button>
                <a
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  href={`${routes.patient.messages}?context=suporte&booking=${bookingId}`}
                >
                  <Headphones aria-hidden="true" size={18} />
                  Falar com suporte
                </a>
              </>
            ) : null}
            <span className="text-xs font-semibold text-tesText-secondary">
              {formatHardEndCountdown(
                currentAccess,
                nowMs,
                serverClockOffsetMs,
              )}
            </span>
          </div>
        </div>
        {message || recoveryMessage ? (
          <p
            aria-live="polite"
            className="mt-3 flex gap-2 text-xs font-semibold leading-5 text-tesText-secondary"
          >
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-brand-primary"
              size={16}
            />
            {recoveryMessage ?? message}
          </p>
        ) : null}
      </section>
    );
  }

  if (actorRole === "patient" && !currentAccess) {
    if (!isOnline) {
      return (
        <section className={sectionClassName} aria-label="Sala de video">
          <div className="grid gap-3 rounded-lg border border-brand-lavender bg-surface-soft p-4">
            <p className="flex items-center gap-2 text-sm font-extrabold text-brand-deep">
              <Wifi aria-hidden="true" size={18} />
              Sem conexão com a internet
            </p>
            <p className="text-sm font-semibold leading-6 text-tesText-secondary">
              A sala será atualizada automaticamente assim que a conexão voltar.
            </p>
          </div>
        </section>
      );
    }

    return (
      <section className={sectionClassName} aria-label="Sala de video">
        <div className="grid gap-3 rounded-lg border border-brand-lavender bg-surface-soft p-4">
          <button
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-lavenderSoft px-6 text-sm font-extrabold text-tesText-secondary disabled:cursor-wait"
            disabled={previewLoading}
            onClick={() => void refreshPreviewAccess()}
            type="button"
          >
            {previewLoading ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={20} />
            ) : (
              <RefreshCw aria-hidden="true" size={20} />
            )}
            {previewLoading ? "Verificando sala" : "Tentar atualizar sala"}
          </button>
          {message ? (
            <p
              aria-live="polite"
              className="text-xs font-semibold leading-5 text-tesText-secondary"
            >
              {message}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (currentAccess && !currentAccess.allowed) {
    return (
      <button
        className="mt-6 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-brand-lavenderSoft px-6 text-sm font-extrabold text-tesText-secondary"
        disabled
        type="button"
      >
        <Video aria-hidden="true" size={20} />
        {getZoomAccessLabel(currentAccess)}
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
    <section className={sectionClassName} aria-label="Sala de video">
      <div className="grid gap-4 rounded-lg border border-brand-lavender bg-surface-soft p-4">
        <div
          className={cn(
            "relative grid overflow-hidden rounded-lg bg-brand-deep",
            displayMode === "dedicated"
              ? "h-[clamp(14rem,42dvh,26rem)] md:grid-cols-2 md:h-[min(52dvh,32rem)]"
              : "min-h-[180px] md:grid-cols-2",
          )}
          data-testid="zoom-video-stage"
        >
          <div
            className={cn(
              "relative z-10 overflow-hidden rounded-lg border border-white/30 bg-brand-deep shadow-card",
              displayMode === "dedicated"
                ? "absolute right-3 top-3 aspect-video w-[38%] md:static md:aspect-auto md:h-full md:w-auto md:rounded-none md:border-0 md:shadow-none"
                : "min-h-[180px]",
            )}
            data-testid="zoom-local-video"
          >
            <div
              className="absolute inset-0 grid place-items-center px-3 text-center text-xs font-semibold text-white/80"
              hidden={videoOn}
            >
              Sua câmera está desligada
            </div>
            {createElement("zoom-video-player-container", {
              "aria-label": "Seu video",
              className: "absolute inset-0 block h-full w-full overflow-hidden",
              ref: localVideoRef,
            })}
          </div>
          <div
            aria-label="Video remoto"
            className={cn(
              "relative grid h-full overflow-hidden bg-white text-sm font-semibold text-tesText-secondary",
              displayMode === "dedicated" ? "min-h-0" : "min-h-[180px]",
            )}
            data-testid="zoom-remote-video"
          >
            <div
              className="absolute inset-0 grid place-items-center px-4 text-center"
              hidden={remoteParticipantCount > 0}
            >
              Aguardando participante
            </div>
            {createElement("zoom-video-player-container", {
              "aria-hidden": remoteParticipantCount === 0,
              className: "absolute inset-0 block h-full w-full overflow-hidden",
              ref: remoteVideoRef,
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {state !== "joined" && state !== "reconnecting" ? (
            <>
              <button
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-80 sm:flex-none"
                disabled={isBusy || !isOnline}
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
                {state === "joining" ? "Entrando..." : "Entrar no encontro"}
              </button>
              <button
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
                disabled={isBusy || !isOnline}
                onClick={() => void reviewPermissions()}
                type="button"
              >
                <Mic aria-hidden="true" size={18} />
                Testar câmera e microfone
              </button>
            </>
          ) : (
            <>
              <button
                aria-pressed={!audioMuted}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
                disabled={isBusy || !isOnline}
                onClick={toggleAudio}
                type="button"
              >
                {audioMuted ? <MicOff size={18} /> : <Mic size={18} />}
                {audioMuted ? "Ativar audio" : "Silenciar"}
              </button>
              <button
                aria-pressed={videoOn}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-wait disabled:opacity-70"
                disabled={isBusy || !isOnline}
                onClick={toggleVideo}
                type="button"
              >
                {videoOn ? <VideoOff size={18} /> : <Video size={18} />}
                {videoOn ? "Desligar camera" : "Ativar camera"}
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-status-error/30 bg-white px-4 text-sm font-extrabold text-status-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-error disabled:cursor-wait disabled:opacity-70"
                disabled={isBusy || !isOnline}
                onClick={() => void leaveSession(false)}
                type="button"
              >
                <PhoneOff size={18} />
                Sair
              </button>
              {roleType === 1 ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-status-error px-4 text-sm font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-error disabled:cursor-wait disabled:opacity-70"
                  disabled={isBusy || !isOnline}
                  onClick={() => void leaveSession(true)}
                  type="button"
                >
                  Encerrar encontro
                </button>
              ) : null}
            </>
          )}
        </div>
        {currentAccess?.hardEndsAt ? (
          <p
            aria-live="polite"
            className="text-xs font-semibold text-tesText-secondary"
          >
            {formatHardEndCountdown(currentAccess, nowMs, serverClockOffsetMs)}
          </p>
        ) : null}
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

      {state === "error" ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-brand-lavender bg-white p-4">
          <p className="text-sm font-extrabold text-brand-deep">
            Recuperar acesso ao encontro
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              disabled={!isOnline}
              onClick={() => void joinSession()}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={18} />
              Tentar novamente
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              disabled={!isOnline}
              onClick={() => void refreshPreviewAccess()}
              type="button"
            >
              <Video aria-hidden="true" size={18} />
              Renovar acesso
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              onClick={() => void reviewPermissions()}
              type="button"
            >
              <Mic aria-hidden="true" size={18} />
              Revisar permissões
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              onClick={backToWaitingRoom}
              type="button"
            >
              <Headphones aria-hidden="true" size={18} />
              Voltar à sala de espera
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              onClick={() => void copySupportReference()}
              type="button"
            >
              <Copy aria-hidden="true" size={18} />
              Copiar referência
            </button>
            <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-lavender bg-surface-soft px-4 text-sm font-extrabold text-brand-deep">
              <Wifi aria-hidden="true" size={18} />
              Verifique conexão
            </span>
          </div>
          {recoveryMessage ? (
            <p
              aria-live="polite"
              className="text-xs font-semibold leading-5 text-tesText-secondary"
            >
              {recoveryMessage}
            </p>
          ) : null}
        </div>
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

function isVideoSessionPayload(
  payload: PreviewPayload | VideoSessionPayload,
): payload is VideoSessionPayload {
  return (
    typeof (payload as VideoSessionPayload).sdkKey === "string" &&
    typeof (payload as VideoSessionPayload).token === "string" &&
    ((payload as VideoSessionPayload).roleType === 0 ||
      (payload as VideoSessionPayload).roleType === 1)
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

function normalizeVideoElements(value: unknown): HTMLElement[] {
  const items = Array.isArray(value) ? value : [value];
  return items.filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  );
}

function styleVideoElement(element: HTMLElement) {
  element.classList.add("block", "h-full", "w-full", "object-cover");
}

function removeVideoElements(elements: HTMLElement[]) {
  for (const element of elements) element.remove();
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
  if (!reason) return "O encontro foi encerrado.";
  if (/host/i.test(reason)) return "O encontro foi encerrado pelo responsavel.";
  if (/kick|remove/i.test(reason))
    return "Seu acesso ao encontro foi encerrado.";
  if (/leave/i.test(reason)) return "Voce saiu do encontro.";

  return "O encontro foi encerrado.";
}

function formatMediaError(error: unknown, target: string) {
  const detail = sanitizeErrorReason(error);
  return `Nao conseguimos ativar ${target}. Verifique permissoes, dispositivos e conexao.${detail ? ` (${detail})` : ""}`;
}

function formatZoomError(error: unknown) {
  if (isAbortError(error)) {
    return "A conexao com a sala demorou mais que o esperado. Tente novamente.";
  }
  if (error instanceof Error && error.message) return error.message;

  return "Nao conseguimos carregar o video. Verifique camera, microfone e conexao.";
}

function formatHardEndCountdown(
  access: ZoomAccessState | null,
  clientNowMs: number,
  serverClockOffsetMs: number,
) {
  if (!access?.hardEndsAt) return "";

  const hardEndsAtMs = Date.parse(access.hardEndsAt);
  if (!Number.isFinite(hardEndsAtMs)) return "";

  const remainingMs = hardEndsAtMs - (clientNowMs + serverClockOffsetMs);
  if (remainingMs <= 0) return "Tempo seguro encerrado.";

  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  return `Tempo restante: ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getServerClockOffsetMs(access: ZoomAccessState | null) {
  if (!access?.serverNow) return 0;

  const serverNowMs = Date.parse(access.serverNow);
  return Number.isFinite(serverNowMs) ? serverNowMs - Date.now() : 0;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
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
