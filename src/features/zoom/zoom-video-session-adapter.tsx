"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Copy, Loader2, Mic, RefreshCw } from "lucide-react";

import { TESDialog } from "@/components/tes";
import { ZoomAccessReason, type ZoomAccessState } from "@/domain/tes";
import { getZoomWaitingRoomStatusFromAccess } from "@/features/bookings";
import { SessionFeedbackForm } from "@/features/session-feedback/components/session-feedback-form";
import { routes } from "@/lib/routes";

import { ZoomVideoControls } from "./components/zoom-video-controls";
import { ZoomVideoStage } from "./components/zoom-video-stage";
import {
  ZoomWaitingRoom,
  type ZoomWaitingRoomMediaPreferences,
} from "./components/zoom-waiting-room";
import {
  assertZoomExecutedResult,
  normalizeConnectionChange,
  normalizeZoomFailure,
  throwIfZoomFailure,
  type NormalizedZoomFailure,
  type ZoomExecutedFailure,
  type ZoomOperationPhase,
} from "./zoom-video-recovery";

type VideoSessionPayload = {
  access: ZoomAccessState;
  requestId?: string;
  roleType: 0 | 1;
  sdkKey: string;
  sessionName: string;
  sessionPasscode: string | null;
  token: string;
  userName: string;
};

type PreviewPayload = {
  access: ZoomAccessState;
  requestId?: string;
};

type ApiResponse =
  | {
      data: PreviewPayload | VideoSessionPayload;
      ok: true;
    }
  | {
      data?: { access?: ZoomAccessState; availableAt?: string };
      error?: { code?: string; message?: string; requestId?: string };
      message?: string;
      ok: false;
    };

type ZoomVideoModule = {
  default: {
    checkSystemRequirements?: () => { audio?: boolean; video?: boolean };
    createClient: () => ZoomVideoClient;
    destroyClient?: () => Promise<void> | void;
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
  ) => Promise<"" | ZoomExecutedFailure>;
  join: (
    sessionName: string,
    token: string,
    userName: string,
    sessionPasscode?: string,
  ) => Promise<"" | ZoomExecutedFailure>;
  leave: (endSession?: boolean) => Promise<"" | ZoomExecutedFailure>;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type ZoomMediaStream = {
  attachVideo?: (
    userId: number,
    quality?: number,
  ) => Promise<HTMLElement | HTMLElement[] | ZoomExecutedFailure>;
  detachVideo?: (
    userId: number,
  ) => Promise<HTMLElement | HTMLElement[] | ZoomExecutedFailure | void>;
  muteAudio?: () => Promise<"" | ZoomExecutedFailure>;
  startAudio?: () => Promise<"" | ZoomExecutedFailure>;
  startVideo?: () => Promise<"" | ZoomExecutedFailure>;
  stopAudio?: () => Promise<"" | ZoomExecutedFailure>;
  stopVideo?: () => Promise<"" | ZoomExecutedFailure>;
  unmuteAudio?: () => Promise<"" | ZoomExecutedFailure>;
};

type SessionState =
  | "idle"
  | "loading"
  | "joining"
  | "joined"
  | "recovering"
  | "reconnecting"
  | "leaving"
  | "ended"
  | "error"
  | "reload_required";

type RemoteVideoState = "off" | "attaching" | "on" | "error";

type CleanupFailure = {
  operation: string;
  reason: string;
};

const ACCESS_REQUEST_TIMEOUT_MS = 12_000;
const AUTH_SESSION_REFRESH_INTERVAL_MS = 5 * 60_000;
const RECOVERY_DEADLINE_MS = 10_000;
const RECONNECT_GRACE_MS = 4_000;
const RECOVERY_RETRY_DELAYS_MS = [0, 1_500, 3_000] as const;
const MAX_JOIN_ATTEMPTS = RECOVERY_RETRY_DELAYS_MS.length;
const AUTOMATIC_REJOIN_ENABLED =
  process.env.NEXT_PUBLIC_ZOOM_REJOIN_RECOVERY_V2 === "true" ||
  process.env.NODE_ENV !== "production";

// The Video SDK client is a browser singleton. Keep its teardown serialized at
// module scope so a route remount cannot create a new client while the previous
// component is still destroying the old one.
let zoomCleanupQueue: Promise<void> = Promise.resolve();
let zoomDestroyInFlight: Promise<void> | null = null;
let zoomDestroyFailure: unknown = null;

function enqueueZoomCleanup<T>(operation: () => Promise<T>) {
  const scheduled = zoomCleanupQueue.catch(() => undefined).then(operation);
  zoomCleanupQueue = scheduled.then(
    () => undefined,
    () => undefined,
  );
  return scheduled;
}

function trackZoomDestroy(operation: Promise<void>) {
  zoomDestroyFailure = null;
  zoomDestroyInFlight = operation;
  operation.then(
    () => {
      if (zoomDestroyInFlight === operation) zoomDestroyInFlight = null;
    },
    (error) => {
      zoomDestroyFailure = error;
      if (zoomDestroyInFlight === operation) zoomDestroyInFlight = null;
    },
  );
  return operation;
}

async function waitForZoomLifecycleIdle() {
  await zoomCleanupQueue;
  while (zoomDestroyInFlight) {
    await zoomDestroyInFlight;
  }
  if (zoomDestroyFailure) {
    const failure: ZoomExecutedFailure = {
      errorCode: 5012,
      reason: "destroy_client_failed",
      type: "INVALID_OPERATION",
    };
    throw failure;
  }
}

async function waitForPriorZoomDestroy() {
  while (zoomDestroyInFlight) {
    await zoomDestroyInFlight;
  }
}

export function ZoomVideoSessionAdapter({
  access,
  actorRole,
  ambientAudioSrc,
  backHref,
  bookingId,
  displayMode = "embedded",
  initialFeedback = false,
  participantLabel = "Com outra pessoa",
  scheduleLabel,
  scheduledEndsAt,
  scheduledStartsAt,
  sessionTitle,
}: {
  access: ZoomAccessState | null;
  actorRole: "patient" | "therapist";
  ambientAudioSrc?: string | null;
  backHref?: string;
  bookingId: string;
  displayMode?: "dedicated" | "embedded";
  initialFeedback?: boolean;
  participantLabel?: string;
  scheduleLabel?: string;
  scheduledEndsAt?: string;
  scheduledStartsAt?: string;
  sessionTitle?: string;
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
  const [localPreviewUnavailable, setLocalPreviewUnavailable] = useState(false);
  const [remoteParticipantPresent, setRemoteParticipantPresent] =
    useState(false);
  const [remoteVideoState, setRemoteVideoState] =
    useState<RemoteVideoState>("off");
  const [roleType, setRoleType] = useState<0 | 1 | null>(null);
  const [cleanupFailures, setCleanupFailures] = useState<CleanupFailure[]>([]);
  const [lastFailure, setLastFailure] = useState<NormalizedZoomFailure | null>(
    null,
  );
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
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
  const finalEndAbortControllerRef = useRef<AbortController | null>(null);
  const authRefreshAbortControllerRef = useRef<AbortController | null>(null);
  const recoveryAbortControllerRef = useRef<AbortController | null>(null);
  const authRefreshInFlightRef = useRef(false);
  const arrivalPreviewRequestedRef = useRef(false);
  const leavingRef = useRef(false);
  const localVideoRef = useRef<HTMLElement | null>(null);
  const remoteVideoRef = useRef<HTMLElement | null>(null);
  const localUserIdRef = useRef<number | null>(null);
  const localUserElementsRef = useRef<HTMLElement[]>([]);
  const remoteUserElementsRef = useRef<Map<number, HTMLElement[]>>(new Map());
  const remoteVideoAttachInFlightRef = useRef<Set<number>>(new Set());
  const remoteVideoResyncTimersRef = useRef<number[]>([]);
  const mediaPreferencesRef = useRef<ZoomWaitingRoomMediaPreferences>({
    cameraEnabled: false,
    microphoneEnabled: false,
  });
  const listenersRef = useRef<
    Array<{ event: string; handler: (...args: unknown[]) => void }>
  >([]);
  const cleanupPromiseRef = useRef<Promise<CleanupFailure[]> | null>(null);
  const attemptGenerationRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const recoveryDeadlineRef = useRef<number | null>(null);
  const lastVideoPayloadRef = useRef<VideoSessionPayload | null>(null);
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
    if (!initialFeedback) return;

    let cancelled = false;

    async function resolveFeedbackIntent() {
      try {
        const response = await fetch(
          `/api/session-feedback?bookingId=${encodeURIComponent(bookingId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as {
          data?: { status?: string };
          ok?: boolean;
        } | null;
        const feedbackStatus = payload?.data?.status;

        if (
          !cancelled &&
          payload?.ok &&
          (feedbackStatus === "eligible" ||
            feedbackStatus === "incident_only" ||
            feedbackStatus === "submitted")
        ) {
          setState("ended");
        }
      } catch {
        // The waiting room remains visible when the intent check is unavailable.
      }
    }

    void resolveFeedbackIntent();
    return () => {
      cancelled = true;
    };
  }, [bookingId, initialFeedback]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    mounted.current = true;

    const handlePageHide = () => {
      void cleanupRef.current?.({ destroyClient: true, endSession: false });
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      mounted.current = false;
      attemptGenerationRef.current += 1;
      previewAbortControllerRef.current?.abort();
      joinAbortControllerRef.current?.abort();
      finalEndAbortControllerRef.current?.abort();
      authRefreshAbortControllerRef.current?.abort();
      recoveryAbortControllerRef.current?.abort();
      clearRemoteVideoResyncTimers();
      clearReconnectTimer();
      window.removeEventListener("pagehide", handlePageHide);
      void cleanupRef.current?.({ destroyClient: true, endSession: false });
    };
  }, []);

  const waitingRoomKind = getZoomWaitingRoomStatusFromAccess(
    currentAccess,
    new Date(nowMs),
  );
  const waitingForTherapist =
    actorRole === "patient" &&
    currentAccess?.reason === ZoomAccessReason.TherapistNotInSession;
  const sectionClassName = displayMode === "dedicated" ? "w-full" : "mt-6";
  const finalEndAvailable = isFinalEndAvailable({
    access: currentAccess,
    clientNowMs: nowMs,
    fallbackEndsAt: scheduledEndsAt,
    serverClockOffsetMs,
  });

  useEffect(() => {
    if (!(currentAccess?.scheduledStartsAt ?? scheduledStartsAt))
      return undefined;

    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [currentAccess?.scheduledStartsAt, scheduledStartsAt]);

  const refreshPreviewAccess = useCallback(
    (forceOnline = false, silent = false) => {
      if (actorRole === "patient") {
        arrivalPreviewRequestedRef.current = true;
      }
      if (!isOnlineRef.current && !forceOnline) {
        setMessage(
          "Sem conexão com a internet. A sala será atualizada quando a conexão voltar.",
        );
        return Promise.resolve(currentAccessRef.current);
      }
      if (previewRequestRef.current) return previewRequestRef.current;

      const controller = new AbortController();
      previewAbortControllerRef.current = controller;
      if (!silent) setPreviewLoading(true);

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
            } else if (
              actorRole === "patient" &&
              refreshedAccess.reason === ZoomAccessReason.TherapistNotInSession
            ) {
              setMessage(
                "Sua chegada foi registrada. A entrada será liberada quando o terapeuta estiver na sala.",
              );
            } else if (
              actorRole === "patient" &&
              refreshedAccess.reason === ZoomAccessReason.TooLate
            ) {
              setMessage(
                "A tolerância de entrada de 10 minutos foi encerrada. Se precisar de ajuda, fale com o suporte.",
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
          if (!silent) setPreviewLoading(false);
        }

        return currentAccessRef.current;
      })();

      previewRequestRef.current = request;
      return request;
    },
    [actorRole, bookingId, updateCurrentAccess],
  );

  const refreshAuthenticatedSession = useCallback(async () => {
    if (!isOnlineRef.current || authRefreshInFlightRef.current) return null;

    const controller = new AbortController();
    authRefreshAbortControllerRef.current = controller;
    authRefreshInFlightRef.current = true;

    try {
      const response = await fetch("/api/auth/session/refresh", {
        body: JSON.stringify({ role: actorRole }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      if (typeof response.arrayBuffer === "function") {
        await response.arrayBuffer().catch(() => undefined);
      }
      return { ok: response.ok, status: response.status };
    } catch {
      // A later interval or reconnection can retry without interrupting media.
      return null;
    } finally {
      if (authRefreshAbortControllerRef.current === controller) {
        authRefreshAbortControllerRef.current = null;
      }
      authRefreshInFlightRef.current = false;
    }
  }, [actorRole]);

  useEffect(() => {
    if (
      (state !== "joined" &&
        state !== "reconnecting" &&
        state !== "recovering") ||
      !isOnline
    ) {
      return undefined;
    }

    void refreshAuthenticatedSession();
    const timer = window.setInterval(
      () => void refreshAuthenticatedSession(),
      AUTH_SESSION_REFRESH_INTERVAL_MS,
    );

    return () => {
      window.clearInterval(timer);
      authRefreshAbortControllerRef.current?.abort();
    };
  }, [isOnline, refreshAuthenticatedSession, state]);

  useEffect(() => {
    const handleOffline = () => {
      isOnlineRef.current = false;
      setIsOnline(false);
      setMessage(
        clientRef.current
          ? "Conexão interrompida. Estamos tentando reconectar o encontro."
          : "Sem conexão com a internet. Reconecte-se para acessar o encontro.",
      );
      if (clientRef.current) setState("reconnecting");
    };
    const handleOnline = () => {
      isOnlineRef.current = true;
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
    if (
      actorRole !== "patient" ||
      state !== "idle" ||
      !currentAccess ||
      arrivalPreviewRequestedRef.current
    ) {
      return;
    }

    arrivalPreviewRequestedRef.current = true;
    void refreshPreviewAccess(false, currentAccess.allowed);
  }, [actorRole, currentAccess, refreshPreviewAccess, state]);

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

  async function joinSession(options?: {
    initialFailure?: NormalizedZoomFailure;
    mediaPreferences?: ZoomWaitingRoomMediaPreferences;
    payload?: VideoSessionPayload;
    startAttempt?: number;
  }) {
    if (inFlight.current) return;
    if (clientRef.current && !options?.payload) return;
    if (!isOnlineRef.current && !options?.payload) {
      const failure = normalizeZoomFailure(new TypeError("offline"), "access");
      setLastFailure(failure);
      setState("error");
      setMessage(failure.userMessage);
      return;
    }
    if (options?.mediaPreferences) {
      mediaPreferencesRef.current = { ...options.mediaPreferences };
    }
    inFlight.current = true;
    recoveryAbortControllerRef.current?.abort();
    const recoveryController = new AbortController();
    recoveryAbortControllerRef.current = recoveryController;
    clearReconnectTimer();
    setCleanupFailures([]);
    setLastFailure(null);
    setRecoveryMessage(null);
    setRecoveryAttempt(0);

    try {
      if (!options?.payload) {
        const refreshResponse = await refreshAuthenticatedSession();
        if (refreshResponse?.status === 401) {
          throw createSdkFailure(401, "authentication_expired", "access");
        }
      }

      const videoPayload = options?.payload ?? (await requestJoinAccess());
      if (!videoPayload || !mounted.current) return;

      recoveryDeadlineRef.current = Date.now() + RECOVERY_DEADLINE_MS;

      lastVideoPayloadRef.current = videoPayload;
      updateCurrentAccess(videoPayload.access);
      setRoleType(videoPayload.roleType);
      if (videoPayload.requestId) {
        setRequestId(videoPayload.requestId);
      }

      const startAttempt = Math.max(1, options?.startAttempt ?? 1);
      let finalFailure: NormalizedZoomFailure | null =
        options?.initialFailure ?? null;

      for (
        let attempt = startAttempt;
        attempt <= MAX_JOIN_ATTEMPTS;
        attempt += 1
      ) {
        if (!mounted.current) return;
        const deadline = recoveryDeadlineRef.current ?? Date.now();
        if (Date.now() >= deadline) break;

        if (attempt > 1) {
          setState("recovering");
          setRecoveryAttempt(attempt);
          setMessage("Reconectando à sua sessão…");
          const ready = await waitForRecoveryWindow(
            RECOVERY_RETRY_DELAYS_MS[attempt - 1],
          );
          if (!ready) break;
        } else {
          setState("joining");
          setMessage("Carregando vídeo...");
        }

        await cleanup({ destroyClient: true, endSession: false });
        if (!mounted.current) return;

        try {
          await performSdkJoin(videoPayload);
          return;
        } catch (error) {
          finalFailure = normalizeZoomFailure(error, "join");
          logClientFailure(finalFailure, attempt);
          await cleanup({ destroyClient: true, endSession: false });

          if (
            !AUTOMATIC_REJOIN_ENABLED ||
            !finalFailure.retryable ||
            attempt >= MAX_JOIN_ATTEMPTS
          ) {
            break;
          }
        }
      }

      if (finalFailure && mounted.current) {
        presentJoinFailure(finalFailure);
      }
    } catch (error) {
      if (!mounted.current) return;
      const failure = normalizeZoomFailure(error, "access");
      logClientFailure(failure, 0);
      presentJoinFailure(failure);
      await cleanup({ destroyClient: true, endSession: false });
    } finally {
      inFlight.current = false;
      recoveryDeadlineRef.current = null;
      if (recoveryAbortControllerRef.current === recoveryController) {
        recoveryAbortControllerRef.current = null;
      }
    }
  }

  async function requestJoinAccess(): Promise<VideoSessionPayload | null> {
    setState("loading");
    setMessage("Preparando sua sala...");

    const controller = new AbortController();
    joinAbortControllerRef.current = controller;
    const timeout = window.setTimeout(
      () => controller.abort(),
      ACCESS_REQUEST_TIMEOUT_MS,
    );

    try {
      let response = await fetchJoinAccess(controller.signal);
      let payload: ApiResponse | null = null;
      if (response.status === 401) {
        payload = await readAccessResponse(response);
        if (!payload?.ok && payload?.error?.requestId) {
          setRequestId(payload.error.requestId);
        }

        const refreshResponse = await refreshAuthenticatedSession();
        if (refreshResponse?.ok && mounted.current) {
          response = await fetchJoinAccess(controller.signal);
          payload = null;
        }
      } else if (response.status >= 500 && mounted.current) {
        await waitWithAbort(1_000, controller.signal);
        response = await fetchJoinAccess(controller.signal);
      }

      payload ??= await readAccessResponse(response);
      if (!payload) {
        throw createSdkFailure(2, "invalid_access_response", "access");
      }

      if (!payload.ok && payload.error?.requestId) {
        setRequestId(payload.error.requestId);
      }

      if (!response.ok || !payload.ok) {
        if (!payload.ok && payload.data?.access) {
          updateCurrentAccess(payload.data.access);
          if (
            payload.data.access.reason ===
            ZoomAccessReason.TherapistNotInSession
          ) {
            setState("idle");
            setMessage(
              "Sua chegada foi registrada. A entrada será liberada quando o terapeuta estiver na sala.",
            );
            return null;
          }
          if (payload.data.access.reason === ZoomAccessReason.TooLate) {
            setState("idle");
            setMessage(
              "A tolerância de entrada de 10 minutos foi encerrada. Se precisar de ajuda, fale com o suporte.",
            );
            return null;
          }
        }

        throw createSdkFailure(
          response.status >= 500 ? 1 : 5013,
          response.status === 401
            ? "authentication_expired"
            : normalizeAccessDomainReason(
                payload.ok ? undefined : payload.error?.code,
              ),
          "access",
        );
      }

      if (!isVideoSessionPayload(payload.data)) {
        throw createSdkFailure(5013, "invalid_access_payload", "access");
      }

      return payload.data;
    } finally {
      window.clearTimeout(timeout);
      if (joinAbortControllerRef.current === controller) {
        joinAbortControllerRef.current = null;
      }
    }
  }

  function fetchJoinAccess(signal: AbortSignal) {
    return fetch("/api/zoom/video-session-access", {
      body: JSON.stringify({ actorRole, bookingId, intent: "join" }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal,
    });
  }

  async function readAccessResponse(response: Response) {
    return (await response.json().catch(() => null)) as ApiResponse | null;
  }

  async function performSdkJoin(videoPayload: VideoSessionPayload) {
    const generation = ++attemptGenerationRef.current;
    await awaitWithinRecoveryDeadline(waitForZoomLifecycleIdle());
    const zoomModule =
      (await import("@zoom/videosdk")) as unknown as ZoomVideoModule;
    ensureCurrentAttempt(generation);
    const ZoomVideo = zoomModule.default;
    zoomModuleRef.current = ZoomVideo;
    const requirements = ZoomVideo.checkSystemRequirements?.();

    if (requirements && (!requirements.audio || !requirements.video)) {
      throw createSdkFailure(5000, "unsupported_browser", "init");
    }

    if (ZoomVideo.preloadDependentAssets) {
      await awaitWithinRecoveryDeadline(
        Promise.resolve(ZoomVideo.preloadDependentAssets()),
      );
    }
    ensureCurrentAttempt(generation);
    const client = ZoomVideo.createClient();
    clientRef.current = client;
    registerClientListeners(client, generation);

    await awaitExecutedZoomOperation(
      client.init("pt-BR", "Global", {
        enforceMultipleVideos: true,
        leaveOnPageUnload: true,
        patchJsMedia: true,
        stayAwake: true,
      }),
      "init",
    );
    ensureCurrentAttempt(generation);
    await awaitExecutedZoomOperation(
      client.join(
        videoPayload.sessionName,
        videoPayload.token,
        videoPayload.userName,
        videoPayload.sessionPasscode ?? undefined,
      ),
      "join",
    );
    ensureCurrentAttempt(generation);

    const stream = client.getMediaStream();
    streamRef.current = stream;
    localUserIdRef.current = client.getCurrentUserInfo?.().userId ?? null;
    if (stream.startAudio) {
      await awaitExecutedZoomOperation(stream.startAudio(), "audio");
    }
    if (stream.muteAudio) {
      await awaitExecutedZoomOperation(stream.muteAudio(), "audio");
    }

    let microphoneEnabled = false;
    let initialMediaMessage: string | null = null;
    if (mediaPreferencesRef.current.microphoneEnabled) {
      try {
        if (stream.unmuteAudio) {
          await awaitExecutedZoomOperation(stream.unmuteAudio(), "audio");
        }
        microphoneEnabled = true;
      } catch (error) {
        initialMediaMessage = formatMediaError(error, "o microfone");
      }
    }

    if (mediaPreferencesRef.current.cameraEnabled) {
      try {
        await enableVideoForSession(stream);
      } catch (error) {
        mediaPreferencesRef.current.cameraEnabled = false;
        initialMediaMessage ??= formatMediaError(error, "a câmera");
      }
    }
    await renderExistingRemoteVideos();
    scheduleRemoteVideoResync();
    ensureCurrentAttempt(generation);

    setAudioMuted(!microphoneEnabled);
    setRecoveryAttempt(0);
    setLastFailure(null);
    inFlight.current = false;
    setState("joined");
    setMessage(
      initialMediaMessage ??
        (actorRole === "therapist"
          ? "Você entrou como responsável pelo encontro."
          : "Você entrou no encontro. Aguarde se a outra pessoa ainda não estiver presente."),
    );
  }

  async function awaitExecutedZoomOperation(
    operation: Promise<unknown>,
    phase: ZoomOperationPhase,
  ) {
    const result = await awaitWithinRecoveryDeadline(operation);
    assertZoomExecutedResult(result, phase);
  }

  function awaitWithinRecoveryDeadline<T>(operation: Promise<T>) {
    const deadline = recoveryDeadlineRef.current ?? Date.now();
    const remainingMs = Math.max(1, deadline - Date.now());
    return withAbortDeadline(
      operation,
      remainingMs,
      recoveryAbortControllerRef.current?.signal,
    );
  }

  async function waitForRecoveryWindow(delayMs: number) {
    const signal = recoveryAbortControllerRef.current?.signal;
    if (!signal || signal.aborted || !mounted.current) return false;
    let remainingDelayMs = delayMs;

    while (mounted.current && !signal.aborted) {
      while (!isBrowserOnline()) {
        setMessage(
          "Sua internet caiu. Vamos retomar a conexão automaticamente quando ela voltar.",
        );
        const offlineStartedAt = Date.now();
        const resumed = await waitForOnline(null, signal);
        if (!resumed) return false;
        if (recoveryDeadlineRef.current !== null) {
          recoveryDeadlineRef.current += Date.now() - offlineStartedAt;
        }
      }

      const deadline = recoveryDeadlineRef.current ?? Date.now();
      const remainingWindowMs = deadline - Date.now();
      if (remainingWindowMs <= 0) return false;
      if (remainingDelayMs <= 0) return true;

      const delayStartedAt = Date.now();
      const result = await waitForDelayOrOffline(
        Math.min(remainingDelayMs, remainingWindowMs),
        signal,
      );
      remainingDelayMs = Math.max(
        0,
        remainingDelayMs - (Date.now() - delayStartedAt),
      );
      if (result === "aborted") return false;
      if (result === "elapsed" && isBrowserOnline()) {
        return true;
      }
    }

    return false;
  }

  function ensureCurrentAttempt(generation: number) {
    if (!mounted.current || generation !== attemptGenerationRef.current) {
      throw new DOMException("Stale Zoom attempt", "AbortError");
    }
  }

  function presentJoinFailure(failure: NormalizedZoomFailure) {
    setLastFailure(failure);
    setRecoveryAttempt(0);
    if (failure.shouldReload || failure.category === "transient") {
      setState("reload_required");
      setMessage(
        "A conexão anterior da sala não foi encerrada por completo. Recarregue esta página para reiniciar somente o vídeo e entrar novamente. Seu encontro, horário e pagamento não serão alterados.",
      );
      return;
    }

    setState("error");
    setMessage(failure.userMessage);
  }

  function logClientFailure(failure: NormalizedZoomFailure, attempt: number) {
    console.warn(
      JSON.stringify({
        attempt,
        code: failure.code ?? "unknown",
        phase: failure.phase,
        recovery: failure.category,
        requestId: requestId ?? lastVideoPayloadRef.current?.requestId ?? null,
      }),
    );
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
    const reference = [
      "TES",
      bookingId.slice(0, 8),
      lastFailure?.phase ?? state,
      lastFailure?.code ?? "NA",
      requestId?.replace(/-/g, "").slice(-8) ?? "sem-ref",
    ].join("-");

    try {
      await navigator.clipboard?.writeText(reference);
      setRecoveryMessage("Referencia copiada para o suporte.");
    } catch {
      setRecoveryMessage(`Referencia do encontro: ${reference}`);
    }
  }

  async function backToWaitingRoom() {
    recoveryAbortControllerRef.current?.abort();
    clearReconnectTimer();
    await cleanup({ destroyClient: true, endSession: false });
    if (!mounted.current) return;
    setState("idle");
    setMessage(null);
    setRecoveryMessage(null);
  }

  async function toggleAudio() {
    const stream = streamRef.current;
    if (!stream || state !== "joined" || leavingRef.current) return;

    try {
      if (audioMuted) {
        if (stream.unmuteAudio) {
          assertZoomExecutedResult(await stream.unmuteAudio(), "audio");
        }
        setAudioMuted(false);
        mediaPreferencesRef.current.microphoneEnabled = true;
      } else {
        if (stream.muteAudio) {
          assertZoomExecutedResult(await stream.muteAudio(), "audio");
        }
        setAudioMuted(true);
        mediaPreferencesRef.current.microphoneEnabled = false;
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
        await disableVideoForSession(stream);
        return;
      }

      await enableVideoForSession(stream, container);
    } catch (error) {
      setMessage(formatMediaError(error, "camera"));
    }
  }

  async function enableVideoForSession(
    stream: ZoomMediaStream,
    container = localVideoRef.current,
  ) {
    let started = false;

    try {
      if (stream.startVideo) {
        assertZoomExecutedResult(await stream.startVideo(), "video");
      }
      started = true;
      const userId =
        localUserIdRef.current ??
        clientRef.current?.getCurrentUserInfo?.().userId;
      if (!userId) throw new Error("participant_not_ready");

      localUserIdRef.current = userId;
      if (!container) {
        setVideoOn(true);
        setLocalPreviewUnavailable(true);
        mediaPreferencesRef.current.cameraEnabled = true;
        return;
      }

      const attached = throwIfZoomFailure(
        await stream.attachVideo?.(userId, 2),
        "video",
      );
      const elements = normalizeVideoElements(attached);
      if (elements.length === 0) {
        setVideoOn(true);
        setLocalPreviewUnavailable(true);
        mediaPreferencesRef.current.cameraEnabled = true;
        return;
      }

      for (const element of elements) {
        styleVideoElement(element);
        container.appendChild(element);
      }
      localUserElementsRef.current = elements;
      setVideoOn(true);
      setLocalPreviewUnavailable(false);
      mediaPreferencesRef.current.cameraEnabled = true;
    } catch (error) {
      if (started) {
        removeVideoElements(localUserElementsRef.current);
        localUserElementsRef.current = [];
        try {
          await stream.stopVideo?.();
        } catch {
          // Preserve the original media error for the user-facing message.
        }
      }
      setVideoOn(false);
      setLocalPreviewUnavailable(false);
      throw error;
    }
  }

  async function disableVideoForSession(stream: ZoomMediaStream) {
    const userId =
      localUserIdRef.current ??
      clientRef.current?.getCurrentUserInfo?.().userId;
    if (userId) {
      throwIfZoomFailure(await stream.detachVideo?.(userId), "video");
    }
    removeVideoElements(localUserElementsRef.current);
    localUserElementsRef.current = [];
    if (stream.stopVideo) {
      assertZoomExecutedResult(await stream.stopVideo(), "video");
    }
    setVideoOn(false);
    setLocalPreviewUnavailable(false);
    mediaPreferencesRef.current.cameraEnabled = false;
  }

  async function leaveSession(endSession = false) {
    if (leavingRef.current) return;
    if (endSession) {
      if (!finalEndAvailable) {
        setMessage(
          "O encerramento para todos ficará disponível nos 5 minutos finais.",
        );
        return;
      }
      setEndDialogOpen(true);
      return;
    }

    await completeLeave(false);
  }

  async function completeLeave(endSession: boolean) {
    if (leavingRef.current) return;

    if (endSession) {
      await completeFinalEnd();
      return;
    }

    leavingRef.current = true;
    setEndDialogOpen(false);
    setState("leaving");
    setMessage("Saindo do encontro...");

    const failures = await cleanup({ destroyClient: true, endSession: false });
    leavingRef.current = false;

    if (!mounted.current) return;
    if (failures.length > 0) {
      setState("error");
      setMessage(
        "Nao foi possivel concluir todas as etapas de saída. Confira sua conexão e tente novamente.",
      );
      return;
    }

    setState("idle");
    await refreshPreviewAccess();
    setMessage(
      actorRole === "patient"
        ? "Você saiu do encontro. Você pode entrar novamente enquanto o encontro estiver ativo e o terapeuta estiver na sala."
        : "Você saiu da sessão. Você pode entrar novamente enquanto a sessão estiver ativa.",
    );
  }

  async function completeFinalEnd() {
    if (leavingRef.current || !finalEndAvailable) return;

    leavingRef.current = true;
    setEndDialogOpen(false);
    setState("leaving");
    setMessage("Encerrando o encontro para todos...");

    const controller = new AbortController();
    finalEndAbortControllerRef.current = controller;
    const timeout = window.setTimeout(
      () => controller.abort(),
      ACCESS_REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch("/api/zoom/video-session-access", {
        body: JSON.stringify({ actorRole, bookingId, intent: "end" }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.ok) {
        setState("joined");
        setMessage(
          !payload.ok && payload.error?.code === "FINAL_END_TOO_EARLY"
            ? "O encerramento para todos ficará disponível nos 5 minutos finais."
            : "Não foi possível encerrar o encontro para todos. A chamada continua ativa; tente novamente.",
        );
        return;
      }

      const failures = await cleanup({
        destroyClient: true,
        endSession: false,
      });
      setState("ended");
      setMessage(
        failures.length > 0
          ? "O encontro foi encerrado. Houve uma falha ao limpar a mídia local; você já pode compartilhar seu feedback."
          : "O encontro foi encerrado. Você já pode compartilhar seu feedback e confirmar como ele aconteceu.",
      );
    } catch {
      setState("joined");
      setMessage(
        "Não foi possível encerrar o encontro para todos. A chamada continua ativa; tente novamente.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (finalEndAbortControllerRef.current === controller) {
        finalEndAbortControllerRef.current = null;
      }
      leavingRef.current = false;
    }
  }

  async function resolveProviderClosure(reason?: string) {
    await cleanup({ destroyClient: true, endSession: false });

    try {
      const response = await fetch(
        `/api/session-feedback?bookingId=${encodeURIComponent(bookingId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as {
        data?: { status?: string };
        ok?: boolean;
      } | null;
      const feedbackStatus = payload?.data?.status;
      const feedbackAvailable =
        payload?.ok &&
        (feedbackStatus === "eligible" ||
          feedbackStatus === "incident_only" ||
          feedbackStatus === "submitted");

      if (feedbackAvailable) {
        setState("ended");
        setMessage(
          "O encontro foi encerrado. Você já pode compartilhar seu feedback e confirmar como ele aconteceu.",
        );
        return;
      }
    } catch {
      // Fail closed: a provider disconnect alone cannot confirm completion.
    }

    setState("error");
    setMessage(
      `${formatClosedReason(reason)} A confirmação do encontro ficará disponível somente no horário previsto.`,
    );
  }

  async function cleanup(input: {
    destroyClient: boolean;
    endSession: boolean;
  }) {
    if (cleanupPromiseRef.current) return cleanupPromiseRef.current;

    const scheduled = enqueueZoomCleanup(() => runCleanup(input));
    cleanupPromiseRef.current = scheduled.finally(() => {
      cleanupPromiseRef.current = null;
    });

    return cleanupPromiseRef.current;
  }

  async function runCleanup(input: {
    destroyClient: boolean;
    endSession: boolean;
  }): Promise<CleanupFailure[]> {
    const failures: CleanupFailure[] = [];
    attemptGenerationRef.current += 1;
    const client = clientRef.current;
    const stream = streamRef.current;

    for (const listener of listenersRef.current) {
      await recordCleanupFailure(failures, `listener:${listener.event}`, () =>
        client?.off?.(listener.event, listener.handler),
      );
    }
    listenersRef.current = [];
    clearRemoteVideoResyncTimers();

    await stopAllRemoteVideos(failures);

    const localUserId = localUserIdRef.current;
    const hadAttachedLocalVideo = localUserElementsRef.current.length > 0;
    if (stream && localUserId && hadAttachedLocalVideo) {
      await recordCleanupFailure(failures, "detachVideo:local", () =>
        detectCleanupFailure(stream.detachVideo?.(localUserId)),
      );
    }
    removeVideoElements(localUserElementsRef.current);
    localUserElementsRef.current = [];
    if (hadAttachedLocalVideo || videoOn) {
      await recordCleanupFailure(failures, "stopVideo", () =>
        detectCleanupFailure(stream?.stopVideo?.()),
      );
    }
    await recordCleanupFailure(failures, "stopAudio", () =>
      detectCleanupFailure(stream?.stopAudio?.()),
    );
    await recordCleanupFailure(failures, "leave", () =>
      detectCleanupFailure(client?.leave(input.endSession)),
    );
    if (input.destroyClient) {
      const destroyClient = zoomModuleRef.current?.destroyClient;
      if (destroyClient) {
        await waitForPriorZoomDestroy();
        const destroyPromise = trackZoomDestroy(
          Promise.resolve().then(() => destroyClient()),
        );
        const deadline =
          recoveryDeadlineRef.current ?? Date.now() + RECOVERY_DEADLINE_MS;
        await recordCleanupFailure(failures, "destroyClient", () =>
          withAbortDeadline(
            destroyPromise,
            Math.max(1, deadline - Date.now()),
            recoveryAbortControllerRef.current?.signal,
          ),
        );
      }
    }

    clientRef.current = null;
    streamRef.current = null;
    zoomModuleRef.current = null;
    localUserIdRef.current = null;
    remoteUserElementsRef.current.clear();
    remoteVideoAttachInFlightRef.current.clear();
    setRemoteParticipantPresent(false);
    setRemoteVideoState("off");
    setVideoOn(false);
    setLocalPreviewUnavailable(false);
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

  function registerClientListeners(
    client: ZoomVideoClient,
    generation: number,
  ) {
    const isCurrentClient = () =>
      mounted.current &&
      generation === attemptGenerationRef.current &&
      client === clientRef.current;
    const connectionChange = (payload: unknown) => {
      if (!isCurrentClient()) return;
      const normalized = normalizeConnectionChange(payload);
      if (normalized.state === "Reconnecting") {
        setState("reconnecting");
        setMessage("Reconectando o encontro...");
        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(() => {
          const failure = normalizeZoomFailure(
            createSdkFailure(
              normalized.errorCode ?? 5003,
              normalized.reason ?? "reconnect_timeout",
              "connection",
            ),
            "connection",
          );
          void recoverConnectedSession(failure, generation);
        }, RECONNECT_GRACE_MS);
      } else if (normalized.state === "Connected") {
        clearReconnectTimer();
        setState("joined");
        setMessage("Conexao restabelecida.");
        scheduleRemoteVideoResync();
      } else if (normalized.state === "Closed") {
        clearReconnectTimer();
        if (leavingRef.current) return;
        const failure = normalizeZoomFailure(
          createSdkFailure(
            normalized.errorCode ?? 2,
            normalized.reason ?? "connection_closed",
            "connection",
          ),
          "connection",
        );
        if (isDefinitiveProviderClosure(failure)) {
          setState("leaving");
          setMessage("Confirmando o encerramento do encontro...");
          void resolveProviderClosure(normalized.reason);
        } else if (failure.retryable) {
          void recoverConnectedSession(failure, generation);
        } else {
          presentJoinFailure(failure);
          void cleanup({ destroyClient: true, endSession: false });
        }
      } else if (normalized.state === "Fail") {
        clearReconnectTimer();
        const failure = normalizeZoomFailure(
          createSdkFailure(
            normalized.errorCode ?? 2,
            normalized.reason ?? "connection_failed",
            "connection",
          ),
          "connection",
        );
        if (failure.retryable) {
          void recoverConnectedSession(failure, generation);
        } else {
          presentJoinFailure(failure);
          void cleanup({ destroyClient: true, endSession: false });
        }
      }
    };
    const userAdded = (payload: unknown) => {
      if (!isCurrentClient()) return;
      setMessage("A outra pessoa entrou no encontro.");
      void renderRemoteParticipantUpdates(asParticipantArray(payload));
    };
    const userRemoved = (payload: unknown) => {
      if (!isCurrentClient()) return;
      setMessage("A outra pessoa saiu do encontro.");
      void detachRemoteParticipants(asParticipantArray(payload));
    };
    const userUpdated = (payload: unknown) => {
      if (!isCurrentClient()) return;
      void renderRemoteParticipantUpdates(asParticipantArray(payload));
    };
    const peerVideoStateChange = (payload: unknown) => {
      if (!isCurrentClient()) return;
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
      if (!isCurrentClient()) return;
      const failure = normalizeZoomFailure(payload, "video");
      setLastFailure(failure);
      if (failure.shouldReload) {
        setState("reload_required");
      }
      setMessage(failure.userMessage);
    };
    const devicePermissionChange = (payload: unknown) => {
      if (!isCurrentClient()) return;
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

  async function recoverConnectedSession(
    failure: NormalizedZoomFailure,
    generation: number,
  ) {
    if (
      inFlight.current ||
      generation !== attemptGenerationRef.current ||
      !mounted.current
    ) {
      return;
    }

    const payload = lastVideoPayloadRef.current;
    if (!AUTOMATIC_REJOIN_ENABLED || !payload) {
      presentJoinFailure(failure);
      await cleanup({ destroyClient: true, endSession: false });
      return;
    }

    setLastFailure(failure);
    await joinSession({ initialFailure: failure, payload, startAttempt: 2 });
  }

  function clearReconnectTimer() {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }

  async function renderExistingRemoteVideos() {
    const users = clientRef.current?.getAllUser?.() ?? [];
    await renderRemoteParticipants(users);
  }

  async function renderRemoteParticipantUpdates(users: ZoomParticipant[]) {
    const remoteUsers = users.filter(
      (user) => user.userId && user.userId !== localUserIdRef.current,
    );

    if (remoteUsers.length === 0) return;

    setRemoteParticipantPresent(true);

    for (const user of remoteUsers) {
      if (user.bVideoOn === true) {
        await attachRemoteVideo(user.userId);
      } else if (
        user.bVideoOn === false &&
        remoteUserElementsRef.current.has(user.userId)
      ) {
        await detachRemoteVideo(user.userId, true);
      }
    }
  }

  async function renderRemoteParticipants(users: ZoomParticipant[]) {
    const remoteUsers = users.filter(
      (user) => user.userId && user.userId !== localUserIdRef.current,
    );

    setRemoteParticipantPresent(remoteUsers.length > 0);

    for (const [userId] of remoteUserElementsRef.current) {
      const current = remoteUsers.find((user) => user.userId === userId);
      if (!current?.bVideoOn) await detachRemoteVideo(userId, true);
    }

    for (const user of remoteUsers) {
      if (user.bVideoOn) {
        await attachRemoteVideo(user.userId);
      }
    }

    if (remoteUserElementsRef.current.size > 0) setRemoteVideoState("on");
    else if (!remoteUsers.some((user) => user.bVideoOn))
      setRemoteVideoState("off");
  }

  async function attachRemoteVideo(userId: number) {
    const stream = streamRef.current;
    const container = remoteVideoRef.current;
    if (!stream?.attachVideo || !container) return;
    if (
      remoteUserElementsRef.current.has(userId) ||
      remoteVideoAttachInFlightRef.current.has(userId)
    )
      return;

    remoteVideoAttachInFlightRef.current.add(userId);
    setRemoteParticipantPresent(true);
    setRemoteVideoState("attaching");

    try {
      const attached = throwIfZoomFailure(
        await stream.attachVideo(userId, 2),
        "video",
      );
      const elements = normalizeVideoElements(attached);
      if (elements.length === 0) throw new Error("remote_video_not_attached");
      for (const element of elements) {
        styleVideoElement(element);
        container.appendChild(element);
      }
      remoteUserElementsRef.current.set(userId, elements);
      setRemoteVideoState("on");
    } catch (error) {
      setRemoteVideoState("error");
      setMessage(formatMediaError(error, "video remoto"));
    } finally {
      remoteVideoAttachInFlightRef.current.delete(userId);
    }
  }

  async function detachRemoteParticipants(users: ZoomParticipant[]) {
    for (const user of users) {
      if (user.userId && user.userId !== localUserIdRef.current) {
        await detachRemoteVideo(user.userId, false);
      }
    }

    setRemoteParticipantPresent(false);
    if (remoteUserElementsRef.current.size === 0) setRemoteVideoState("off");
  }

  async function detachRemoteVideo(
    userId: number,
    participantStillPresent = true,
  ) {
    const failures: CleanupFailure[] = [];
    await detachRemoteVideoWithFailures(userId, failures);
    if (failures.length > 0) {
      setCleanupFailures((current) => [...current, ...failures]);
    }
    setRemoteParticipantPresent(participantStillPresent);
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
      detectCleanupFailure(stream?.detachVideo?.(userId)),
    );

    const elements = remoteUserElementsRef.current.get(userId) ?? [];
    for (const element of elements) {
      element.remove();
    }
    remoteUserElementsRef.current.delete(userId);
    if (remoteUserElementsRef.current.size === 0) setRemoteVideoState("off");
  }

  function clearRemoteVideoResyncTimers() {
    for (const timer of remoteVideoResyncTimersRef.current) {
      window.clearTimeout(timer);
    }
    remoteVideoResyncTimersRef.current = [];
  }

  function scheduleRemoteVideoResync() {
    clearRemoteVideoResyncTimers();
    for (const delay of [0, 350, 1_200]) {
      const timer = window.setTimeout(() => {
        if (mounted.current && clientRef.current)
          void renderExistingRemoteVideos();
      }, delay);
      remoteVideoResyncTimersRef.current.push(timer);
    }
  }

  if (state === "ended") {
    return (
      <section className={sectionClassName} aria-label="Feedback da sessão">
        <SessionFeedbackForm
          actorRole={actorRole}
          bookingId={bookingId}
          introductoryMessage={message}
          sessionLabel={
            actorRole === "patient"
              ? "Seu encontro foi encerrado"
              : "Sua sessão foi encerrada"
          }
        />
        {backHref ? (
          <a
            className="mx-auto mt-4 flex min-h-11 w-fit items-center justify-center rounded-full border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={backHref}
          >
            Voltar aos detalhes
          </a>
        ) : null}
      </section>
    );
  }

  if (state === "idle") {
    const waitingKind = currentAccess?.allowed
      ? "entry_available"
      : currentAccess?.reason === ZoomAccessReason.TooEarly
        ? "too_early"
        : currentAccess?.reason === ZoomAccessReason.TooLate ||
            currentAccess?.reason === ZoomAccessReason.HardTimeout ||
            waitingRoomKind === "ended"
          ? "ended"
          : waitingRoomKind === "therapist_absent_prolonged"
            ? "therapist_absent_prolonged"
            : currentAccess?.reason === ZoomAccessReason.TherapistNotInSession
              ? "waiting_therapist"
              : "operational_unavailable";

    return (
      <ZoomWaitingRoom
        actorRole={actorRole}
        ambientAudioSrc={ambientAudioSrc}
        countdownLabel={
          waitingKind === "too_early"
            ? formatRoomOpeningCountdown(
                currentAccess,
                nowMs,
                serverClockOffsetMs,
              )
            : formatScheduledSessionCountdown({
                access: currentAccess,
                actorRole,
                clientNowMs: nowMs,
                fallbackEndsAt: scheduledEndsAt,
                fallbackStartsAt: scheduledStartsAt,
                serverClockOffsetMs,
              })
        }
        isOnline={isOnline}
        kind={waitingKind}
        message={recoveryMessage ?? message}
        onJoin={(mediaPreferences) => void joinSession({ mediaPreferences })}
        onRefresh={() => void refreshPreviewAccess()}
        bookingId={bookingId}
        participantLabel={participantLabel}
        previewLoading={previewLoading}
        scheduleLabel={scheduleLabel}
        sessionTitle={sessionTitle}
        supportHref={
          actorRole === "patient"
            ? `${routes.patient.messages}?context=suporte&booking=${bookingId}`
            : `${routes.therapist.messages}?context=suporte&booking=${bookingId}`
        }
      />
    );
  }

  const isBusy =
    state === "loading" ||
    state === "joining" ||
    state === "recovering" ||
    state === "leaving" ||
    inFlight.current ||
    leavingRef.current;
  const activeSessionCountdown = formatActiveSessionCountdown({
    access: currentAccess,
    actorRole,
    clientNowMs: nowMs,
    fallbackEndsAt: scheduledEndsAt,
    fallbackStartsAt: scheduledStartsAt,
    serverClockOffsetMs,
  });

  return (
    <section className={sectionClassName} aria-label="Sala de video">
      <div className="grid gap-4">
        <ZoomVideoStage
          actorRole={actorRole}
          audioMuted={audioMuted}
          localVideoRef={localVideoRef}
          localPreviewUnavailable={localPreviewUnavailable}
          onRetryRemoteVideo={scheduleRemoteVideoResync}
          participantLabel={participantLabel}
          remoteParticipantPresent={remoteParticipantPresent}
          remoteVideoState={remoteVideoState}
          remoteVideoRef={remoteVideoRef}
          state={state}
          videoOn={videoOn}
        />

        <ZoomVideoControls
          actorRole={actorRole}
          audioMuted={audioMuted}
          canEndForAll={finalEndAvailable}
          isBusy={isBusy}
          isOnline={isOnline}
          onJoin={() => void joinSession()}
          onLeave={() => void leaveSession(false)}
          onReviewPermissions={() => void reviewPermissions()}
          onTherapistEnd={() => void leaveSession(true)}
          onToggleAudio={() => void toggleAudio()}
          onToggleVideo={() => void toggleVideo()}
          roleType={roleType}
          state={state}
          supportHref={`${actorRole === "patient" ? routes.patient.messages : routes.therapist.messages}?context=suporte&booking=${bookingId}`}
          videoOn={videoOn}
        />
        {activeSessionCountdown ? (
          <p
            aria-live="polite"
            className="text-center text-xs font-semibold text-tesText-secondary"
          >
            {activeSessionCountdown}
          </p>
        ) : null}
      </div>

      {state === "recovering" ? (
        <div
          aria-live="polite"
          className="mt-3 flex items-center gap-3 rounded-lg border border-brand-lavender bg-surface-soft p-4 text-brand-deep"
          role="status"
        >
          <Loader2 aria-hidden="true" className="animate-spin" size={20} />
          <div>
            <p className="text-sm font-extrabold">Reconectando à sua sessão…</p>
            <p className="text-xs font-semibold text-tesText-secondary">
              Tentativa {recoveryAttempt} de {MAX_JOIN_ATTEMPTS}
            </p>
          </div>
        </div>
      ) : null}

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

      {state === "error" || state === "reload_required" ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-brand-lavender bg-white p-4">
          <p className="text-sm font-extrabold text-brand-deep">
            {state === "reload_required"
              ? "Reiniciar o vídeo da sala"
              : "Recuperar acesso ao encontro"}
          </p>
          <div className="flex flex-wrap gap-2">
            {lastFailure?.phase === "access" && lastFailure.code === 401 ? (
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                href={
                  actorRole === "patient"
                    ? routes.public.clientSignIn
                    : routes.public.therapistSignIn
                }
              >
                Entrar novamente
              </a>
            ) : null}
            {state === "reload_required" ? (
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onClick={() => window.location.reload()}
                type="button"
              >
                <RefreshCw aria-hidden="true" size={18} />
                Recarregar sala
              </button>
            ) : null}
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              disabled={!isOnline}
              onClick={() => void joinSession()}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={18} />
              Tentar novamente
            </button>
            {lastFailure?.category === "permission" ? (
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onClick={() => void reviewPermissions()}
                type="button"
              >
                <Mic aria-hidden="true" size={18} />
                Revisar permissões
              </button>
            ) : null}
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              onClick={() => void copySupportReference()}
              type="button"
            >
              <Copy aria-hidden="true" size={18} />
              Copiar referência
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-transparent px-4 text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              onClick={() => void backToWaitingRoom()}
              type="button"
            >
              Voltar à sala de espera
            </button>
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
          className="mt-2 text-xs font-semibold leading-5 text-status-danger"
        >
          Algumas etapas de encerramento falharam. Tente recarregar a pagina se
          a sala parecer presa.
        </p>
      ) : null}

      {endDialogOpen ? (
        <TESDialog
          description="A outra pessoa também será desconectada. Essa ação encerra a sala para todos."
          onClose={() => setEndDialogOpen(false)}
          title="Encerrar esta sessão?"
        >
          <div className="grid gap-4">
            <p className="text-sm font-semibold leading-6 text-tesText-secondary">
              Você poderá registrar o que aconteceu na tela de feedback depois
              do encerramento.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-lavender px-5 text-sm font-extrabold text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onClick={() => setEndDialogOpen(false)}
                type="button"
              >
                Continuar na sala
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-status-danger px-5 text-sm font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-danger"
                onClick={() => void completeLeave(true)}
                type="button"
              >
                Encerrar para todos
              </button>
            </div>
          </div>
        </TESDialog>
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

async function detectCleanupFailure(operation: Promise<unknown> | unknown) {
  const result = await operation;
  throwIfZoomFailure(result, "cleanup");
  return result;
}

function createSdkFailure(
  errorCode: number,
  reason: string,
  _phase: "access" | "init" | "join" | "connection",
): ZoomExecutedFailure {
  return {
    errorCode,
    reason,
    type: errorCode === 1 ? "OPERATION_TIMEOUT" : "INTERNAL_ERROR",
  };
}

function normalizeAccessDomainReason(code: string | undefined) {
  if (!code) return "access_denied";

  const normalized = code.trim().toLowerCase();
  const allowedReasons = new Set([
    "booking_not_found",
    "role_mismatch",
    "therapist_not_allowed",
    "therapist_profile_not_found",
    "therapist_receiving_account_required",
    "therapist_suspended",
  ]);

  return allowedReasons.has(normalized) ? normalized : "access_denied";
}

function isDefinitiveProviderClosure(failure: NormalizedZoomFailure) {
  if (failure.category === "ended") return true;

  return /(?:ended|closed)[\s_-]+by[\s_-]+host|host[\s_-]+ended|session[\s_-]+ended|removed|kicked/i.test(
    failure.reason,
  );
}

function waitWithAbort(delayMs: number, signal: AbortSignal) {
  if (delayMs <= 0) return Promise.resolve(!signal.aborted);

  return new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    const timer = window.setTimeout(() => finish(true), delayMs);
    const handleAbort = () => finish(false);
    const finish = (completed: boolean) => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", handleAbort);
      resolve(completed);
    };

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function waitForDelayOrOffline(delayMs: number, signal: AbortSignal) {
  return new Promise<"aborted" | "elapsed" | "offline">((resolve) => {
    if (signal.aborted) {
      resolve("aborted");
      return;
    }

    const timer = window.setTimeout(() => finish("elapsed"), delayMs);
    const handleAbort = () => finish("aborted");
    const handleOffline = () => finish("offline");
    const finish = (result: "aborted" | "elapsed" | "offline") => {
      window.clearTimeout(timer);
      window.removeEventListener("offline", handleOffline);
      signal.removeEventListener("abort", handleAbort);
      resolve(result);
    };

    window.addEventListener("offline", handleOffline, { once: true });
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function withAbortDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
) {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Zoom recovery cancelled", "AbortError"));
      return;
    }

    let settled = false;
    const timer = window.setTimeout(
      () =>
        finish(() =>
          reject(new DOMException("Zoom recovery timeout", "AbortError")),
        ),
      timeoutMs,
    );
    const handleAbort = () =>
      finish(() =>
        reject(new DOMException("Zoom recovery cancelled", "AbortError")),
      );
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", handleAbort);
      complete();
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
    operation.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

function waitForOnline(deadline: number | null, signal: AbortSignal) {
  if (isBrowserOnline()) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    const remainingMs =
      deadline === null ? null : Math.max(0, deadline - Date.now());
    if (signal.aborted || remainingMs === 0) {
      resolve(false);
      return;
    }

    const timer =
      remainingMs === null
        ? null
        : window.setTimeout(() => finish(false), remainingMs);
    const handleOnline = () => finish(true);
    const handleAbort = () => finish(false);
    const finish = (completed: boolean) => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      signal.removeEventListener("abort", handleAbort);
      resolve(completed);
    };

    window.addEventListener("online", handleOnline, { once: true });
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function isBrowserOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
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
        bVideoOn:
          typeof user.bVideoOn === "boolean" ? user.bVideoOn : undefined,
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

function formatClosedReason(reason: string | undefined) {
  if (!reason) return "O encontro foi encerrado.";
  if (/host/i.test(reason)) return "O encontro foi encerrado pelo responsavel.";
  if (/kick|remove/i.test(reason))
    return "Seu acesso ao encontro foi encerrado.";
  if (/leave/i.test(reason)) return "Voce saiu do encontro.";

  return "O encontro foi encerrado.";
}

function formatMediaError(error: unknown, target: string) {
  const phase = /audio|microfone/i.test(target) ? "audio" : "video";
  const failure = normalizeZoomFailure(error, phase);
  if (failure.category !== "permanent") return failure.userMessage;

  return `Não conseguimos ativar ${target}. Verifique as permissões e o dispositivo selecionado.`;
}

export function formatScheduledSessionCountdown(input: {
  access: ZoomAccessState | null;
  actorRole: "patient" | "therapist";
  clientNowMs: number;
  fallbackEndsAt?: string;
  fallbackStartsAt?: string;
  serverClockOffsetMs: number;
}) {
  const startsAt = input.access?.scheduledStartsAt ?? input.fallbackStartsAt;
  const endsAt = input.access?.scheduledEndsAt ?? input.fallbackEndsAt;
  if (!startsAt || !endsAt) return "";

  const startsAtMs = Date.parse(startsAt);
  const endsAtMs = Date.parse(endsAt);
  const nowMs = input.clientNowMs + input.serverClockOffsetMs;
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) return "";

  if (nowMs >= endsAtMs) {
    return input.actorRole === "patient"
      ? "O horário programado do encontro terminou."
      : "O horário programado da sessão terminou.";
  }

  const beforeStart = nowMs < startsAtMs;
  const remainingMs = (beforeStart ? startsAtMs : endsAtMs) - nowMs;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (beforeStart) return `O encontro começa em ${clock}`;
  return input.actorRole === "patient"
    ? `Tempo restante do encontro: ${clock}`
    : `Tempo restante da sessão: ${clock}`;
}

export function formatActiveSessionCountdown(input: {
  access: ZoomAccessState | null;
  actorRole: "patient" | "therapist";
  clientNowMs: number;
  fallbackEndsAt?: string;
  fallbackStartsAt?: string;
  serverClockOffsetMs: number;
}) {
  const startsAt = input.access?.scheduledStartsAt ?? input.fallbackStartsAt;
  if (!startsAt) return "";

  const startsAtMs = Date.parse(startsAt);
  const nowMs = input.clientNowMs + input.serverClockOffsetMs;
  if (!Number.isFinite(startsAtMs) || nowMs < startsAtMs) return "";

  return formatScheduledSessionCountdown(input);
}

export function isFinalEndAvailable(input: {
  access: ZoomAccessState | null;
  clientNowMs: number;
  fallbackEndsAt?: string;
  serverClockOffsetMs: number;
}) {
  const endsAt = input.access?.scheduledEndsAt ?? input.fallbackEndsAt;
  if (!endsAt) return false;

  const endsAtMs = Date.parse(endsAt);
  if (!Number.isFinite(endsAtMs)) return false;

  const nowMs = input.clientNowMs + input.serverClockOffsetMs;
  return nowMs >= endsAtMs - 5 * 60_000 && nowMs < endsAtMs;
}

function formatRoomOpeningCountdown(
  access: ZoomAccessState | null,
  clientNowMs: number,
  serverClockOffsetMs: number,
) {
  if (!access?.availableFrom)
    return "A sala abre 15 minutos antes do horário marcado.";

  const availableFromMs = Date.parse(access.availableFrom);
  if (!Number.isFinite(availableFromMs)) {
    return "A sala abre 15 minutos antes do horário marcado.";
  }

  const remainingMs = availableFromMs - (clientNowMs + serverClockOffsetMs);
  if (remainingMs <= 0) return "A sala está sendo preparada.";

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  if (totalMinutes < 60) {
    return `A sala abre em cerca de ${totalMinutes} min.`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0
    ? `A sala abre em cerca de ${hours}h.`
    : `A sala abre em cerca de ${hours}h ${minutes}min.`;
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
