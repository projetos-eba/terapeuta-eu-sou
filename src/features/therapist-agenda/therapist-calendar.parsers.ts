import {
  parseSessionReadModelItem,
  SessionReadModelContractError,
} from "@/features/bookings";

import type {
  TherapyCalendarColorKey,
  TherapistCalendarAttentionItem,
  TherapistCalendarBlock,
  TherapistCalendarDemandItem,
  TherapistCalendarHold,
  TherapistCalendarReadModel,
  TherapistCalendarService,
  TherapistCalendarView,
} from "./therapist-calendar.types";

const colorKeys = new Set<TherapyCalendarColorKey>([
  "blue",
  "green",
  "neutral",
  "orange",
  "pink",
  "purple",
]);

const calendarViews = new Set<TherapistCalendarView>(["day", "month", "week"]);

const attentionKinds = new Set<TherapistCalendarAttentionItem["kind"]>([
  "block_impact",
  "pending_payment",
  "reschedule",
]);

export function parseTherapistCalendarReadModel(
  value: unknown,
): TherapistCalendarReadModel {
  const row = record(value);
  const range = record(row.range);
  const summary = record(row.summary);

  return {
    anchorDate: string(row.anchorDate),
    attentionItems: array(row.attentionItems).map(parseAttention),
    blocks: array(row.blocks).map(parseBlock),
    bookings: array(row.bookings).map((item) => {
      const booking = record(item);
      return {
        ...parseSessionReadModelItem(booking),
        colorKey: color(booking.colorKey),
        therapyId: string(booking.therapyId),
        therapyName: string(booking.therapyName),
      };
    }),
    contractVersion: version(row.contractVersion),
    demand: array(row.demand).map(parseDemand),
    holds: array(row.holds).map(parseHold),
    range: {
      end: string(range.end),
      endExclusive: truth(range.endExclusive),
      localEndExclusive: string(range.localEndExclusive),
      localStart: string(range.localStart),
      start: string(range.start),
    },
    services: array(row.services).map(parseService),
    summary: {
      activeHolds: number(summary.activeHolds),
      bookings: number(summary.bookings),
      pendingAttention: number(summary.pendingAttention),
    },
    therapistProfileId: string(row.therapistProfileId),
    timezone: string(row.timezone),
    view: view(row.view),
  };
}

function parseService(value: unknown): TherapistCalendarService {
  const row = record(value);
  return {
    colorKey: color(row.colorKey),
    durationMinutes: number(row.durationMinutes),
    id: string(row.id),
    therapyId: string(row.therapyId),
    therapyName: string(row.therapyName),
    title: string(row.title),
  };
}

function parseHold(value: unknown): TherapistCalendarHold {
  const row = record(value);
  return {
    colorKey: color(row.colorKey),
    endsAt: string(row.endsAt),
    expiresAt: string(row.expiresAt),
    id: string(row.id),
    serviceId: string(row.serviceId),
    serviceTitle: string(row.serviceTitle),
    startsAt: string(row.startsAt),
  };
}

function parseBlock(value: unknown): TherapistCalendarBlock {
  const row = record(value);
  return {
    allDay: boolean(row.allDay),
    endsAt: string(row.endsAt),
    id: string(row.id),
    reason: nullableString(row.reason),
    reasonCode: nullableString(row.reasonCode),
    serviceId: nullableString(row.serviceId),
    startsAt: string(row.startsAt),
  };
}

function parseAttention(value: unknown): TherapistCalendarAttentionItem {
  const row = record(value);
  const kind = string(row.kind);
  if (!attentionKinds.has(kind as TherapistCalendarAttentionItem["kind"])) {
    throw new SessionReadModelContractError();
  }

  return {
    bookingId: string(row.booking_id ?? row.bookingId),
    description: string(row.description),
    id: string(row.id),
    kind: kind as TherapistCalendarAttentionItem["kind"],
    startsAt: string(row.starts_at ?? row.startsAt),
    title: string(row.title),
  };
}

function parseDemand(value: unknown): TherapistCalendarDemandItem {
  const row = record(value);
  return {
    count: number(row.count),
    dayOfWeek: number(row.dayOfWeek),
    hourBlock: number(row.hourBlock),
  };
}

function color(value: unknown): TherapyCalendarColorKey {
  const parsed = string(value) as TherapyCalendarColorKey;
  if (!colorKeys.has(parsed)) throw new SessionReadModelContractError();
  return parsed;
}

function view(value: unknown): TherapistCalendarView {
  const parsed = string(value) as TherapistCalendarView;
  if (!calendarViews.has(parsed)) throw new SessionReadModelContractError();
  return parsed;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SessionReadModelContractError();
  }
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new SessionReadModelContractError();
  return value;
}

function string(value: unknown): string {
  if (typeof value !== "string") throw new SessionReadModelContractError();
  return value;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return string(value);
}

function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SessionReadModelContractError();
  }
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new SessionReadModelContractError();
  return value;
}

function truth(value: unknown): true {
  if (value !== true) throw new SessionReadModelContractError();
  return true;
}

function version(value: unknown): 1 {
  if (value !== 1) throw new SessionReadModelContractError();
  return 1;
}
