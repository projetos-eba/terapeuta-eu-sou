import type { TherapistScheduleService } from "@/domain/tes";
import type { TherapistAgendaReadModel } from "@/features/bookings";

export const scheduleWeekDays = [
  { dayOfWeek: 1, label: "Segunda-feira", shortLabel: "Seg" },
  { dayOfWeek: 2, label: "Terça-feira", shortLabel: "Ter" },
  { dayOfWeek: 3, label: "Quarta-feira", shortLabel: "Qua" },
  { dayOfWeek: 4, label: "Quinta-feira", shortLabel: "Qui" },
  { dayOfWeek: 5, label: "Sexta-feira", shortLabel: "Sex" },
  { dayOfWeek: 6, label: "Sábado", shortLabel: "Sáb" },
  { dayOfWeek: 0, label: "Domingo", shortLabel: "Dom" },
] as const;

export type ScheduleScope = string | "all";

type ScheduleRuleView = {
  dayOfWeek: number;
  endTime: string;
  isActive: boolean;
  serviceId: string | null;
  startTime: string;
};

export function normalizeClock(value: string) {
  return value.slice(0, 5);
}

export function getRulesForScope<Rule extends ScheduleRuleView>(
  rules: Rule[],
  scope: ScheduleScope,
) {
  return rules.filter((rule) =>
    scope === "all" ? rule.serviceId === null : rule.serviceId === scope,
  );
}

export function getApplicableRules<Rule extends ScheduleRuleView>(
  rules: Rule[],
  scope: ScheduleScope,
) {
  if (scope === "all") return getRulesForScope(rules, scope);

  return rules.filter(
    (rule) => rule.serviceId === null || rule.serviceId === scope,
  );
}

export function hasOverlappingAvailabilityRules<Rule extends ScheduleRuleView>(
  rules: Rule[],
) {
  return rules.some((leftRule, index) =>
    rules.slice(index + 1).some((rightRule) =>
      availabilityRulesOverlap(leftRule, rightRule),
    ),
  );
}

export function availabilityRulesOverlap(
  leftRule: ScheduleRuleView,
  rightRule: ScheduleRuleView,
) {
  if (
    !leftRule.isActive ||
    !rightRule.isActive ||
    leftRule.dayOfWeek !== rightRule.dayOfWeek ||
    !rangesAreValid(leftRule) ||
    !rangesAreValid(rightRule)
  ) {
    return false;
  }

  const scopesConflict =
    leftRule.serviceId === null ||
    rightRule.serviceId === null ||
    leftRule.serviceId === rightRule.serviceId;
  const leftStart = normalizeClock(leftRule.startTime);
  const leftEnd = normalizeClock(leftRule.endTime);
  const rightStart = normalizeClock(rightRule.startTime);
  const rightEnd = normalizeClock(rightRule.endTime);

  return (
    scopesConflict &&
    leftStart < rightEnd &&
    rightStart < leftEnd
  );
}

export function calculateWeeklyAvailability(
  rules: ScheduleRuleView[],
  scope: ScheduleScope,
) {
  const applicableRules = getApplicableRules(rules, scope).filter(
    (rule) => rule.isActive,
  );
  const configuredDays = new Set(applicableRules.map((rule) => rule.dayOfWeek))
    .size;
  const weeklyAvailableMinutes = applicableRules.reduce(
    (total, rule) =>
      total + clockToMinutes(rule.endTime) - clockToMinutes(rule.startTime),
    0,
  );

  return {
    configuredDays,
    unconfiguredDays: 7 - configuredDays,
    weeklyAvailableMinutes,
  };
}

export function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

export function buildPopularScheduleTimes(input: {
  agenda: TherapistAgendaReadModel | null;
  referenceNow: string;
  scope: ScheduleScope;
  timezone: string;
}) {
  if (!input.agenda) return [];

  const now = new Date(input.referenceNow);
  const periodStart = new Date(now);
  periodStart.setUTCDate(periodStart.getUTCDate() - 30);
  const counts = new Map<string, { count: number; label: string }>();

  for (const booking of input.agenda.bookings) {
    const startsAt = new Date(booking.startsAt);
    if (
      startsAt < periodStart ||
      startsAt > now ||
      (input.scope !== "all" && booking.serviceId !== input.scope)
    ) {
      continue;
    }

    const label = formatTimeRange(
      booking.startsAt,
      booking.endsAt,
      input.timezone,
    );
    const previous = counts.get(label);
    counts.set(label, { count: (previous?.count ?? 0) + 1, label });
  }

  return Array.from(counts.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);
}

export function buildUpcomingExceptions(input: {
  agenda: TherapistAgendaReadModel | null;
  referenceNow: string;
  scope: ScheduleScope;
  timezone: string;
}) {
  if (!input.agenda) return [];

  const now = new Date(input.referenceNow);

  return input.agenda.availability.exceptions
    .filter(
      (exception) =>
        new Date(exception.endsAt) > now &&
        (exception.serviceId === null ||
          input.scope === "all" ||
          exception.serviceId === input.scope),
    )
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    )
    .slice(0, 3)
    .map((exception) => ({
      dateLabel: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: input.timezone,
      }).format(new Date(exception.startsAt)),
      id: exception.id,
      label: exception.isAvailable
        ? "Disponibilidade extra"
        : "Período indisponível",
      timeLabel: formatTimeRange(
        exception.startsAt,
        exception.endsAt,
        input.timezone,
      ),
    }));
}

export function findDefaultScheduleScope(
  services: TherapistScheduleService[],
  rules: ScheduleRuleView[],
): ScheduleScope {
  return (
    services.find((service) =>
      rules.some((rule) => rule.serviceId === service.id),
    )?.id ??
    services[0]?.id ??
    "all"
  );
}

function clockToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = normalizeClock(value).split(":");
  return Number(hours) * 60 + Number(minutes);
}

function rangesAreValid(rule: ScheduleRuleView) {
  const start = normalizeClock(rule.startTime);
  const end = normalizeClock(rule.endTime);

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(start) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(end) &&
    start < end;
}

function formatTimeRange(startsAt: string, endsAt: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: timezone,
  });

  return `${formatter.format(new Date(startsAt))} – ${formatter.format(
    new Date(endsAt),
  )}`;
}
