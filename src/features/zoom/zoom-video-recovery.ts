export type ZoomOperationPhase =
  | "access"
  | "assets"
  | "init"
  | "join"
  | "connection"
  | "audio"
  | "video"
  | "cleanup";

export type ZoomRecoveryCategory =
  | "transient"
  | "offline"
  | "permission"
  | "reload_media"
  | "ended"
  | "permanent";

export type ZoomExecutedFailure = {
  errorCode: number;
  reason: string;
  type: string;
};

export type NormalizedZoomFailure = {
  category: ZoomRecoveryCategory;
  code: number | null;
  phase: ZoomOperationPhase;
  reason: string;
  retryable: boolean;
  shouldReload: boolean;
  userMessage: string;
};

const TRANSIENT_CODES = new Set([1, 2, 5002, 5003, 5012]);
const PERMISSION_CODES = new Set([103, 203]);
const RELOAD_MEDIA_CODES = new Set([101, 102, 104, 201, 202, 204, 205, 206]);
const ENDED_CODES = new Set([3009, 4004]);
const PERMANENT_CODES = new Set([200, 3010, 5000, 5001, 5013]);
const ACCESS_DOMAIN_MESSAGES: Record<string, string> = {
  booking_not_found:
    "Não foi possível localizar este encontro para a sua conta.",
  role_mismatch:
    "Este encontro deve ser acessado com a conta correspondente ao seu papel na sessão.",
  therapist_not_allowed:
    "Seu cadastro profissional ainda não está completo e aprovado para iniciar atendimentos.",
  therapist_profile_not_found:
    "Seu cadastro profissional ainda não está completo e aprovado para iniciar atendimentos.",
  therapist_receiving_account_required:
    "Conclua o cadastro da sua conta de recebimento antes de iniciar o atendimento.",
  therapist_suspended:
    "O acesso à sala está bloqueado para este perfil. Fale com o suporte.",
};

export class ZoomOperationError extends Error {
  readonly failure: NormalizedZoomFailure;

  constructor(failure: NormalizedZoomFailure) {
    super(failure.userMessage);
    this.name = "ZoomOperationError";
    this.failure = failure;
  }
}

export function assertZoomExecutedResult(
  result: unknown,
  phase: ZoomOperationPhase,
) {
  if (result === "") return;

  if (isZoomExecutedFailure(result)) {
    throw new ZoomOperationError(normalizeZoomFailure(result, phase));
  }

  throw new ZoomOperationError(
    normalizeZoomFailure(
      {
        errorCode: 2,
        reason: "unexpected_sdk_result",
        type: "INTERNAL_ERROR",
      },
      phase,
    ),
  );
}

export function throwIfZoomFailure(result: unknown, phase: ZoomOperationPhase) {
  if (isZoomExecutedFailure(result)) {
    throw new ZoomOperationError(normalizeZoomFailure(result, phase));
  }
  return result;
}

export function normalizeZoomFailure(
  error: unknown,
  phase: ZoomOperationPhase,
): NormalizedZoomFailure {
  if (error instanceof ZoomOperationError) return error.failure;

  if (isAbortError(error)) {
    return buildFailure({
      category: "transient",
      code: 1,
      phase,
      reason: "operation_timeout",
      retryable: true,
      shouldReload: true,
      userMessage: "A conexão com a sala demorou mais que o esperado.",
    });
  }

  if (isOfflineError(error)) {
    return buildFailure({
      category: "offline",
      code: null,
      phase,
      reason: "offline",
      retryable: true,
      shouldReload: false,
      userMessage:
        "Sua internet caiu. Vamos retomar a conexão automaticamente quando ela voltar.",
    });
  }

  const executed = isZoomExecutedFailure(error) ? error : null;
  const record = isRecord(error) ? error : null;
  const code =
    executed?.errorCode ??
    toFiniteNumber(record?.errorCode) ??
    toFiniteNumber(record?.code);
  const reason = normalizeReason(
    executed?.reason ??
      (typeof record?.reason === "string" ? record.reason : undefined) ??
      (typeof record?.message === "string" ? record.message : undefined) ??
      (error instanceof Error ? error.message : "unknown_zoom_failure"),
  );

  if (
    phase === "access" &&
    (code === 401 || reason === "authentication_expired")
  ) {
    return buildFailure({
      category: "permanent",
      code: 401,
      phase,
      reason: "authentication_expired",
      retryable: false,
      shouldReload: false,
      userMessage:
        "Sua sessão de acesso expirou. Entre novamente na sua conta para voltar ao encontro.",
    });
  }

  const accessDomainMessage =
    phase === "access" ? ACCESS_DOMAIN_MESSAGES[reason.toLowerCase()] : undefined;
  if (accessDomainMessage) {
    return buildFailure({
      category: "permanent",
      code,
      phase,
      reason,
      retryable: false,
      shouldReload: false,
      userMessage: accessDomainMessage,
    });
  }

  if (code !== null && PERMISSION_CODES.has(code)) {
    return buildFailure({
      category: "permission",
      code,
      phase,
      reason,
      retryable: false,
      shouldReload: false,
      userMessage:
        "O navegador bloqueou a câmera ou o microfone. Libere a permissão e tente novamente.",
    });
  }

  if (code !== null && RELOAD_MEDIA_CODES.has(code)) {
    return buildFailure({
      category: "reload_media",
      code,
      phase,
      reason,
      retryable: false,
      shouldReload: true,
      userMessage:
        "A mídia da chamada precisa ser reiniciada para recuperar a conexão.",
    });
  }

  if (code === 105) {
    return buildFailure({
      category: "permanent",
      code,
      phase,
      reason,
      retryable: false,
      shouldReload: false,
      userMessage:
        "Seu microfone está silenciado pelo sistema. Libere o microfone nas configurações do dispositivo.",
    });
  }

  if (code !== null && ENDED_CODES.has(code)) {
    return buildFailure({
      category: "ended",
      code,
      phase,
      reason,
      retryable: false,
      shouldReload: false,
      userMessage:
        code === 3009
          ? "Seu acesso a esta chamada foi encerrado. Se isso não era esperado, fale com o suporte."
          : "Este encontro já foi encerrado.",
    });
  }

  if (
    (code !== null && TRANSIENT_CODES.has(code)) ||
    /duplicat|already exist|participant.*exist|operation.lock|reconnect|timeout|internal.error|session.closed/i.test(
      reason,
    )
  ) {
    return buildFailure({
      category: "transient",
      code,
      phase,
      reason,
      retryable: true,
      shouldReload: true,
      userMessage: "A conexão anterior ainda está sendo encerrada.",
    });
  }

  if (code !== null && PERMANENT_CODES.has(code)) {
    return buildFailure({
      category: "permanent",
      code,
      phase,
      reason,
      retryable: false,
      shouldReload: false,
      userMessage:
        "Não foi possível validar esta sala. Tente novamente e, se continuar, fale com o suporte.",
    });
  }

  return buildFailure({
    category: "permanent",
    code,
    phase,
    reason,
    retryable: false,
    shouldReload: false,
    userMessage:
      "Não conseguimos abrir o vídeo agora. Tente novamente e, se continuar, fale com o suporte.",
  });
}

export function normalizeConnectionChange(payload: unknown) {
  const event = isRecord(payload) ? payload : {};

  return {
    errorCode: toFiniteNumber(event.errorCode),
    reason: typeof event.reason === "string" ? event.reason : undefined,
    state: typeof event.state === "string" ? event.state : "",
  };
}

export function isZoomExecutedFailure(
  value: unknown,
): value is ZoomExecutedFailure {
  if (!isRecord(value)) return false;
  return (
    typeof value.type === "string" &&
    typeof value.reason === "string" &&
    typeof value.errorCode === "number" &&
    Number.isFinite(value.errorCode)
  );
}

function buildFailure(failure: NormalizedZoomFailure) {
  return failure;
}

function isOfflineError(error: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return true;
  return (
    error instanceof TypeError && /fetch|network|offline/i.test(error.message)
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeReason(reason: string) {
  return reason.replace(/[\r\n]+/g, " ").slice(0, 160);
}
