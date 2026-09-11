import {
  JOURNEY_THEME_LABEL_BY_KEY,
  type JourneyThemeKey,
} from "@/features/session-feedback/session-journey-themes";
import { FulfillmentStatus, type FulfillmentStatus as FulfillmentStatusValue } from "@/domain/tes";
import { routes } from "@/lib/routes";

import type {
  JourneyClientStatus,
  JourneyHistoryClient,
  JourneyHistoryDetailData,
  JourneyHistoryPageData,
  JourneyHistoryReminder,
  JourneyHistorySource,
  JourneyHistorySummary,
  JourneyThemeCount,
} from "./therapist-journey-history.types";

export type JourneyRelationshipRow = {
  patient_profile_id: string;
  started_at: string;
  status: "active" | "closed" | "paused";
};

export type JourneyPatientRow = {
  avatar_url: string | null;
  display_name: string;
  id: string;
  timezone: string | null;
  user_id: string;
};

export type JourneyBookingRow = {
  completed_at: string | null;
  created_at: string;
  ends_at: string;
  fulfillmentStatus: FulfillmentStatusValue | null;
  id: string;
  patient_profile_id: string;
  payment_status: string;
  service_id: string;
  starts_at: string;
  status: string;
};

export type JourneyBookingBaseRow = Omit<
  JourneyBookingRow,
  "fulfillmentStatus"
>;

export type JourneyBookingFulfillmentRow = Pick<
  JourneyBookingRow,
  "fulfillmentStatus"
> & {
  bookingId: string | null;
};

export type JourneyServiceRow = {
  id: string;
  title: string;
};

export type JourneySummaryRow = {
  booking_id: string;
  created_at: string;
  patient_profile_id: string;
  summary: string | null;
  title: string | null;
  visibility: string;
};

export type JourneyThemeSelectionRow = {
  booking_id: string;
  created_at: string;
  patient_profile_id: string;
  taxonomy_version: string;
  theme_keys: string[];
};

export type JourneyHistoryRows = {
  bookings: JourneyBookingRow[];
  patients: JourneyPatientRow[];
  relationships: JourneyRelationshipRow[];
  services: JourneyServiceRow[];
  summaries: JourneySummaryRow[];
  themeSelections: JourneyThemeSelectionRow[];
};

type MappingInput = JourneyHistoryRows & {
  now?: Date;
  source: JourneyHistorySource;
  therapistProfileId: string;
};

const COMPLETED_BOOKING_STATUS = "completed";

const MEMORY_FULFILLMENT_STATUSES: ReadonlySet<FulfillmentStatusValue> = new Set([
  FulfillmentStatus.AutoConfirmed,
  FulfillmentStatus.ConfirmedBilateral,
  FulfillmentStatus.ConfirmedByPatientReview,
  FulfillmentStatus.ConfirmedByTherapist,
  FulfillmentStatus.OccurredPendingConfirmation,
]);

const RECENT_ENCOUNTER_WINDOW_DAYS = 30;

export function mapJourneyHistoryPage(
  input: MappingInput,
): JourneyHistoryPageData {
  const now = input.now ?? new Date();
  const clients = buildClients(input, now);
  const summary = buildSummary(clients);
  const reminders = buildReminders(clients, now);

  return {
    clients,
    metrics: [
      {
        description: "Total registrado na sua carteira",
        id: "total",
        label: "Pessoas acompanhadas",
        tone: "brand",
        trendLabel: "Total registrado",
        value: summary.total,
      },
      {
        description: "Sessão registrada nos últimos 30 dias",
        id: "active",
        label: "Com sessão recente",
        tone: "success",
        trendLabel: "Últimos 30 dias",
        value: summary.active,
      },
      {
        description: "Relações iniciadas neste mês",
        id: "new",
        label: "Novas este mês",
        tone: "warning",
        trendLabel: "Começaram este mês",
        value: countNewRelationships(input.relationships, now),
      },
      {
        description: "Sem sessão registrada há mais de 30 dias",
        id: "stale",
        label: "Sem sessão recente",
        tone: "danger",
        trendLabel: "Vale revisar continuidade",
        value: summary.stale,
      },
    ],
    reminders,
    segments: [],
    source: input.source,
    summary,
    therapistProfileId: input.therapistProfileId,
  };
}

export function mapJourneyHistoryDetail(
  input: MappingInput & { patientId: string },
): JourneyHistoryDetailData | null {
  const page = mapJourneyHistoryPage(input);
  const client = page.clients.find((item) => item.id === input.patientId);
  if (!client) return null;

  const serviceById = new Map(
    input.services.map((service) => [service.id, service]),
  );
  const summaryByBooking = new Map(
    input.summaries.map((summary) => [summary.booking_id, summary]),
  );
  const now = input.now ?? new Date();
  const timeline = input.bookings
    .filter(
      (booking) =>
        booking.patient_profile_id === input.patientId &&
        isMemoryEligibleBooking(booking) &&
        new Date(booking.starts_at).getTime() <= now.getTime() &&
        summaryByBooking.has(booking.id),
    )
    .sort(
      (a, b) =>
        new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
    )
    .map((booking) => {
      const service = serviceById.get(booking.service_id);
      const summary = summaryByBooking.get(booking.id)!;
      const serviceTitle = service?.title ?? "Sessão TES";
      return {
        bookingId: booking.id,
        date: booking.starts_at,
        description: summary.summary ?? "Sem detalhes adicionais.",
        href: routes.therapist.sessionDetail(booking.id),
        id: booking.id,
        status: booking.status,
        serviceTitle,
        title: summary.title ?? "Resumo compartilhado",
        topicLabels: [],
      };
    });

  const completedBookingIds = new Set(
    input.bookings
      .filter(
        (booking) =>
          booking.patient_profile_id === input.patientId &&
          isMemoryEligibleBooking(booking) &&
          new Date(booking.starts_at).getTime() <= now.getTime(),
      )
      .map((booking) => booking.id),
  );
  const topicCounts = buildTopicCounts(
    input.themeSelections.filter(
      (selection) =>
        selection.patient_profile_id === input.patientId &&
        completedBookingIds.has(selection.booking_id),
    ),
  );

  return {
    client,
    source: page.source,
    therapistProfileId: page.therapistProfileId,
    timeline,
    topicCounts,
  };
}

function buildClients(input: MappingInput, now: Date): JourneyHistoryClient[] {
  const patientById = new Map(
    input.patients.map((patient) => [patient.id, patient]),
  );
  const relationshipByPatient = new Map(
    input.relationships.map((relationship) => [
      relationship.patient_profile_id,
      relationship,
    ]),
  );
  const serviceById = new Map(
    input.services.map((service) => [service.id, service]),
  );
  const patientIds = [
    ...new Set([
      ...input.relationships.map(
        (relationship) => relationship.patient_profile_id,
      ),
      ...input.bookings.map((booking) => booking.patient_profile_id),
    ]),
  ];

  return patientIds
    .map((patientId) => {
      const patient = patientById.get(patientId);
      if (!patient) return null;

      const bookings = input.bookings
        .filter((booking) => booking.patient_profile_id === patientId)
        .sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        );
      const realizedOrAwaitingConfirmationBookings = bookings.filter(
        isMemoryEligibleBooking,
      );
      const realizedOrAwaitingConfirmationPastBookings =
        realizedOrAwaitingConfirmationBookings.filter(
        (booking) => new Date(booking.starts_at).getTime() <= now.getTime(),
        );
      const futureBookings = bookings.filter(
        (booking) =>
          booking.status === "confirmed" &&
          new Date(booking.starts_at).getTime() > now.getTime(),
      );
      const lastSession = realizedOrAwaitingConfirmationPastBookings.at(-1) ?? null;
      const nextSession = futureBookings.at(0) ?? null;
      const relationship = relationshipByPatient.get(patientId);
      const totalSharedMemories =
        realizedOrAwaitingConfirmationPastBookings.filter((booking) =>
          input.summaries.some((summary) => summary.booking_id === booking.id),
        ).length;
      const therapyLabels = unique(
        bookings
          .map((booking) => serviceById.get(booking.service_id)?.title)
          .filter(isPresent),
      ).slice(0, 3);
      return {
        avatarUrl: patient.avatar_url,
        emailLabel: patient.timezone ?? "Cliente TES",
        firstSessionAt:
          realizedOrAwaitingConfirmationPastBookings[0]?.starts_at ?? null,
        id: patient.id,
        lastSessionAt: lastSession?.starts_at ?? null,
        lastSessionServiceTitle: lastSession
          ? (serviceById.get(lastSession.service_id)?.title ?? "Sessão TES")
          : null,
        name: patient.display_name,
        nextSessionAt: nextSession?.starts_at ?? null,
        nextSessionServiceTitle: nextSession
          ? (serviceById.get(nextSession.service_id)?.title ?? "Sessão TES")
          : null,
        sessionsHref: `${routes.therapist.sessions}?patient=${patient.id}`,
        status: getClientStatus(
          relationship?.status,
          lastSession?.starts_at,
          now,
        ),
        therapyLabels: therapyLabels.length ? therapyLabels : ["Jornada TES"],
        timelineHref: routes.therapist.patientJourney(patient.id),
        totalEncounters: realizedOrAwaitingConfirmationPastBookings.length,
        totalSharedMemories,
        topicLabels: [],
      };
    })
    .filter(isPresent)
    .sort((a, b) => {
      const nextA = a.lastSessionAt ? new Date(a.lastSessionAt).getTime() : 0;
      const nextB = b.lastSessionAt ? new Date(b.lastSessionAt).getTime() : 0;
      return nextB - nextA || a.name.localeCompare(b.name, "pt-BR");
    });
}

function isMemoryEligibleBooking(booking: JourneyBookingRow) {
  return (
    (booking.fulfillmentStatus !== null &&
      MEMORY_FULFILLMENT_STATUSES.has(booking.fulfillmentStatus)) ||
    (booking.fulfillmentStatus === null &&
      booking.status === COMPLETED_BOOKING_STATUS)
  );
}

function buildTopicCounts(
  selections: JourneyThemeSelectionRow[],
): JourneyThemeCount[] {
  const counts = new Map<JourneyThemeKey, number>();

  selections.forEach((selection) => {
    selection.theme_keys.forEach((key) => {
      const themeKey = key as JourneyThemeKey;
      if (!JOURNEY_THEME_LABEL_BY_KEY.has(themeKey)) return;
      counts.set(themeKey, (counts.get(themeKey) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .map(([key, count]) => ({
      count,
      key,
      label: JOURNEY_THEME_LABEL_BY_KEY.get(key)!,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}

function getClientStatus(
  relationshipStatus: JourneyRelationshipRow["status"] | undefined,
  lastSessionAt: string | undefined,
  now: Date,
): JourneyClientStatus {
  if (relationshipStatus === "paused" || relationshipStatus === "closed") {
    return "paused";
  }
  if (!lastSessionAt) return "stale";

  const daysSinceLast = Math.floor(
    (now.getTime() - new Date(lastSessionAt).getTime()) / 86_400_000,
  );

  return daysSinceLast > RECENT_ENCOUNTER_WINDOW_DAYS ? "stale" : "active";
}

function buildSummary(clients: JourneyHistoryClient[]): JourneyHistorySummary {
  return {
    active: clients.filter((client) => client.status === "active").length,
    paused: clients.filter((client) => client.status === "paused").length,
    stale: clients.filter((client) => client.status === "stale").length,
    total: clients.length,
  };
}

function buildReminders(
  clients: JourneyHistoryClient[],
  now: Date,
): JourneyHistoryReminder[] {
  const withoutReturn = clients.filter((client) => client.status === "stale");
  const upcoming = clients.filter((client) => {
    if (!client.nextSessionAt) return false;
    const days = Math.ceil(
      (new Date(client.nextSessionAt).getTime() - now.getTime()) / 86_400_000,
    );
    return days >= 0 && days <= 7;
  });
  const noSummaries = clients.filter((client) => client.totalEncounters === 0);

  const reminders: JourneyHistoryReminder[] = [
    {
      count: upcoming.length,
      description: "Acompanhar confirmação da sessão",
      href: routes.therapist.agenda,
      id: "upcoming",
      label: "clientes agendados",
      tone: "brand",
    },
    {
      count: withoutReturn.length,
      description: "Sem sessão há mais de 30 dias",
      href: routes.therapist.messages,
      id: "stale",
      label: "clientes sem retorno",
      tone: "warning",
    },
    {
      count: noSummaries.length,
      description: "Sem sessões concluídas registradas",
      href: routes.therapist.sessions,
      id: "new",
      label: "jornadas em inicio",
      tone: "danger",
    },
  ];

  return reminders.filter((reminder) => reminder.count > 0);
}

function countNewRelationships(
  relationships: JourneyRelationshipRow[],
  now: Date,
) {
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return relationships.filter(
    (relationship) =>
      new Date(relationship.started_at).getTime() >= monthStart.getTime(),
  ).length;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
