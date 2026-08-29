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
  assertZoomJoinResult,
  assertZoomVideoStartResult,
  normalizeConnectionChange,
  normalizeZoomFailure,
  throwIfZoomFailure,
  ZoomOperationError,
  type NormalizedZoomFailure,
  type ZoomExecutedFailure,
  type ZoomJoinParticipantIdentity,
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
  userKey?: string;
  userId: number;
};

type ZoomVideoClient = {
  getAllUser?: () => ZoomParticipant[];
  getCurrentUserInfo?: () => ZoomParticipant | undefined;
  getUser?: (userId: number) => ZoomParticipant | undefined;
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
  ) => Promise<unknown>;
  leave: (endSession?: boolean) => Promise<"" | ZoomExecutedFailure>;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type ZoomMediaStream = {
  isCapturingVideo?: () => boolean;
  isSupportMultipleVideos?: () => boolean;
  getMaxRenderableVideos?: () => number;
  attachVideo?: (
    userId: number,
    quality?: number,
    element?: HTMLElement,
  ) => Promise<HTMLElement | HTMLElement[] | ZoomExecutedFailure>;
  detachVideo?: (
    userId: number,
    element?: HTMLElement,
  ) => Promise<HTMLElement | HTMLElement[] | ZoomExecutedFailure | void>;
  muteAudio?: () => Promise<"" | ZoomExecutedFailure>;
  startAudio?: (options?: {
    mute?: boolean;
  }) => Promise<"" | ZoomExecutedFailure>;
  startVideo?: () => Promise<void | "" | ZoomExecutedFailure>;
  stopAudio?: () => Promise<"" | ZoomExecutedFailure>;
  stopVideo?: () => Promise<"" | ZoomExecutedFailure>;
  unmuteAudio?: () => Promise<"" | ZoomExecutedFailure>;
};

type RemoteParticipantSelection =
  | { kind: "none" }
  | { kind: "ambiguous"; participantCount: number }
  | { kind: "selected"; participant: ZoomParticipant };

type SessionState =
  | "idle"
  | "loading"
  | "joining"
  | "joined"
  | "media_initializing"
  | "media_degraded"
  | "disconnected"
  | "recovering"
  | "reconnecting"
  | "leaving"
  | "ended"
  | "error"
  | "reload_required";

type RemoteVideoState = "off" | "attaching" | "on" | "error";

type LocalCaptureState = "off" | "starting" | "published" | "ready" | "failed";

type LocalPreviewState =
  | "off"
  | "waiting_provider"
  | "attaching"
  | "binding"
  | "attached"
  | "degraded";

type LocalPreviewTrigger =
  | "capture_started"
  | "connected"
  | "manual"
  | "renderer_ready"
  | "roster"
  | "video_detail"
  | "video_start"
  | "visibility";

type LocalPreviewReconcileRequest = {
  client?: ZoomVideoClient | null;
  generation?: number;
  resetAttempts?: boolean;
  trigger: LocalPreviewTrigger;
};

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
const MAX_LOCAL_PREVIEW_ATTEMPTS = 3;
const LOCAL_PREVIEW_BIND_TIMEOUT_MS = 2_500;
const LOCAL_PREVIEW_MANUAL_RECHECK_DELAYS_MS = [250, 700, 1_400] as const;
const LOCAL_RENDERER_READY_TIMEOUT_MS = 1_500;

// A transient Video SDK failure is safe to retry because every attempt reuses
// the access payload already issued by the backend. Do not gate this on a
// public runtime flag: production is where a singleton teardown race matters.
const AUTOMATIC_REJOIN_ENABLED = true;

// The Video SDK client is a browser singleton. Keep its teardown serialized at
// module scope so a route remount cannot create a new client while the previous
// component is still destroying the old one.
let zoomCleanupQueue: Promise<void> = Promise.resolve();
let zoomDestroyInFlight: Promise<unknown> | null = null;
let zoomDestroyFailure: unknown = null;

function enqueueZoomCleanup<T>(operation: () => Promise<T>) {
  const scheduled = zoomCleanupQueue.catch(() => undefined).then(operation);
  zoomCleanupQueue = scheduled.then(
    () => undefined,
    () => undefined,
  );
  return scheduled;
}

function trackZoomDestroy(operation: Promise<unknown>) {
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
  const [state, setSessionState] = useState<SessionState>("idle");
  const stateRef = useRef(state);
  const liveSessionStateRef = useRef<"joined" | "media_degraded">("joined");
  const setState = useCallback((nextState: SessionState) => {
    if (nextState === "joined" || nextState === "media_degraded") {
      liveSessionStateRef.current = nextState;
    }
    stateRef.current = nextState;
    setSessionState(nextState);
  }, []);
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
  const [localPreviewAttaching, setLocalPreviewAttaching] = useState(false);
  const [remoteParticipantPresent, setRemoteParticipantPresent] =
    useState(false);
  const [remoteVideoState, setRemoteVideoState] =
    useState<RemoteVideoState>("off");
  const [roleType, setRoleType] = useState<0 | 1 | null>(null);
  const [teardownFailures, setTeardownFailures] = useState<CleanupFailure[]>(
    [],
  );
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
  const sdkOperationInFlightRef = useRef<Promise<unknown> | null>(null);
  const videoStartedRef = useRef(false);
  const sdkJoinedRef = useRef(false);
  const audioStartedRef = useRef(false);
  const connectionStateRef = useRef("disconnected");
  const connectionFailureRef = useRef<NormalizedZoomFailure | null>(null);
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
  const localVideoPlayerRef = useRef<HTMLElement | null>(null);
  const remoteVideoRef = useRef<HTMLElement | null>(null);
  const localUserIdRef = useRef<number | null>(null);
  const localUserKeyRef = useRef<string | null>(null);
  const localUserElementsRef = useRef<HTMLElement[]>([]);
  const localPreviewOperationRef = useRef<{
    captureEpoch: number;
    generation: number;
    promise: Promise<void>;
  } | null>(null);
  const localPreviewIssueLoggedGenerationRef = useRef<number | null>(null);
  const localPreviewAttemptsRef = useRef(0);
  const localPreviewManualRecheckTimersRef = useRef<number[]>([]);
  const localRendererReadyWaitRef = useRef<{
    generation: number;
    resolve: (ready: boolean) => void;
    timer: number;
  } | null>(null);
  const requestLocalPreviewReconcileRef = useRef<
    (input: LocalPreviewReconcileRequest) => void
  >(() => undefined);
  const localPreviewFallbackAttemptedRef = useRef(false);
  const localCaptureEpochRef = useRef(0);
  const localCaptureStateRef = useRef<LocalCaptureState>("off");
  const localPreviewStateRef = useRef<LocalPreviewState>("off");
  const localPreviewTriggerRef = useRef<LocalPreviewTrigger>("video_start");
  const localVideoStoppingRef = useRef(false);
  const identityResetOperationRef = useRef<{
    generation: number;
    promise: Promise<void>;
  } | null>(null);
  const remoteUserElementsRef = useRef<Map<number, HTMLElement[]>>(new Map());
  const selectedRemoteUserIdRef = useRef<number | null>(null);
  const selectedRemoteUserKeyRef = useRef<string | null>(null);
  const remoteAmbiguityLoggedGenerationRef = useRef<number | null>(null);
  const remoteVideoOperationsRef = useRef<Map<string, Promise<void>>>(
    new Map(),
  );
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
  const localPreviewReconcileRef = useRef<
    | ((input: {
        client?: ZoomVideoClient | null;
        generation?: number;
        resetAttempts?: boolean;
        trigger: LocalPreviewTrigger;
      }) => void)
    | null
  >(null);

  cleanupRef.current = cleanup;
  localPreviewReconcileRef.current = requestLocalPreviewReconcile;

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
  }, [bookingId, initialFeedback, setState]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    mounted.current = true;

    const handlePageHide = () => {
      void cleanupRef.current?.({ destroyClient: true, endSession: false });
    };
    const handleActiveVisibility = () => {
      if (document.visibilityState !== "visible" || !videoStartedRef.current)
        return;
      localPreviewReconcileRef.current?.({
        resetAttempts: true,
        trigger: "visibility",
      });
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleActiveVisibility);

    return () => {
      mounted.current = false;
      attemptGenerationRef.current += 1;
      previewAbortControllerRef.current?.abort();
      joinAbortControllerRef.current?.abort();
      finalEndAbortControllerRef.current?.abort();
      authRefreshAbortControllerRef.current?.abort();
      recoveryAbortControllerRef.current?.abort();
      clearRemoteVideoResyncTimers();
      clearLocalPreviewManualRecheckTimers();
      clearLocalRendererReadyWait();
      clearReconnectTimer();
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleActiveVisibility);
      void cleanupRef.current?.({ destroyClient: true, endSession: false });
    };
  }, []);

  const waitingRoomKind = getZoomWaitingRoomStatusFromAccess(
    currentAccess,
    new Date(nowMs),
  );
  const hasAccess = Boolean(currentAccess);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
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

          // A preview requested by the waiting room must not overwrite a join
          // or its failure after navigation into the call.
          if (stateRef.current !== "idle" || inFlight.current)
            return currentAccessRef.current;

          if (!response.ok || !payload.ok) {
            setPreviewUnavailable(true);
            setMessage(
              "Nao conseguimos confirmar a sala agora. Tentaremos novamente automaticamente.",
            );
            return currentAccessRef.current;
          }

          const refreshedAccess = payload.data?.access;

          if (refreshedAccess) {
            setPreviewUnavailable(false);
            updateCurrentAccess(refreshedAccess);
            if (refreshedAccess.allowed && actorRole === "patient") {
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
              refreshedAccess.reason === ZoomAccessReason.ArrivalWindowExpired
            ) {
              setMessage(
                "A tolerância de entrada de 10 minutos foi encerrada. Se precisar de ajuda, fale com o suporte.",
              );
            } else {
              setMessage(null);
            }
            return refreshedAccess;
          }

          setPreviewUnavailable(true);
          setMessage(
            "Nao conseguimos confirmar a sala agora. Tentaremos novamente automaticamente.",
          );
        } catch (error) {
          if (stateRef.current !== "idle" || inFlight.current)
            return currentAccessRef.current;
          setPreviewUnavailable(true);
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
        state !== "media_initializing" &&
        state !== "media_degraded" &&
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
      void refreshPreviewAccess(true);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [actorRole, refreshPreviewAccess, setState]);

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
    if (!hasAccess || state !== "idle") return undefined;

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

        await refreshPreviewAccess();
        if (cancelled) return;

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
    window.addEventListener("focus", handleVisibility);
    schedule(delayMs);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [hasAccess, refreshPreviewAccess, state]);

  async function joinSession(options?: {
    initialFailure?: NormalizedZoomFailure;
    mediaPreferences?: ZoomWaitingRoomMediaPreferences;
    payload?: VideoSessionPayload;
    startAttempt?: number;
  }) {
    if (inFlight.current) return;
    if (zoomDestroyFailure || state === "reload_required") {
      presentJoinFailure(
        normalizeZoomFailure(
          createSdkFailure(5012, "destroy_client_failed", "cleanup"),
          "cleanup",
        ),
      );
      return;
    }
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
    setTeardownFailures([]);
    setLastFailure(null);
    setRecoveryMessage(null);
    setRecoveryAttempt(0);

    try {
      await waitForZoomLifecycleIdle();
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

        const priorCleanupFailures = await cleanup({
          destroyClient: true,
          endSession: false,
        });
        if (hasDestroyClientFailure(priorCleanupFailures)) {
          finalFailure = normalizeZoomFailure(
            createSdkFailure(5012, "destroy_client_failed", "join"),
            "join",
          );
          break;
        }
        if (!mounted.current) return;

        try {
          await performSdkJoin(videoPayload);
          return;
        } catch (error) {
          if (!mounted.current || recoveryController.signal.aborted) return;
          finalFailure = normalizeZoomFailure(error, "join");
          logClientFailure(finalFailure, attempt);
          const cleanupFailures = await cleanup({
            destroyClient: true,
            endSession: false,
          });

          if (
            !AUTOMATIC_REJOIN_ENABLED ||
            !finalFailure.retryable ||
            isDestroyedZoomClientFailure(finalFailure, cleanupFailures) ||
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
      if (!mounted.current || recoveryController.signal.aborted) return;
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
          setState("idle");
          setMessage(null);
          return null;
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
    sdkJoinedRef.current = false;
    connectionFailureRef.current = null;
    connectionStateRef.current = "joining";
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
      () =>
        client.init("pt-BR", "Global", {
          enforceMultipleVideos: true,
          leaveOnPageUnload: true,
          patchJsMedia: true,
          stayAwake: true,
        }),
      "init",
    );
    ensureCurrentAttempt(generation);
    const joinResult = await awaitExecutedZoomOperation(
      () =>
        client.join(
          videoPayload.sessionName,
          videoPayload.token,
          videoPayload.userName,
          videoPayload.sessionPasscode ?? undefined,
        ),
      "join",
    );
    ensureCurrentAttempt(generation);
    const joinedIdentity = assertZoomJoinResult(joinResult);
    if (joinedIdentity) updateLocalParticipantIdentity(joinedIdentity);
    resolveLocalParticipantIdentity(client, false);
    sdkJoinedRef.current = true;
    connectionStateRef.current = "Connected";
    setState("media_initializing");
    setMessage("Você entrou. Preparando câmera e áudio...");
    // Do not let a permission prompt determine whether React has mounted the
    // local video-player. Safari can otherwise publish before that renderer
    // exists, leaving the self-view without a deterministic first attach.
    const localRendererReady = waitForLocalVideoRenderer(generation);
    let stream: ZoomMediaStream;
    try {
      stream = client.getMediaStream();
      streamRef.current = stream;
    } catch (error) {
      logClientFailure(
        { ...normalizeZoomFailure(error, "video"), operation: "media.stream" },
        1,
      );
      setState("media_degraded");
      setMessage(
        "Você entrou, mas não foi possível preparar a câmera e o áudio. Saia e entre novamente para recuperá-los.",
      );
      return;
    }
    let microphoneEnabled = false;
    let initialMediaMessage: string | null = null;
    let audioReady = true;
    try {
      if (stream.startAudio) {
        await awaitExecutedZoomOperation(
          () => stream.startAudio!({ mute: true }),
          "audio",
          "audio.start",
        );
        audioStartedRef.current = true;
      }
      if (stream.muteAudio) {
        await awaitExecutedZoomOperation(
          () => stream.muteAudio!(),
          "audio",
          "audio.mute",
        );
      }
    } catch (error) {
      ensureCurrentAttempt(generation);
      logClientFailure(normalizeZoomFailure(error, "audio"), 1);
      audioReady = false;
      initialMediaMessage = formatInitialAudioError(error);
    }

    if (audioReady && mediaPreferencesRef.current.microphoneEnabled) {
      try {
        if (stream.unmuteAudio) {
          await awaitExecutedZoomOperation(
            () => stream.unmuteAudio!(),
            "audio",
            "audio.unmute",
          );
        }
        microphoneEnabled = true;
      } catch (error) {
        initialMediaMessage = formatMediaError(error, "o microfone");
      }
    }

    if (mediaPreferencesRef.current.cameraEnabled) {
      try {
        await localRendererReady;
        await enableVideoForSession(stream);
      } catch (error) {
        mediaPreferencesRef.current.cameraEnabled = false;
        initialMediaMessage ??= formatMediaError(error, "a câmera");
      }
    }
    try {
      await renderExistingRemoteVideos(client, generation);
    } catch (error) {
      logClientFailure(
        { ...normalizeZoomFailure(error, "video"), operation: "video.render" },
        1,
      );
      initialMediaMessage ??= formatMediaError(error, "o vídeo");
    }
    scheduleRemoteVideoResync(generation, client);
    ensureCurrentAttempt(generation);

    setAudioMuted(!microphoneEnabled);
    setRecoveryAttempt(0);
    setLastFailure(null);
    inFlight.current = false;
    setState(initialMediaMessage ? "media_degraded" : "joined");
    setMessage(
      initialMediaMessage ??
        (actorRole === "therapist"
          ? "Você entrou como responsável pelo encontro."
          : "Você entrou no encontro. Aguarde se a outra pessoa ainda não estiver presente."),
    );
  }

  async function awaitExecutedZoomOperation(
    operation: () => Promise<unknown>,
    phase: ZoomOperationPhase,
    operationName: string = phase,
  ) {
    const pending = Promise.resolve().then(operation);
    sdkOperationInFlightRef.current = pending;
    const clear = () => {
      if (sdkOperationInFlightRef.current === pending)
        sdkOperationInFlightRef.current = null;
    };
    pending.then(clear, clear);
    try {
      const result =
        phase === "audio" || phase === "video"
          ? await withAbortDeadline(
              pending,
              RECOVERY_DEADLINE_MS,
              recoveryAbortControllerRef.current?.signal,
            )
          : await awaitWithinRecoveryDeadline(pending);
      if (phase === "join") assertZoomJoinResult(result);
      else assertZoomExecutedResult(result, phase);
      return result;
    } catch (error) {
      throw new ZoomOperationError({
        ...normalizeZoomFailure(error, phase),
        operation: operationName,
      });
    }
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
    if (connectionFailureRef.current)
      throw new ZoomOperationError(connectionFailureRef.current);
  }

  function updateLocalParticipantIdentity(
    identity: ZoomJoinParticipantIdentity,
  ) {
    const previousUserId = localUserIdRef.current;
    localUserIdRef.current = identity.userId;
    if (identity.userKey) localUserKeyRef.current = identity.userKey;
    return previousUserId !== null && previousUserId !== identity.userId;
  }

  function resolveLocalParticipantIdentity(
    client: ZoomVideoClient,
    allowUserIdChange: boolean,
  ): ZoomJoinParticipantIdentity | null {
    let current: ZoomParticipant | undefined;
    try {
      current = client.getCurrentUserInfo?.();
    } catch {
      return readLocalParticipantIdentity();
    }

    const identity = normalizeParticipantIdentity(current);
    if (!identity) return readLocalParticipantIdentity();

    if (localUserIdRef.current === null || allowUserIdChange) {
      updateLocalParticipantIdentity(identity);
    } else if (
      localUserIdRef.current === identity.userId &&
      !localUserKeyRef.current &&
      identity.userKey
    ) {
      localUserKeyRef.current = identity.userKey;
    }

    return readLocalParticipantIdentity();
  }

  function readLocalParticipantIdentity(): ZoomJoinParticipantIdentity | null {
    const userId = localUserIdRef.current;
    if (!userId) return null;
    const userKey = localUserKeyRef.current;
    return { userId, ...(userKey ? { userKey } : {}) };
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
        operation: failure.operation ?? failure.phase,
        joinConfirmed: sdkJoinedRef.current,
        connectionState: connectionStateRef.current,
        ...(failure.phase === "video"
          ? {
              generation: attemptGenerationRef.current,
              captureEpoch: localCaptureEpochRef.current,
              captureState: localCaptureStateRef.current,
              localIdentityAvailable: localUserIdRef.current !== null,
              cameraPublishing: videoStartedRef.current,
              localPreviewAttached: localUserElementsRef.current.length > 0,
              localPreviewAttempt: localPreviewAttemptsRef.current,
              localPreviewTrigger: localPreviewTriggerRef.current,
              ...readVideoCapabilities(streamRef.current),
            }
          : {}),
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
    if (zoomDestroyFailure) return;
    recoveryAbortControllerRef.current?.abort();
    clearReconnectTimer();
    const failures = await cleanup({ destroyClient: true, endSession: false });
    if (!mounted.current) return;
    if (hasDestroyClientFailure(failures)) {
      presentJoinFailure(
        normalizeZoomFailure(
          createSdkFailure(5012, "destroy_client_failed", "cleanup"),
          "cleanup",
        ),
      );
      return;
    }
    setState("idle");
    setMessage(null);
    setRecoveryMessage(null);
  }

  async function toggleAudio() {
    if (sdkOperationInFlightRef.current) return;
    const stream = streamRef.current;
    if (
      !stream ||
      !["joined", "media_degraded"].includes(state) ||
      leavingRef.current
    )
      return;

    try {
      if (audioMuted) {
        if (!audioStartedRef.current && stream.startAudio) {
          await awaitExecutedZoomOperation(
            () => stream.startAudio!({ mute: true }),
            "audio",
            "audio.start",
          );
          audioStartedRef.current = true;
        }
        if (stream.unmuteAudio) {
          assertZoomExecutedResult(await stream.unmuteAudio(), "audio");
        }
        setAudioMuted(false);
        mediaPreferencesRef.current.microphoneEnabled = true;
        if (state === "media_degraded") {
          setState("joined");
          setMessage("Áudio ativado.");
        }
      } else {
        if (stream.muteAudio) {
          assertZoomExecutedResult(await stream.muteAudio(), "audio");
        }
        setAudioMuted(true);
        mediaPreferencesRef.current.microphoneEnabled = false;
      }
    } catch (error) {
      logClientFailure(normalizeZoomFailure(error, "audio"), 0);
      setState("media_degraded");
      setMessage(formatMediaError(error, "audio"));
    }
  }

  async function toggleVideo() {
    if (sdkOperationInFlightRef.current) return;
    const stream = streamRef.current;
    const container = localVideoRef.current;
    if (
      !stream ||
      !container ||
      !["joined", "media_degraded"].includes(state) ||
      leavingRef.current
    )
      return;

    try {
      if (videoStartedRef.current) {
        await disableVideoForSession(stream);
        return;
      }

      await enableVideoForSession(stream);
      scheduleRemoteVideoResync();
    } catch (error) {
      if (!mounted.current || leavingRef.current) return;
      setMessage(
        videoStartedRef.current
          ? "Não conseguimos desligar a câmera. Tente novamente ou saia do encontro."
          : formatMediaError(error, "a câmera"),
      );
    }
  }

  // Retain ownership through capture AND attachment: cleanup must await both,
  // even when React unmounts before the SDK resolves. Repeated clicks cannot race.
  function runLocalVideoOperation(
    operation: (generation: number) => Promise<void>,
  ) {
    const generation = attemptGenerationRef.current;
    const pending = Promise.resolve().then(() => {
      ensureCurrentAttempt(generation);
      return operation(generation);
    });
    sdkOperationInFlightRef.current = pending;
    return pending.finally(() => {
      if (sdkOperationInFlightRef.current === pending)
        sdkOperationInFlightRef.current = null;
    });
  }

  function enableVideoForSession(stream: ZoomMediaStream) {
    return runLocalVideoOperation(async (generation) => {
      const captureEpoch = localCaptureEpochRef.current + 1;
      localCaptureEpochRef.current = captureEpoch;
      localCaptureStateRef.current = "starting";
      localPreviewStateRef.current = "waiting_provider";
      localPreviewAttemptsRef.current = 0;
      localPreviewFallbackAttemptedRef.current = false;
      try {
        if (!stream.startVideo) throw new Error("video_start_unavailable");
        assertZoomVideoStartResult(await stream.startVideo());
      } catch (error) {
        if (localCaptureEpochRef.current === captureEpoch) {
          localCaptureStateRef.current = "failed";
        }
        logClientFailure(
          { ...normalizeZoomFailure(error, "video"), operation: "video.start" },
          0,
        );
        throw error;
      }
      videoStartedRef.current = true;
      ensureCurrentAttempt(generation);
      setVideoOn(true);
      mediaPreferencesRef.current.cameraEnabled = true;
      if (
        localCaptureEpochRef.current === captureEpoch &&
        localCaptureStateRef.current === "starting"
      ) {
        // startVideo confirms publication, while the SDK's local renderer may
        // become ready slightly later on a cold/reconnected mobile pipeline.
        localCaptureStateRef.current = "published";
      }

      // Publishing and displaying our own preview are separate outcomes.
      // Never stop a working camera or report permission denial for attach failure.
      await ensureLocalPreviewAttached(generation, {
        captureEpoch,
        trigger: "video_start",
      });
    });
  }

  function ensureLocalPreviewAttached(
    generation = attemptGenerationRef.current,
    options?: {
      captureEpoch?: number;
      trigger?: LocalPreviewTrigger;
    },
  ): Promise<void> {
    const captureEpoch = options?.captureEpoch ?? localCaptureEpochRef.current;
    const trigger = options?.trigger ?? "roster";
    const existing = localPreviewOperationRef.current;
    if (
      existing?.generation === generation &&
      existing.captureEpoch === captureEpoch
    ) {
      return existing.promise;
    }

    let pending: Promise<void>;
    pending = (async () => {
      const client = clientRef.current;
      const stream = streamRef.current;
      const container = localVideoRef.current;
      const player = localVideoPlayerRef.current;
      if (
        !client ||
        !stream?.attachVideo ||
        !container ||
        !player ||
        !container.contains(player) ||
        !videoStartedRef.current ||
        captureEpoch !== localCaptureEpochRef.current ||
        localVideoStoppingRef.current ||
        identityResetOperationRef.current?.generation === generation ||
        !isCurrentVideoOwner(client, generation)
      ) {
        return;
      }

      const identity = resolveLocalParticipantIdentity(client, false);
      if (!identity) {
        setLocalPreviewUnavailable(true);
        if (localPreviewIssueLoggedGenerationRef.current !== generation) {
          localPreviewIssueLoggedGenerationRef.current = generation;
          console.warn(
            JSON.stringify({
              code: "ZOOM_VIDEO_LOCAL_IDENTITY_PENDING",
              operation: "video.attach.local",
            }),
          );
        }
        return;
      }

      if (
        localPreviewStateRef.current === "attached" &&
        getVideoPlayerBoundUserId(player) === identity.userId
      ) {
        localUserElementsRef.current = [player];
        localPreviewStateRef.current = "attached";
        setLocalPreviewUnavailable(false);
        localPreviewIssueLoggedGenerationRef.current = null;
        return;
      }
      localUserElementsRef.current = [];

      let participant: ZoomParticipant | undefined;
      try {
        participant =
          client.getUser?.(identity.userId) ??
          client
            .getAllUser?.()
            .find((candidate) => candidate.userId === identity.userId) ??
          client.getCurrentUserInfo?.();
      } catch {
        participant = undefined;
      }
      // The SDK documents self-view as startVideo() followed by attachVideo().
      // On iPhone the roster's bVideoOn can arrive after publication (or remain
      // stale for the local participant), so it is useful for diagnostics but
      // cannot be a prerequisite for attaching the current user's renderer.
      if (participant?.bVideoOn !== true) {
        console.info(
          JSON.stringify({
            code: "LOCAL_RENDER_ROSTER_LAG",
            operation: "video.attach.local",
            trigger,
            ...readVideoCapabilities(stream),
          }),
        );
      }

      if (localPreviewAttemptsRef.current >= MAX_LOCAL_PREVIEW_ATTEMPTS) {
        localPreviewStateRef.current = "degraded";
        setLocalPreviewUnavailable(true);
        return;
      }

      localPreviewAttemptsRef.current += 1;
      localPreviewTriggerRef.current = trigger;
      localPreviewStateRef.current = "attaching";
      setLocalPreviewUnavailable(true);
      setLocalPreviewAttaching(true);
      try {
        const attached = throwIfZoomFailure(
          await stream.attachVideo(identity.userId, 2, player),
          "video",
        );
        const elements = normalizeVideoElements(attached);
        if (elements.length !== 1 || elements[0] !== player) {
          if (
            elements.some((element) =>
              [...remoteUserElementsRef.current.values()].some(
                (remoteElements) => remoteElements.includes(element),
              ),
            )
          ) {
            throw new Error("local_video_element_owner_collision");
          }
          await discardDetachedVideoElements(
            stream,
            identity.userId,
            elements.filter((element) => element !== player),
          );
          throw new Error("local_preview_element_mismatch");
        }
        styleLocalVideoElement(player);
        if (
          !isCurrentVideoOwner(client, generation) ||
          streamRef.current !== stream ||
          localCaptureEpochRef.current !== captureEpoch ||
          localUserIdRef.current !== identity.userId ||
          !videoStartedRef.current ||
          localVideoStoppingRef.current
        ) {
          try {
            await stream.detachVideo?.(identity.userId, player);
          } catch {
            // The stale generation no longer owns UI state; best-effort detach.
          }
          return;
        }
        if (
          [...remoteUserElementsRef.current.values()].some((remoteElements) =>
            remoteElements.includes(player),
          )
        ) {
          throw new Error("local_video_element_owner_collision");
        }

        localPreviewStateRef.current = "binding";
        const bound = await waitForVideoPlayerBinding({
          element: player,
          isCurrentOwner: () =>
            isCurrentVideoOwner(client, generation) &&
            streamRef.current === stream &&
            localCaptureEpochRef.current === captureEpoch &&
            localUserIdRef.current === identity.userId &&
            videoStartedRef.current &&
            !localVideoStoppingRef.current,
          timeoutMs: LOCAL_PREVIEW_BIND_TIMEOUT_MS,
          userId: identity.userId,
        });
        if (!bound) {
          const stillOwnsBinding =
            isCurrentVideoOwner(client, generation) &&
            streamRef.current === stream &&
            localCaptureEpochRef.current === captureEpoch &&
            localUserIdRef.current === identity.userId &&
            videoStartedRef.current &&
            !localVideoStoppingRef.current;
          if (!stillOwnsBinding) {
            try {
              await stream.detachVideo?.(identity.userId, player);
            } catch {
              // The stale generation cannot publish a user-facing teardown error.
            }
            return;
          }
          if (stillOwnsBinding) {
            console.warn(
              JSON.stringify({
                attempt: localPreviewAttemptsRef.current,
                code: "LOCAL_RENDER_TIMEOUT",
                operation: "video.attach.local",
                state: "binding",
                trigger,
              }),
            );
            try {
              throwIfZoomFailure(
                await stream.detachVideo?.(identity.userId, player),
                "video",
              );
            } catch (error) {
              logClientFailure(
                {
                  ...normalizeZoomFailure(error, "video"),
                  operation: "video.detach.local.binding-timeout",
                },
                0,
              );
            }

            // Safari on iPhone can keep a caller-provided video-player in the
            // DOM without completing the SDK's internal renderer binding. In
            // that case ask the SDK to create its own player and attach it to
            // the same local container. This reuses the active capture and
            // session; it never rejoins or requests another token.
            if (!localPreviewFallbackAttemptedRef.current) {
              localPreviewFallbackAttemptedRef.current = true;
              const fallbackBound = await attachSdkCreatedLocalPreview({
                client,
                container,
                captureEpoch,
                generation,
                stream,
                trigger,
                userId: identity.userId,
              });
              if (fallbackBound) return;
            }
            localPreviewStateRef.current =
              localPreviewAttemptsRef.current >= MAX_LOCAL_PREVIEW_ATTEMPTS
                ? "degraded"
                : "waiting_provider";
            setLocalPreviewUnavailable(true);
          }
          return;
        }

        localUserElementsRef.current = [player];
        localPreviewStateRef.current = "attached";
        setLocalPreviewUnavailable(false);
        localPreviewIssueLoggedGenerationRef.current = null;
        console.info(
          JSON.stringify({
            attempt: localPreviewAttemptsRef.current,
            code: "LOCAL_RENDER_BOUND",
            operation: "video.attach.local",
            state: "attached",
            trigger,
          }),
        );
      } catch (error) {
        if (
          isCurrentVideoOwner(client, generation) &&
          streamRef.current === stream
        ) {
          localPreviewStateRef.current =
            localPreviewAttemptsRef.current >= MAX_LOCAL_PREVIEW_ATTEMPTS
              ? "degraded"
              : "waiting_provider";
          logClientFailure(
            {
              ...normalizeZoomFailure(error, "video"),
              operation: "video.attach.local",
            },
            0,
          );
          setLocalPreviewUnavailable(true);
        }
      } finally {
        if (
          isCurrentVideoOwner(client, generation) &&
          streamRef.current === stream
        )
          setLocalPreviewAttaching(false);
      }
    })().finally(() => {
      if (localPreviewOperationRef.current?.promise === pending) {
        localPreviewOperationRef.current = null;
      }
    });
    localPreviewOperationRef.current = {
      captureEpoch,
      generation,
      promise: pending,
    };
    return pending;
  }

  function waitForLocalVideoRenderer(generation: number): Promise<boolean> {
    if (hasLocalVideoRenderer()) return Promise.resolve(true);

    const existing = localRendererReadyWaitRef.current;
    if (existing) {
      window.clearTimeout(existing.timer);
      existing.resolve(false);
    }

    return new Promise((resolve) => {
      const finish = (ready: boolean) => {
        const pending = localRendererReadyWaitRef.current;
        if (pending?.generation !== generation) return;
        window.clearTimeout(pending.timer);
        localRendererReadyWaitRef.current = null;
        resolve(ready);
      };
      const timer = window.setTimeout(
        () => finish(false),
        LOCAL_RENDERER_READY_TIMEOUT_MS,
      );
      localRendererReadyWaitRef.current = { generation, resolve: finish, timer };
      if (hasLocalVideoRenderer()) finish(true);
    });
  }

  function hasLocalVideoRenderer() {
    const container = localVideoRef.current;
    const player = localVideoPlayerRef.current;
    return Boolean(container && player && container.contains(player));
  }

  const handleLocalRendererReady = useCallback(() => {
    const pending = localRendererReadyWaitRef.current;
    if (pending && hasLocalVideoRenderer()) {
      pending.resolve(true);
    }

    const client = clientRef.current;
    const generation = attemptGenerationRef.current;
    if (
      client &&
      videoStartedRef.current &&
      isCurrentVideoOwner(client, generation)
    ) {
      requestLocalPreviewReconcileRef.current({
        client,
        generation,
        trigger: "renderer_ready",
      });
    }
  }, []);

  async function attachSdkCreatedLocalPreview(input: {
    client: ZoomVideoClient;
    container: HTMLElement;
    captureEpoch: number;
    generation: number;
    stream: ZoomMediaStream;
    trigger: LocalPreviewTrigger;
    userId: number;
  }): Promise<boolean> {
    if (!input.stream.attachVideo) return false;
    if (
      !isCurrentVideoOwner(input.client, input.generation) ||
      streamRef.current !== input.stream ||
      localCaptureEpochRef.current !== input.captureEpoch ||
      localUserIdRef.current !== input.userId ||
      !videoStartedRef.current ||
      localVideoStoppingRef.current
    ) {
      return false;
    }

    localPreviewAttemptsRef.current += 1;
    localPreviewStateRef.current = "attaching";
    setLocalPreviewUnavailable(true);
    setLocalPreviewAttaching(true);

    let fallbackElement: HTMLElement | null = null;
    try {
      const attached = throwIfZoomFailure(
        await input.stream.attachVideo(input.userId, 2),
        "video",
      );
      const elements = normalizeVideoElements(attached);
      if (elements.length !== 1) {
        await discardDetachedVideoElements(input.stream, input.userId, elements);
        return false;
      }
      fallbackElement = elements[0];
      if (
        !isCurrentVideoOwner(input.client, input.generation) ||
        streamRef.current !== input.stream ||
        localCaptureEpochRef.current !== input.captureEpoch ||
        localUserIdRef.current !== input.userId ||
        !videoStartedRef.current ||
        localVideoStoppingRef.current
      ) {
        return false;
      }
      styleLocalVideoElement(fallbackElement);
      input.container.appendChild(fallbackElement);
      const bound = await waitForVideoPlayerBinding({
        element: fallbackElement,
        isCurrentOwner: () =>
          isCurrentVideoOwner(input.client, input.generation) &&
          streamRef.current === input.stream &&
          localCaptureEpochRef.current === input.captureEpoch &&
          localUserIdRef.current === input.userId &&
          videoStartedRef.current &&
          !localVideoStoppingRef.current,
        timeoutMs: LOCAL_PREVIEW_BIND_TIMEOUT_MS,
        userId: input.userId,
      });
      if (!bound) return false;

      localUserElementsRef.current = [fallbackElement];
      localPreviewStateRef.current = "attached";
      setLocalPreviewUnavailable(false);
      localPreviewIssueLoggedGenerationRef.current = null;
      console.info(
        JSON.stringify({
          attempt: localPreviewAttemptsRef.current,
          code: "LOCAL_RENDER_FALLBACK_BOUND",
          operation: "video.attach.local.created-player",
          state: "attached",
          trigger: input.trigger,
        }),
      );
      return true;
    } catch (error) {
      logClientFailure(
        {
          ...normalizeZoomFailure(error, "video"),
          operation: "video.attach.local.created-player",
        },
        0,
      );
      return false;
    } finally {
      if (
        fallbackElement &&
        !localUserElementsRef.current.includes(fallbackElement)
      ) {
        try {
          await input.stream.detachVideo?.(input.userId, fallbackElement);
        } catch {
          // Cleanup is best effort; the owning generation remains valid.
        }
        fallbackElement.remove();
      }
      if (
        isCurrentVideoOwner(input.client, input.generation) &&
        streamRef.current === input.stream
      ) {
        setLocalPreviewAttaching(false);
      }
    }
  }

  function requestLocalPreviewReconcile(input: LocalPreviewReconcileRequest) {
    const client = input.client ?? clientRef.current;
    const generation = input.generation ?? attemptGenerationRef.current;
    const captureEpoch = localCaptureEpochRef.current;
    if (!client || !videoStartedRef.current) return;

    // A capture-ready signal can arrive while startVideo or an earlier attach
    // is still resolving. Queue exactly against those captured operations and
    // revalidate generation/client/epoch before touching state or DOM.
    const pendingSdkOperation = sdkOperationInFlightRef.current;
    const pendingPreviewOperation = localPreviewOperationRef.current?.promise;
    void Promise.allSettled(
      [pendingSdkOperation, pendingPreviewOperation].filter(
        (operation): operation is Promise<unknown> => Boolean(operation),
      ),
    )
      .then(async () => {
        if (
          !isCurrentVideoOwner(client, generation) ||
          localCaptureEpochRef.current !== captureEpoch ||
          !videoStartedRef.current ||
          localVideoStoppingRef.current
        ) {
          return;
        }
        if (input.resetAttempts) {
          localPreviewAttemptsRef.current = 0;
          localPreviewFallbackAttemptedRef.current = false;
        }
        await ensureLocalPreviewAttached(generation, {
          captureEpoch,
          trigger: input.trigger,
        });
      })
      .catch((error) => {
        if (isCurrentVideoOwner(client, generation) && !isAbortError(error)) {
          logClientFailure(
            {
              ...normalizeZoomFailure(error, "video"),
              operation: "video.attach.local.reconcile",
            },
            0,
          );
        }
      });
  }
  requestLocalPreviewReconcileRef.current = requestLocalPreviewReconcile;

  function disableVideoForSession(stream: ZoomMediaStream) {
    return runLocalVideoOperation(async (generation) => {
      localVideoStoppingRef.current = true;
      clearLocalPreviewManualRecheckTimers();
      try {
        // Privacy: stop publishing before detaching; failed rendering cleanup
        // must not leave a camera transmitting after the user switches it off.
        if (!stream.stopVideo) throw new Error("video_stop_unavailable");
        assertZoomExecutedResult(await stream.stopVideo(), "video");
        videoStartedRef.current = false;
        ensureCurrentAttempt(generation);
        setVideoOn(false);
        setLocalPreviewUnavailable(false);
        mediaPreferencesRef.current.cameraEnabled = false;
        localCaptureStateRef.current = "off";
        localPreviewStateRef.current = "off";
        // A reconciliation attach may still be in flight. It observes the
        // stopping flag and discards its result rather than publishing a tile.
        await localPreviewOperationRef.current?.promise;
        ensureCurrentAttempt(generation);
        const userId = localUserIdRef.current;
        const elements = [...localUserElementsRef.current];
        for (const element of elements) {
          try {
            if (userId)
              throwIfZoomFailure(
                await stream.detachVideo?.(userId, element),
                "video",
              );
          } catch (error) {
            logClientFailure(
              {
                ...normalizeZoomFailure(error, "video"),
                operation: "video.detach.local",
              },
              0,
            );
          }
        }
        localUserElementsRef.current = [];
      } finally {
        if (generation === attemptGenerationRef.current)
          localVideoStoppingRef.current = false;
      }
    });
  }

  function retryLocalPreview() {
    if (
      !["joined", "media_degraded"].includes(stateRef.current) ||
      leavingRef.current ||
      localVideoStoppingRef.current
    )
      return;

    // On mobile the SDK can publish the camera before its roster reflects
    // bVideoOn. A manual retry must survive that short gap, but it must not
    // publish again, join again, or grow into an unbounded polling loop.
    clearLocalPreviewManualRecheckTimers();
    const client = clientRef.current;
    const generation = attemptGenerationRef.current;
    const captureEpoch = localCaptureEpochRef.current;
    const requestRetry = (resetAttempts: boolean) => {
      if (
        !client ||
        !isCurrentVideoOwner(client, generation) ||
        localCaptureEpochRef.current !== captureEpoch ||
        !videoStartedRef.current ||
        localVideoStoppingRef.current ||
        leavingRef.current
      ) {
        return;
      }
      requestLocalPreviewReconcile({
        client,
        generation,
        resetAttempts,
        trigger: "manual",
      });
    };

    requestRetry(true);
    for (const delayMs of LOCAL_PREVIEW_MANUAL_RECHECK_DELAYS_MS) {
      const timer = window.setTimeout(() => {
        localPreviewManualRecheckTimersRef.current =
          localPreviewManualRecheckTimersRef.current.filter(
            (activeTimer) => activeTimer !== timer,
          );
        requestRetry(false);
      }, delayMs);
      localPreviewManualRecheckTimersRef.current.push(timer);
    }
    scheduleRemoteVideoResync();
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
    recoveryAbortControllerRef.current?.abort();
    setEndDialogOpen(false);
    setState("leaving");
    setMessage("Saindo do encontro...");

    const failures = await cleanup({ destroyClient: true, endSession: false });
    leavingRef.current = false;

    if (!mounted.current) return;
    if (hasDestroyClientFailure(failures)) {
      presentJoinFailure(
        normalizeZoomFailure(
          createSdkFailure(5012, "destroy_client_failed", "cleanup"),
          "cleanup",
        ),
      );
      return;
    }
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
    clearLocalPreviewManualRecheckTimers();
    clearLocalRendererReadyWait();
    const client = clientRef.current;
    const stream = streamRef.current;
    // An AbortController stops our wait, not the SDK operation itself. Never
    // destroy/recreate while a late join or media startup still owns the client.
    if (sdkOperationInFlightRef.current) {
      const pending = sdkOperationInFlightRef.current;
      try {
        await withAbortDeadline(
          pending.catch(() => undefined),
          RECOVERY_DEADLINE_MS,
        );
      } catch (error) {
        zoomDestroyFailure = error;
        failures.push({
          operation: "destroyClient",
          reason: "pending_sdk_operation",
        });
        setTeardownFailures(failures);
        return failures;
      }
    }

    const pendingLocalPreview = localPreviewOperationRef.current?.promise;
    if (pendingLocalPreview) {
      try {
        await withAbortDeadline(
          pendingLocalPreview.catch(() => undefined),
          RECOVERY_DEADLINE_MS,
        );
      } catch {
        zoomDestroyFailure = new Error("pending_local_preview_operation");
        failures.push({
          operation: "destroyClient",
          reason: "pending_local_preview_operation",
        });
        setTeardownFailures(failures);
        return failures;
      }
    }

    const pendingRemoteVideoOperations = [
      ...remoteVideoOperationsRef.current.values(),
    ];
    if (pendingRemoteVideoOperations.length > 0) {
      try {
        await withAbortDeadline(
          Promise.allSettled(pendingRemoteVideoOperations),
          RECOVERY_DEADLINE_MS,
        );
      } catch {
        zoomDestroyFailure = new Error("pending_remote_video_operation");
        failures.push({
          operation: "destroyClient",
          reason: "pending_remote_video_operation",
        });
        setTeardownFailures(failures);
        return failures;
      }
    }

    for (const listener of listenersRef.current) {
      await recordCleanupFailure(failures, `listener:${listener.event}`, () =>
        client?.off?.(listener.event, listener.handler),
      );
    }
    listenersRef.current = [];
    clearRemoteVideoResyncTimers();

    await stopAllRemoteVideos(failures);

    const localUserId = localUserIdRef.current;
    const localElements = [...localUserElementsRef.current];
    const hadAttachedLocalVideo = localElements.length > 0;
    if (stream && localUserId) {
      for (const element of localElements) {
        await recordCleanupFailure(failures, "detachVideo:local", () =>
          detectCleanupFailure(stream.detachVideo?.(localUserId, element)),
        );
      }
    }
    localUserElementsRef.current = [];
    if (hadAttachedLocalVideo || videoStartedRef.current) {
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
      const zoom = zoomModuleRef.current;
      if (zoom?.destroyClient && !zoomDestroyFailure) {
        await recordCleanupFailure(failures, "destroyClient", async () => {
          try {
            await waitForPriorZoomDestroy();
            // Static method depends on this.videoClient in the installed SDK.
            const pending = trackZoomDestroy(
              Promise.resolve().then(() =>
                detectCleanupFailure(zoom.destroyClient!()),
              ),
            );
            await withAbortDeadline(pending, RECOVERY_DEADLINE_MS);
          } catch (error) {
            zoomDestroyFailure = error;
            throw error;
          }
        });
      } else if (zoomDestroyFailure) {
        failures.push({
          operation: "destroyClient",
          reason: "destroy_client_failed",
        });
      }
    }

    clientRef.current = null;
    streamRef.current = null;
    zoomModuleRef.current = null;
    localUserIdRef.current = null;
    localUserKeyRef.current = null;
    localPreviewOperationRef.current = null;
    localPreviewIssueLoggedGenerationRef.current = null;
    localPreviewAttemptsRef.current = 0;
    localPreviewFallbackAttemptedRef.current = false;
    localCaptureEpochRef.current += 1;
    localCaptureStateRef.current = "off";
    localPreviewStateRef.current = "off";
    localPreviewTriggerRef.current = "video_start";
    localVideoStoppingRef.current = false;
    identityResetOperationRef.current = null;
    setLocalPreviewAttaching(false);
    remoteUserElementsRef.current.clear();
    selectedRemoteUserIdRef.current = null;
    selectedRemoteUserKeyRef.current = null;
    remoteAmbiguityLoggedGenerationRef.current = null;
    remoteVideoOperationsRef.current.clear();
    setRemoteParticipantPresent(false);
    setRemoteVideoState("off");
    setVideoOn(false);
    videoStartedRef.current = false;
    setLocalPreviewUnavailable(false);
    setAudioMuted(true);
    audioStartedRef.current = false;
    sdkJoinedRef.current = false;
    connectionStateRef.current = "disconnected";

    if (failures.length > 0) {
      setTeardownFailures(failures);
      console.warn(
        JSON.stringify({
          code: "ZOOM_VIDEO_CLEANUP_PARTIAL_FAILURE",
          operations: failures.map((failure) => failure.operation),
        }),
      );
    } else {
      setTeardownFailures([]);
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
      connectionStateRef.current = normalized.state;
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
        connectionFailureRef.current = null;
        if (inFlight.current || !sdkJoinedRef.current) return;
        setState(liveSessionStateRef.current);
        setMessage("Conexao restabelecida.");
        void resynchronizeConnectedVideo(client, generation).catch((error) => {
          if (isCurrentClient() && !isAbortError(error)) {
            logClientFailure(
              {
                ...normalizeZoomFailure(error, "video"),
                operation: "video.reconcile",
              },
              0,
            );
          }
        });
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
        connectionFailureRef.current = failure;
        setState("disconnected");
        if (inFlight.current) return;
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
        connectionFailureRef.current = failure;
        setState("disconnected");
        if (inFlight.current) return;
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
      if (eventContainsRemoteParticipant(client, payload)) {
        setMessage("A outra pessoa entrou no encontro.");
      }
      scheduleRemoteVideoResync(generation, client);
    };
    const userRemoved = (payload: unknown) => {
      if (!isCurrentClient()) return;
      if (eventContainsRemoteParticipant(client, payload)) {
        setMessage("A outra pessoa saiu do encontro.");
      }
      scheduleRemoteVideoResync(generation, client);
    };
    const userUpdated = (payload: unknown) => {
      if (!isCurrentClient()) return;
      const localParticipant = asParticipantArray(payload)
        .map(
          (participant) => client.getUser?.(participant.userId) ?? participant,
        )
        .find((participant) => isLocalParticipant(participant));
      if (videoStartedRef.current && localParticipant?.bVideoOn === true) {
        const becameReady = localCaptureStateRef.current !== "ready";
        localCaptureStateRef.current = "ready";
        requestLocalPreviewReconcile({
          client,
          generation,
          resetAttempts: becameReady,
          trigger: "roster",
        });
      }
      scheduleRemoteVideoResync(generation, client);
    };
    const peerVideoStateChange = (payload: unknown) => {
      if (!isCurrentClient()) return;
      const event = payload as { action?: unknown; userId?: unknown };
      const userId =
        typeof event.userId === "number" && event.userId > 0
          ? event.userId
          : null;
      if (!userId) return;

      scheduleRemoteVideoResync(generation, client);
    };
    const mediaFailed = (payload: unknown) => {
      if (!isCurrentClient()) return;
      const failure = normalizeZoomFailure(payload, "video");
      setLastFailure(failure);
      logClientFailure({ ...failure, operation: "media.event" }, 0);
      if (sdkJoinedRef.current) setState("media_degraded");
      setMessage(failure.userMessage);
    };
    const devicePermissionChange = (payload: unknown) => {
      if (!isCurrentClient()) return;
      const permission = payload as { name?: unknown; state?: unknown };
      if (permission.state === "denied") {
        setMessage("Permissao de camera ou microfone negada no navegador.");
      }
    };
    const videoCapturingChange = (payload: unknown) => {
      if (!isCurrentClient()) return;
      const state = readVideoCapturingState(payload);
      if (state === "Started") {
        const becameReady = localCaptureStateRef.current !== "ready";
        localCaptureStateRef.current = "ready";
        requestLocalPreviewReconcile({
          client,
          generation,
          resetAttempts: becameReady,
          trigger: "capture_started",
        });
      } else if (state === "Failed") {
        localCaptureStateRef.current = "failed";
        logClientFailure(
          {
            ...normalizeZoomFailure(payload, "video"),
            operation: "video.capture.event",
          },
          0,
        );
      } else if (state === "Stopped" && !localVideoStoppingRef.current) {
        localCaptureStateRef.current = "off";
      }
    };
    const videoDetailedDataChange = (payload: unknown) => {
      if (!isCurrentClient() || !videoStartedRef.current) return;
      const event = payload as { userId?: unknown };
      if (
        typeof event.userId !== "number" ||
        event.userId !== localUserIdRef.current
      ) {
        return;
      }
      requestLocalPreviewReconcile({
        client,
        generation,
        trigger: "video_detail",
      });
    };
    const events = [
      ["connection-change", connectionChange],
      ["user-added", userAdded],
      ["user-removed", userRemoved],
      ["user-updated", userUpdated],
      ["peer-video-state-change", peerVideoStateChange],
      ["active-media-failed", mediaFailed],
      ["device-permission-change", devicePermissionChange],
      ["video-capturing-change", videoCapturingChange],
      ["video-detailed-data-change", videoDetailedDataChange],
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

  async function resynchronizeConnectedVideo(
    client: ZoomVideoClient,
    generation: number,
  ) {
    if (!isCurrentVideoOwner(client, generation)) return;
    await identityResetOperationRef.current?.promise;
    if (!isCurrentVideoOwner(client, generation)) return;
    const previousUserId = localUserIdRef.current;
    const identity = resolveLocalParticipantIdentity(client, true);
    let currentParticipant: ZoomParticipant | undefined;
    try {
      currentParticipant = client.getCurrentUserInfo?.();
    } catch {
      currentParticipant = undefined;
    }
    if (videoStartedRef.current && currentParticipant?.bVideoOn === true) {
      const becameReady = localCaptureStateRef.current !== "ready";
      localCaptureStateRef.current = "ready";
      requestLocalPreviewReconcile({
        client,
        generation,
        resetAttempts: becameReady,
        trigger: "connected",
      });
    }

    if (
      identity &&
      previousUserId !== null &&
      previousUserId !== identity.userId
    ) {
      const pending = runLocalVideoOperation((activeGeneration) =>
        resetRenderedVideosAfterLocalIdentityChange(
          previousUserId,
          activeGeneration,
        ),
      );
      identityResetOperationRef.current = { generation, promise: pending };
      try {
        await pending;
      } finally {
        if (identityResetOperationRef.current?.promise === pending)
          identityResetOperationRef.current = null;
      }
    } else if (identity && videoStartedRef.current) {
      localPreviewAttemptsRef.current = 0;
      localPreviewFallbackAttemptedRef.current = false;
      await ensureLocalPreviewAttached(generation);
    }

    if (!isCurrentVideoOwner(client, generation)) return;
    await renderExistingRemoteVideos(client, generation);
    scheduleRemoteVideoResync(generation, client);
  }

  async function resetRenderedVideosAfterLocalIdentityChange(
    previousUserId: number,
    generation: number,
  ) {
    const stream = streamRef.current;
    const client = clientRef.current;
    if (!stream || !client) return;
    await localPreviewOperationRef.current?.promise;
    if (
      !isCurrentVideoOwner(client, generation) ||
      streamRef.current !== stream
    )
      return;
    localPreviewAttemptsRef.current = 0;
    const failures: CleanupFailure[] = [];
    for (const element of [...localUserElementsRef.current]) {
      await recordCleanupFailure(failures, "detachVideo:local-identity", () =>
        detectCleanupFailure(stream.detachVideo?.(previousUserId, element)),
      );
      if (
        !isCurrentVideoOwner(client, generation) ||
        streamRef.current !== stream
      )
        return;
    }
    localUserElementsRef.current = [];
    await stopAllRemoteVideos(failures);
    if (
      !isCurrentVideoOwner(client, generation) ||
      streamRef.current !== stream
    )
      return;
    selectedRemoteUserIdRef.current = null;
    selectedRemoteUserKeyRef.current = null;

    if (failures.length > 0) {
      reportActiveRenderCleanupFailures(failures);
    }
  }

  async function renderExistingRemoteVideos(
    client = clientRef.current,
    generation = attemptGenerationRef.current,
  ) {
    if (!client || !isCurrentVideoOwner(client, generation)) return;
    await identityResetOperationRef.current?.promise;
    if (!isCurrentVideoOwner(client, generation)) return;
    const identity = resolveLocalParticipantIdentity(client, false);
    if (!identity) {
      if (videoStartedRef.current) setLocalPreviewUnavailable(true);
      setRemoteParticipantPresent(false);
      setRemoteVideoState("off");
      return;
    }
    if (videoStartedRef.current) await ensureLocalPreviewAttached(generation);
    if (!isCurrentVideoOwner(client, generation)) return;
    const users = client.getAllUser?.() ?? [];
    await renderRemoteParticipants(users, client, generation, identity);
  }

  async function renderRemoteParticipants(
    users: ZoomParticipant[],
    client: ZoomVideoClient,
    generation: number,
    localIdentity: ZoomJoinParticipantIdentity,
  ) {
    if (!isCurrentVideoOwner(client, generation)) return;
    const selection = selectRemoteParticipant({
      localIdentity,
      previousUserId: selectedRemoteUserIdRef.current,
      users,
    });

    if (selection.kind === "ambiguous") {
      const failures: CleanupFailure[] = [];
      await stopAllRemoteVideos(failures);
      selectedRemoteUserIdRef.current = null;
      selectedRemoteUserKeyRef.current = null;
      if (!isCurrentVideoOwner(client, generation)) return;
      setRemoteParticipantPresent(true);
      setRemoteVideoState("error");
      setMessage(
        "Não foi possível exibir o vídeo da outra pessoa com segurança. Tente novamente.",
      );
      if (failures.length > 0) {
        reportActiveRenderCleanupFailures(failures);
      }
      if (remoteAmbiguityLoggedGenerationRef.current !== generation) {
        remoteAmbiguityLoggedGenerationRef.current = generation;
        console.warn(
          JSON.stringify({
            code: "ZOOM_VIDEO_REMOTE_IDENTITY_AMBIGUOUS",
            participantCount: selection.participantCount,
            requestId:
              requestId ?? lastVideoPayloadRef.current?.requestId ?? null,
          }),
        );
      }
      return;
    }

    remoteAmbiguityLoggedGenerationRef.current = null;
    if (selection.kind === "none") {
      const failures: CleanupFailure[] = [];
      await stopAllRemoteVideos(failures);
      selectedRemoteUserIdRef.current = null;
      selectedRemoteUserKeyRef.current = null;
      if (!isCurrentVideoOwner(client, generation)) return;
      if (failures.length > 0) {
        reportActiveRenderCleanupFailures(failures);
      }
      setRemoteParticipantPresent(false);
      setRemoteVideoState("off");
      return;
    }

    const selected = selection.participant;
    const previousSelectedUserId = selectedRemoteUserIdRef.current;
    const selectedIdentityChanged = Boolean(
      previousSelectedUserId === selected.userId &&
      selectedRemoteUserKeyRef.current &&
      selected.userKey &&
      selectedRemoteUserKeyRef.current !== selected.userKey,
    );
    if (
      previousSelectedUserId !== null &&
      (previousSelectedUserId !== selected.userId || selectedIdentityChanged)
    ) {
      await detachRemoteVideo(previousSelectedUserId, true);
    }
    if (!isCurrentVideoOwner(client, generation)) return;
    selectedRemoteUserIdRef.current = selected.userId;
    selectedRemoteUserKeyRef.current = selected.userKey ?? null;
    setRemoteParticipantPresent(true);

    if (selected.bVideoOn === true) {
      await attachRemoteVideo(selected.userId, client, generation);
    } else if (remoteUserElementsRef.current.has(selected.userId)) {
      await detachRemoteVideo(selected.userId, true);
    } else {
      setRemoteVideoState("off");
    }
  }

  function attachRemoteVideo(
    userId: number,
    client: ZoomVideoClient,
    generation: number,
  ) {
    const stream = streamRef.current;
    const container = remoteVideoRef.current;
    if (!stream?.attachVideo || !container) return Promise.resolve();
    if (
      !isCurrentVideoOwner(client, generation) ||
      selectedRemoteUserIdRef.current !== userId ||
      userId === localUserIdRef.current ||
      remoteUserElementsRef.current.has(userId)
    ) {
      return Promise.resolve();
    }

    const operationKey = `${generation}:${userId}`;
    const existing = remoteVideoOperationsRef.current.get(operationKey);
    if (existing) return existing;

    setRemoteParticipantPresent(true);
    setRemoteVideoState("attaching");
    let pending: Promise<void>;
    pending = (async () => {
      try {
        const attached = throwIfZoomFailure(
          await stream.attachVideo!(userId, 2),
          "video",
        );
        const elements = normalizeVideoElements(attached);
        if (elements.length === 0) throw new Error("remote_video_not_attached");
        if (
          !isCurrentVideoOwner(client, generation) ||
          selectedRemoteUserIdRef.current !== userId ||
          userId === localUserIdRef.current
        ) {
          await discardDetachedVideoElements(stream, userId, elements);
          return;
        }
        const localElementCollision = elements.filter((element) =>
          localUserElementsRef.current.includes(element),
        );
        if (localElementCollision.length > 0) {
          for (const element of localElementCollision) {
            try {
              await stream.detachVideo?.(userId, element);
            } catch {
              // Keep the local owner's DOM node in place and fail remote closed.
            }
          }
          throw new Error("remote_video_element_owner_collision");
        }
        for (const element of elements) {
          styleVideoElement(element);
          container.appendChild(element);
        }
        remoteUserElementsRef.current.set(userId, elements);
        setRemoteVideoState("on");
      } catch (error) {
        if (isCurrentVideoOwner(client, generation)) {
          setRemoteVideoState("error");
          setMessage(
            "Não foi possível exibir o vídeo da outra pessoa. Tente novamente.",
          );
          logClientFailure(
            {
              ...normalizeZoomFailure(error, "video"),
              operation: "video.attach.remote",
            },
            0,
          );
        }
      }
    })().finally(() => {
      if (remoteVideoOperationsRef.current.get(operationKey) === pending) {
        remoteVideoOperationsRef.current.delete(operationKey);
      }
    });
    remoteVideoOperationsRef.current.set(operationKey, pending);
    return pending;
  }

  async function detachRemoteVideo(
    userId: number,
    participantStillPresent = true,
  ) {
    const failures: CleanupFailure[] = [];
    await detachRemoteVideoWithFailures(userId, failures);
    if (failures.length > 0) {
      reportActiveRenderCleanupFailures(failures);
    }
    setRemoteParticipantPresent(participantStillPresent);
  }

  function reportActiveRenderCleanupFailures(failures: CleanupFailure[]) {
    console.warn(
      JSON.stringify({
        code: "ZOOM_VIDEO_RENDER_CLEANUP_PARTIAL_FAILURE",
        operations: failures.map((failure) => failure.operation),
      }),
    );
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
    const elements = remoteUserElementsRef.current.get(userId) ?? [];
    for (const element of elements) {
      await recordCleanupFailure(failures, "detachVideo:remote", () =>
        detectCleanupFailure(stream?.detachVideo?.(userId, element)),
      );
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

  function clearLocalPreviewManualRecheckTimers() {
    for (const timer of localPreviewManualRecheckTimersRef.current) {
      window.clearTimeout(timer);
    }
    localPreviewManualRecheckTimersRef.current = [];
  }

  function clearLocalRendererReadyWait() {
    localRendererReadyWaitRef.current?.resolve(false);
  }

  function scheduleRemoteVideoResync(
    generation = attemptGenerationRef.current,
    client = clientRef.current,
  ) {
    if (!client) return;
    clearRemoteVideoResyncTimers();
    for (const delay of [0, 350, 1_200]) {
      const timer = window.setTimeout(() => {
        if (isCurrentVideoOwner(client, generation))
          void renderExistingRemoteVideos(client, generation).catch((error) => {
            if (
              isCurrentVideoOwner(client, generation) &&
              !isAbortError(error)
            ) {
              logClientFailure(
                {
                  ...normalizeZoomFailure(error, "video"),
                  operation: "video.reconcile",
                },
                0,
              );
            }
          });
      }, delay);
      remoteVideoResyncTimersRef.current.push(timer);
    }
  }

  function isCurrentVideoOwner(
    client: ZoomVideoClient | null,
    generation: number,
  ) {
    return (
      mounted.current &&
      client !== null &&
      generation === attemptGenerationRef.current &&
      client === clientRef.current
    );
  }

  function isLocalParticipant(participant: ZoomParticipant) {
    if (participant.userId === localUserIdRef.current) return true;
    return Boolean(
      participant.userKey &&
      localUserKeyRef.current &&
      participant.userKey === localUserKeyRef.current,
    );
  }

  function eventContainsRemoteParticipant(
    client: ZoomVideoClient,
    payload: unknown,
  ) {
    if (!resolveLocalParticipantIdentity(client, false)) return false;
    return asParticipantArray(payload).some(
      (participant) =>
        !isLocalParticipant(
          client.getUser?.(participant.userId) ?? participant,
        ),
    );
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
    const waitingKind = previewUnavailable
      ? "operational_unavailable"
      : currentAccess?.allowed
        ? "entry_available"
        : currentAccess?.reason === ZoomAccessReason.TooEarly
          ? "too_early"
          : waitingRoomKind === "ended" ||
              waitingRoomKind === "arrival_expired" ||
              waitingRoomKind === "schedule_ended"
            ? waitingRoomKind
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
    (inFlight.current && state !== "media_initializing") ||
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
    <section
      className={sectionClassName}
      aria-label="Sala de video"
      data-session-state={state}
    >
      <div className="grid gap-4">
        <ZoomVideoStage
          actorRole={actorRole}
          audioMuted={audioMuted}
          localVideoPlayerRef={localVideoPlayerRef}
          localVideoRef={localVideoRef}
          localPreviewUnavailable={localPreviewUnavailable}
          onLocalRendererReady={handleLocalRendererReady}
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
        {videoOn &&
        localPreviewUnavailable &&
        (state === "joined" || state === "media_degraded") ? (
          <button
            className="mx-auto min-h-11 rounded-lg px-4 text-sm font-semibold text-brand-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            disabled={localPreviewAttaching || isBusy}
            onClick={retryLocalPreview}
            type="button"
          >
            {localPreviewAttaching
              ? "Preparando sua prévia…"
              : "Tentar mostrar minha câmera"}
          </button>
        ) : null}
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
          className="mt-3 flex gap-2 text-sm font-semibold leading-5 text-tesText-secondary"
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
              disabled={!isOnline || state === "reload_required"}
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

      {teardownFailures.length > 0 &&
      (state === "error" ||
        state === "reload_required" ||
        state === "leaving") ? (
        <p
          aria-live="assertive"
          className="mt-2 text-sm font-semibold leading-5 text-status-danger"
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

function hasDestroyClientFailure(failures: CleanupFailure[]) {
  return failures.some((failure) => failure.operation === "destroyClient");
}

function isDestroyedZoomClientFailure(
  failure: NormalizedZoomFailure,
  cleanupFailures: CleanupFailure[],
) {
  return (
    hasDestroyClientFailure(cleanupFailures) ||
    failure.reason === "destroy_client_failed"
  );
}

function createSdkFailure(
  errorCode: number,
  reason: string,
  _phase: ZoomOperationPhase,
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
      userKey?: unknown;
      userId?: unknown;
    };
    if (typeof user.userId !== "number") return [];

    return [
      {
        bVideoOn:
          typeof user.bVideoOn === "boolean" ? user.bVideoOn : undefined,
        displayName:
          typeof user.displayName === "string" ? user.displayName : undefined,
        userKey:
          typeof user.userKey === "string" && user.userKey.trim().length > 0
            ? user.userKey.trim()
            : undefined,
        userId: user.userId,
      },
    ];
  });
}

function normalizeParticipantIdentity(
  participant: ZoomParticipant | null | undefined,
): ZoomJoinParticipantIdentity | null {
  if (
    !participant ||
    !Number.isSafeInteger(participant.userId) ||
    participant.userId <= 0
  ) {
    return null;
  }
  const userKey = participant.userKey?.trim();
  return {
    userId: participant.userId,
    ...(userKey ? { userKey } : {}),
  };
}

function selectRemoteParticipant(input: {
  localIdentity: ZoomJoinParticipantIdentity;
  previousUserId: number | null;
  users: ZoomParticipant[];
}): RemoteParticipantSelection {
  const candidates = input.users.filter((participant) => {
    if (!Number.isSafeInteger(participant.userId) || participant.userId <= 0)
      return false;
    if (participant.userId === input.localIdentity.userId) return false;
    return !(
      input.localIdentity.userKey &&
      participant.userKey === input.localIdentity.userKey
    );
  });
  if (candidates.length === 0) return { kind: "none" };

  const knownKeys = new Set(
    candidates.flatMap((participant) =>
      participant.userKey ? [participant.userKey] : [],
    ),
  );
  const hasUnknownIdentity = candidates.some(
    (participant) => !participant.userKey,
  );
  if (knownKeys.size > 1 || (hasUnknownIdentity && candidates.length > 1)) {
    return { kind: "ambiguous", participantCount: candidates.length };
  }

  const previous = candidates.find(
    (participant) => participant.userId === input.previousUserId,
  );
  const activeCandidates = candidates.filter(
    (participant) => participant.bVideoOn === true,
  );
  const participant =
    (previous?.bVideoOn === true ? previous : null) ??
    activeCandidates[0] ??
    previous ??
    candidates[0];
  return { kind: "selected", participant };
}

async function discardDetachedVideoElements(
  stream: ZoomMediaStream,
  userId: number,
  elements: HTMLElement[],
) {
  for (const element of elements) {
    try {
      await stream.detachVideo?.(userId, element);
    } catch {
      // The owning generation is already stale; DOM ownership still must end.
    } finally {
      element.remove();
    }
  }
}

function normalizeVideoElements(value: unknown): HTMLElement[] {
  const items = Array.isArray(value) ? value : [value];
  return items.filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  );
}

function getVideoPlayerBoundUserId(element: HTMLElement): number | null {
  const raw = element.getAttribute("node-id");
  if (!raw) return null;
  const userId = Number(raw);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

function waitForVideoPlayerBinding(input: {
  element: HTMLElement;
  isCurrentOwner: () => boolean;
  timeoutMs: number;
  userId: number;
}): Promise<boolean> {
  if (
    input.isCurrentOwner() &&
    getVideoPlayerBoundUserId(input.element) === input.userId
  ) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (bound: boolean) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearInterval(ownerTimer);
      window.clearTimeout(timeout);
      resolve(bound);
    };
    const verify = () => {
      if (!input.isCurrentOwner()) {
        finish(false);
        return;
      }
      if (getVideoPlayerBoundUserId(input.element) === input.userId) {
        finish(true);
      }
    };
    const observer = new MutationObserver(verify);
    observer.observe(input.element, {
      attributeFilter: ["node-id"],
      attributes: true,
    });
    const ownerTimer = window.setInterval(verify, 50);
    const timeout = window.setTimeout(() => finish(false), input.timeoutMs);
    verify();
  });
}

function readVideoCapturingState(
  value: unknown,
): "Failed" | "Started" | "Stopped" | null {
  if (!value || typeof value !== "object") return null;
  const state = (value as { state?: unknown }).state;
  return state === "Failed" || state === "Started" || state === "Stopped"
    ? state
    : null;
}

function readVideoCapabilities(stream: ZoomMediaStream | null) {
  // Diagnostics must never fail a valid call or infer a browser limitation.
  try {
    const capturing = stream?.isCapturingVideo?.();
    const multiple = stream?.isSupportMultipleVideos?.();
    const maximum = stream?.getMaxRenderableVideos?.();
    return {
      ...(typeof capturing === "boolean" ? { capturingVideo: capturing } : {}),
      ...(typeof multiple === "boolean"
        ? { supportsMultipleVideos: multiple }
        : {}),
      ...(typeof maximum === "number" && Number.isFinite(maximum)
        ? { maxRenderableVideos: maximum }
        : {}),
    };
  } catch {
    return {};
  }
}

function styleVideoElement(element: HTMLElement) {
  element.classList.add("block", "h-full", "w-full", "object-cover");
}

function styleLocalVideoElement(element: HTMLElement) {
  styleVideoElement(element);
  // An SDK-created fallback is a sibling of React's persistent player. Keep
  // it in the same visual layer so it cannot be laid out below the clipped
  // tile on mobile browsers.
  element.classList.add("absolute", "inset-0");
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

function formatInitialAudioError(error: unknown) {
  const failure = normalizeZoomFailure(error, "audio");
  if (failure.category === "permission") return failure.userMessage;

  return "Você entrou na sessão, mas não foi possível preparar o áudio agora. Tente ativá-lo nos controles.";
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
