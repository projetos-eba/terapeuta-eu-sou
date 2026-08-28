import type {
  ReservationContext,
  ReservationDay,
  PatientScheduleInterval,
  ReservationPatientSummary,
  ReservationSchedule,
  ReservationStep,
} from "./types";
import type { AvailabilityDay } from "@/features/therapist-profile/types";
import { normalizeTimeZone } from "@/features/bookings/session-formatters";
import { routes } from "@/lib/routes";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const therapistDirectory: Record<
  string,
  {
    avatarUrl: string;
    headline: string;
    name: string;
  }
> = {
  "ana-oliveira": {
    avatarUrl: "/therapists/ana-oliveira.png",
    headline: "Terapeuta integrativa",
    name: "Ana Oliveira",
  },
  "celia-martins": {
    avatarUrl: "/therapists/celia-martins.png",
    headline: "Constelação Familiar",
    name: "Célia Martins",
  },
  "juliana-costa": {
    avatarUrl: "/therapists/juliana-costa.png",
    headline: "Terapeuta familiar",
    name: "Juliana Costa",
  },
  "lucas-pereira": {
    avatarUrl: "/therapists/lucas-pereira-avatar.png",
    headline: "Tarô terapêutico",
    name: "Lucas Pereira",
  },
  "rafael-santos": {
    avatarUrl: "/therapists/rafael-santos-avatar.png",
    headline: "Tarô terapêutico",
    name: "Rafael Santos",
  },
};

const therapyLabels: Record<string, string> = {
  "constelacao-familiar": "Constelação Familiar",
  reiki: "Reiki",
  taro: "Tarô",
};

export function resolveReservationContext(input: {
  isPatientAuthenticated: boolean;
  patient?: ReservationPatientSummary | null;
  searchParams?: Record<string, string | string[] | undefined>;
  timezone?: string;
}): ReservationContext {
  const params = toUrlSearchParams(input.searchParams);
  const step = parseStep(params.get("etapa") ?? params.get("step"));
  const selectedSlot = parseIsoDate(params.get("slot"));
  const durationMinutes = parsePositiveInteger(params.get("duration"));
  const priceCents = parsePositiveInteger(params.get("price"));
  const serviceId = parseUuid(params.get("service"));
  const therapistSlug = normalizeSlug(params.get("therapist"));
  const therapySlug = normalizeSlug(params.get("therapy"));
  const source = normalizeSource(params.get("source"));
  const therapist = therapistSlug ? therapistDirectory[therapistSlug] : null;
  const timezone = normalizeTimeZone(input.timezone ?? "America/Sao_Paulo");
  const currentPath = `/reserva${params.toString() ? `?${params.toString()}` : ""}`;

  const serviceLabel =
    readCleanLabel(params.get("serviceName")) ??
    (therapySlug
      ? `${therapyLabels[therapySlug] ?? titleizeSlug(therapySlug)} online`
      : null) ??
    "Encontro online TES";

  const time = selectedSlot
    ? formatReservationTime(selectedSlot, durationMinutes ?? 50, timezone)
    : null;

  const prepareStepHref = buildReservationHref(params, { etapa: "preparar" });
  const paymentStepHref = buildReservationHref(params, { etapa: "pagamento" });

  return {
    canPrepareEncounter: Boolean(selectedSlot),
    currentPath,
    durationMinutes,
    hasRequiredCheckoutData: Boolean(serviceId && selectedSlot),
    isPatientAuthenticated: input.isPatientAuthenticated,
    marketingConsent: params.get("marketing") === "1",
    hiddenPatientConflictCount: 0,
    nextStepHref: step === "momento" ? prepareStepHref : paymentStepHref,
    patient: input.patient ?? null,
    paymentStepHref,
    prepareStepHref,
    priceCents,
    priceLabel: formatCurrency(priceCents),
    patientScheduleCheckStatus: input.isPatientAuthenticated
      ? "unavailable"
      : "not_applicable",
    selectedSlot,
    selectedSlotHasPatientConflict: false,
    serviceId,
    serviceLabel,
    serviceSummary:
      durationMinutes && priceCents
        ? `${serviceLabel} (${durationMinutes} min)`
        : serviceLabel,
    source,
    step,
    therapist: {
      avatarUrl: therapist?.avatarUrl ?? null,
      headline: therapist?.headline ?? "Profissional TES",
      isVerified: Boolean(therapistSlug),
      name:
        therapist?.name ??
        titleizeSlug(therapistSlug) ??
        "Terapeuta selecionado",
      slug: therapistSlug,
    },
    therapySlug,
    timezone,
    time,
  };
}

export function applyPatientScheduleConflicts(input: {
  availabilityDays: AvailabilityDay[];
  context: ReservationContext;
  intervals: PatientScheduleInterval[];
}) {
  let hiddenPatientConflictCount = 0;
  const availabilityDays = input.availabilityDays.map((day) => ({
    ...day,
    slots: day.slots.filter((slot) => {
      const conflicts = input.intervals.some((interval) =>
        intervalsOverlap(slot, interval),
      );
      if (conflicts) hiddenPatientConflictCount += 1;
      return !conflicts;
    }),
  }));
  const selectedEndsAt =
    input.context.selectedSlot && input.context.durationMinutes
      ? new Date(
          new Date(input.context.selectedSlot).getTime() +
            input.context.durationMinutes * 60_000,
        ).toISOString()
      : null;
  const selectedSlotHasPatientConflict = Boolean(
    input.context.selectedSlot &&
    selectedEndsAt &&
    input.intervals.some((interval) =>
      intervalsOverlap(
        { endsAt: selectedEndsAt, startsAt: input.context.selectedSlot! },
        interval,
      ),
    ),
  );

  return {
    availabilityDays,
    context: {
      ...input.context,
      canPrepareEncounter:
        input.context.canPrepareEncounter && !selectedSlotHasPatientConflict,
      hiddenPatientConflictCount,
      patientScheduleCheckStatus: "available" as const,
      selectedSlotHasPatientConflict,
    },
  };
}

export function getReservationScheduleWindow(
  availabilityDays: AvailabilityDay[],
  context: ReservationContext,
) {
  const intervals = availabilityDays.flatMap((day) =>
    day.slots.map((slot) => ({
      endsAt: new Date(slot.endsAt).getTime(),
      startsAt: new Date(slot.startsAt).getTime(),
    })),
  );

  if (context.selectedSlot && context.durationMinutes) {
    const startsAt = new Date(context.selectedSlot).getTime();
    intervals.push({
      endsAt: startsAt + context.durationMinutes * 60_000,
      startsAt,
    });
  }

  const valid = intervals.filter(
    (interval) =>
      Number.isFinite(interval.startsAt) &&
      Number.isFinite(interval.endsAt) &&
      interval.startsAt < interval.endsAt,
  );
  if (valid.length === 0) return null;

  return {
    end: new Date(Math.max(...valid.map((interval) => interval.endsAt))),
    start: new Date(Math.min(...valid.map((interval) => interval.startsAt))),
  };
}

function intervalsOverlap(
  left: { endsAt: string; startsAt: string },
  right: { endsAt: string; startsAt: string },
) {
  const leftStart = new Date(left.startsAt).getTime();
  const leftEnd = new Date(left.endsAt).getTime();
  const rightStart = new Date(right.startsAt).getTime();
  const rightEnd = new Date(right.endsAt).getTime();

  return leftStart < rightEnd && rightStart < leftEnd;
}

export function buildReservationSchedule(
  context: ReservationContext,
  availabilityDays: AvailabilityDay[] = [],
): ReservationSchedule {
  const current = new URLSearchParams(context.currentPath.split("?")[1] ?? "");
  const availabilityByDate = new Map(
    availabilityDays.map((day) => [day.date, day]),
  );
  const today = startOfLocalDay(new Date());
  const referenceDate = context.selectedSlot
    ? new Date(context.selectedSlot)
    : (parseDateKey(current.get("date")) ?? today);
  const referenceStart = startOfLocalDay(referenceDate);
  const firstDay = new Date(referenceStart);
  firstDay.setDate(referenceStart.getDate() - 2);

  if (firstDay < today) {
    firstDay.setTime(today.getTime());
  }

  const previousReference = new Date(referenceDate);
  previousReference.setDate(referenceDate.getDate() - 2);
  const previousHref =
    startOfLocalDay(previousReference) < today
      ? null
      : buildReservationHref(current, {
          date: formatDateKey(previousReference),
          etapa: "momento",
          slot: null,
        });

  const nextReference = new Date(referenceDate);
  nextReference.setDate(referenceDate.getDate() + 2);

  return {
    days: Array.from({ length: 5 }, (_, dayIndex) => {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + dayIndex);

      const dateKey = formatDateKey(date);
      const slots =
        availabilityByDate.get(dateKey)?.slots.map((slot) => ({
          href: buildReservationHref(current, {
            etapa: "momento",
            slot: slot.startsAt,
          }),
          isSelected: context.selectedSlot === parseIsoDate(slot.startsAt),
          startsAt: slot.startsAt,
          timeLabel: slot.timeLabel,
        })) ?? [];

      return {
        dateKey,
        dateLabel: date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        }),
        dayLabel: formatRelativeDayLabel(date, today),
        slots,
      };
    }),
    nextHref: buildReservationHref(current, {
      date: formatDateKey(nextReference),
      etapa: "momento",
      slot: null,
    }),
    previousHref,
  };
}

export function reconcileReservationContextWithAvailability(
  context: ReservationContext,
  availabilityDays: AvailabilityDay[] | null,
): ReservationContext {
  if (!availabilityDays) return context;

  const selectedSlotIsAvailable = Boolean(
    context.selectedSlot &&
    availabilityDays.some((day) =>
      day.slots.some(
        (slot) => parseIsoDate(slot.startsAt) === context.selectedSlot,
      ),
    ),
  );

  return {
    ...context,
    canPrepareEncounter: selectedSlotIsAvailable,
  };
}

export function mergeReservationContextWithPublicProfile(
  context: ReservationContext,
  input: {
    avatarUrl: string | null;
    headline: string;
    isVerified: boolean;
    name: string;
    service?: {
      durationMinutes: number;
      priceCents: number;
      priceLabel: string;
      title: string;
      therapySlug: string;
    };
    slug: string;
    timezone?: string;
  },
): ReservationContext {
  const durationMinutes =
    context.durationMinutes ?? input.service?.durationMinutes ?? null;
  const priceCents = context.priceCents ?? input.service?.priceCents ?? null;
  const serviceLabel = input.service?.title ?? context.serviceLabel;
  const timezone = normalizeTimeZone(input.timezone ?? context.timezone);
  const time = context.selectedSlot
    ? formatReservationTime(
        context.selectedSlot,
        durationMinutes ?? 50,
        timezone,
      )
    : null;

  return {
    ...context,
    durationMinutes,
    priceCents,
    priceLabel:
      context.priceCents === null && input.service
        ? input.service.priceLabel
        : context.priceLabel,
    serviceLabel,
    serviceSummary: durationMinutes
      ? `${serviceLabel} (${durationMinutes} min)`
      : serviceLabel,
    therapist: {
      avatarUrl: input.avatarUrl,
      headline: input.headline,
      isVerified: input.isVerified,
      name: input.name,
      slug: input.slug,
    },
    therapySlug: context.therapySlug ?? input.service?.therapySlug ?? null,
    timezone,
    time,
  };
}

export function buildReservationHref(
  current: URLSearchParams,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams(current);

  for (const [key, value] of Object.entries(updates)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }

  return `/reserva?${next.toString()}`;
}

export function buildReservationReturnHref(therapistSlug: string | null) {
  return therapistSlug
    ? routes.public.therapistProfile(therapistSlug)
    : routes.public.therapists;
}

export function buildClientAuthHref(kind: "login" | "signup", next: string) {
  const base = kind === "login" ? "/cliente/login" : "/cliente/cadastro";
  const params = new URLSearchParams({ next });
  return `${base}?${params.toString()}`;
}

function toUrlSearchParams(
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      if (value[0]) params.set(key, value[0]);
    } else if (value) {
      params.set(key, value);
    }
  }

  return params;
}

function parseStep(value: string | null): ReservationStep {
  if (value === "preparar" || value === "pagamento") return value;
  return "momento";
}

function parseIsoDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseDateKey(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePositiveInteger(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseUuid(value: string | null) {
  return value && UUID.test(value) ? value : null;
}

function normalizeSlug(value: string | null) {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);
  return normalized || null;
}

function normalizeSource(value: string | null) {
  const normalized = normalizeSlug(value);
  return normalized ? normalized.slice(0, 32) : null;
}

function readCleanLabel(value: string | null) {
  const clean = value?.trim().replace(/\s+/g, " ").slice(0, 80);
  return clean || null;
}

function titleizeSlug(value: string | null) {
  if (!value) return null;
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatReservationTime(
  startsAt: string,
  durationMinutes: number,
  timezone: string,
) {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const timeZone = normalizeTimeZone(timezone);

  return {
    dateLabel: start.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      timeZone,
      year: "numeric",
    }),
    dateLongLabel: start.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      timeZone,
      weekday: "long",
    }),
    timeRangeLabel: `${start.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    })} - ${end.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    })}`,
  };
}

function startOfLocalDay(date: Date) {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

function formatRelativeDayLabel(date: Date, today: Date) {
  const day = startOfLocalDay(date);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (day.getTime() === today.getTime()) return "Hoje";
  if (day.getTime() === tomorrow.getTime()) return "Amanhã";

  const label = date.toLocaleDateString("pt-BR", { weekday: "short" });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(value: number | null) {
  if (!value) return "A confirmar";
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(value / 100);
}
