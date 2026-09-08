import type { SessionReadModelItem } from "@/features/bookings";

export type TherapyCalendarColorKey =
  | "blue"
  | "green"
  | "neutral"
  | "orange"
  | "pink"
  | "purple";

export type TherapistCalendarView = "day" | "month" | "week";

export type TherapistCalendarService = {
  colorKey: TherapyCalendarColorKey;
  durationMinutes: number;
  id: string;
  therapyId: string;
  therapyName: string;
  title: string;
};

export type TherapistCalendarBooking = SessionReadModelItem & {
  colorKey: TherapyCalendarColorKey;
  therapyId: string;
  therapyName: string;
};

export type TherapistCalendarHold = {
  colorKey: TherapyCalendarColorKey;
  endsAt: string;
  expiresAt: string;
  id: string;
  serviceId: string;
  serviceTitle: string;
  startsAt: string;
};

export type TherapistCalendarBlock = {
  allDay: boolean;
  endsAt: string;
  id: string;
  reason: string | null;
  reasonCode: string | null;
  serviceId: string | null;
  startsAt: string;
};

export type TherapistCalendarAttentionItem = {
  bookingId: string;
  description: string;
  id: string;
  kind: "reschedule";
  startsAt: string;
  title: string;
};

export type TherapistCalendarDemandItem = {
  count: number;
  dayOfWeek: number;
  hourBlock: number;
};

export type TherapistCalendarReadModel = {
  anchorDate: string;
  attentionItems: TherapistCalendarAttentionItem[];
  blocks: TherapistCalendarBlock[];
  bookings: TherapistCalendarBooking[];
  contractVersion: 1;
  demand: TherapistCalendarDemandItem[];
  holds: TherapistCalendarHold[];
  range: {
    end: string;
    endExclusive: true;
    localEndExclusive: string;
    localStart: string;
    start: string;
  };
  services: TherapistCalendarService[];
  summary: {
    activeHolds: number;
    bookings: number;
    pendingAttention: number;
  };
  therapistProfileId: string;
  timezone: string;
  view: TherapistCalendarView;
};
