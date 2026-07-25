export const DomainErrorCode = {
  BlockImpactsExistingBookings: "BLOCK_IMPACTS_EXISTING_BOOKINGS",
  BookingAlreadyPaid: "BOOKING_ALREADY_PAID",
  BookingCannotBeRescheduled: "BOOKING_CANNOT_BE_RESCHEDULED",
  BookingConflict: "BOOKING_CONFLICT",
  InvalidAvailabilityRange: "INVALID_AVAILABILITY_RANGE",
  InvalidStateTransition: "INVALID_STATE_TRANSITION",
  OverlappingAvailabilityRule: "OVERLAPPING_AVAILABILITY_RULE",
  SessionAccessNotOpen: "SESSION_ACCESS_NOT_OPEN",
  SlotHeldByAnotherUser: "SLOT_HELD_BY_ANOTHER_USER",
  SlotNotAvailable: "SLOT_NOT_AVAILABLE",
} as const;

export type DomainErrorCode =
  (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export type DomainErrorCategory =
  | "availability"
  | "booking"
  | "conflict"
  | "payment"
  | "session"
  | "validation";

type DomainErrorDefinition = {
  category: DomainErrorCategory;
  retryable: boolean;
  safeMessage: string;
  suggestedHttpStatus: number;
};

export const domainErrorDefinitions: Record<
  DomainErrorCode,
  DomainErrorDefinition
> = {
  [DomainErrorCode.BlockImpactsExistingBookings]: {
    category: "conflict",
    retryable: false,
    safeMessage:
      "Este bloqueio afeta encontros existentes. Revise a agenda antes de continuar.",
    suggestedHttpStatus: 409,
  },
  [DomainErrorCode.BookingAlreadyPaid]: {
    category: "payment",
    retryable: false,
    safeMessage: "Este encontro já possui um pagamento confirmado.",
    suggestedHttpStatus: 409,
  },
  [DomainErrorCode.BookingCannotBeRescheduled]: {
    category: "booking",
    retryable: false,
    safeMessage: "Este encontro não pode ser reagendado no momento.",
    suggestedHttpStatus: 409,
  },
  [DomainErrorCode.BookingConflict]: {
    category: "conflict",
    retryable: true,
    safeMessage: "O horário escolhido entrou em conflito com outro encontro.",
    suggestedHttpStatus: 409,
  },
  [DomainErrorCode.InvalidAvailabilityRange]: {
    category: "validation",
    retryable: false,
    safeMessage: "Revise os horários informados antes de continuar.",
    suggestedHttpStatus: 422,
  },
  [DomainErrorCode.InvalidStateTransition]: {
    category: "validation",
    retryable: false,
    safeMessage: "Esta alteração de status não está disponível.",
    suggestedHttpStatus: 409,
  },
  [DomainErrorCode.OverlappingAvailabilityRule]: {
    category: "availability",
    retryable: false,
    safeMessage: "Existem faixas de disponibilidade sobrepostas.",
    suggestedHttpStatus: 409,
  },
  [DomainErrorCode.SessionAccessNotOpen]: {
    category: "session",
    retryable: true,
    safeMessage: "O acesso ao encontro ainda não está disponível.",
    suggestedHttpStatus: 403,
  },
  [DomainErrorCode.SlotHeldByAnotherUser]: {
    category: "conflict",
    retryable: true,
    safeMessage: "Este horário está sendo reservado por outra pessoa.",
    suggestedHttpStatus: 409,
  },
  [DomainErrorCode.SlotNotAvailable]: {
    category: "availability",
    retryable: true,
    safeMessage: "Este horário não está mais disponível.",
    suggestedHttpStatus: 409,
  },
};

export class TesDomainError extends Error {
  readonly category: DomainErrorCategory;
  readonly code: DomainErrorCode;
  readonly retryable: boolean;
  readonly safeMessage: string;
  readonly suggestedHttpStatus: number;

  constructor(code: DomainErrorCode, internalMessage?: string) {
    super(internalMessage ?? code);
    this.name = "TesDomainError";
    this.code = code;

    const definition = domainErrorDefinitions[code];
    this.category = definition.category;
    this.retryable = definition.retryable;
    this.safeMessage = definition.safeMessage;
    this.suggestedHttpStatus = definition.suggestedHttpStatus;
  }
}
