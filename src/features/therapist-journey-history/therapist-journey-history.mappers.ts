import { routes } from "@/lib/routes";

import type {
  JourneyClientStatus,
  JourneyHistoryClient,
  JourneyHistoryDetailData,
  JourneyHistoryPageData,
  JourneyHistoryReminder,
  JourneyHistorySegment,
  JourneyHistorySource,
  JourneyHistorySummary,
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
  id: string;
  patient_profile_id: string;
  payment_status: string;
  service_id: string;
  starts_at: string;
  status: string;
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

export type JourneyHistoryRows = {
  bookings: JourneyBookingRow[];
  patients: JourneyPatientRow[];
  relationships: JourneyRelationshipRow[];
  services: JourneyServiceRow[];
  summaries: JourneySummaryRow[];
};

type MappingInput = JourneyHistoryRows & {
  now?: Date;
  source: JourneyHistorySource;
  therapistProfileId: string;
};

const ACTIVE_BOOKING_STATUSES = new Set([
  "confirmed",
  "completed",
  "no_show_patient",
  "no_show_therapist",
]);

const COMPLETED_BOOKING_STATUSES = new Set([
  "completed",
  "no_show_patient",
  "no_show_therapist",
]);

const TOPIC_RULES: Array<{ label: string; pattern: RegExp; tone: JourneyHistorySegment["tone"] }> =
  [
    { label: "Ansiedade", pattern: /ansiedade|calma|respira/i, tone: "brand" },
    { label: "Autoestima", pattern: /autoestima|confian/i, tone: "danger" },
    {
      label: "Autoconhecimento",
      pattern: /autoconhecimento|clareza|percep/i,
      tone: "brand",
    },
    {
      label: "Relacionamentos",
      pattern: /relacionamento|v[ií]nculo|famil/i,
      tone: "danger",
    },
    { label: "Família", pattern: /fam[ií]lia|familiar/i, tone: "success" },
    { label: "Carreira", pattern: /carreira|profissional/i, tone: "info" },
    {
      label: "Espiritualidade",
      pattern: /espiritual|energia|reiki/i,
      tone: "brand",
    },
    { label: "Propósito", pattern: /prop[oó]sito|dire[cç][aã]o/i, tone: "brand" },
  ];

export function mapJourneyHistoryPage(
  input: MappingInput,
): JourneyHistoryPageData {
  const now = input.now ?? new Date();
  const clients = buildClients(input, now);
  const summary = buildSummary(clients);
  const segments = buildSegments(clients);
  const reminders = buildReminders(clients, now);

  return {
    clients,
    metrics: [
      {
        description: "Todas as pessoas registradas",
        id: "total",
        label: "Pessoas acompanhadas",
        tone: "brand",
        trendLabel: "visão atual",
        value: summary.total,
      },
      {
        description: "Com retorno nos últimos 30 dias",
        id: "active",
        label: "Em acompanhamento",
        tone: "success",
        trendLabel: "com retorno recente",
        value: summary.active,
      },
      {
        description: "Relações iniciadas neste mês",
        id: "new",
        label: "Novas pessoas",
        tone: "warning",
        trendLabel: "relações iniciadas",
        value: countNewRelationships(input.relationships, now),
      },
      {
        description: "Há mais de 60 dias",
        id: "stale",
        label: "Sem encontro recente",
        tone: "danger",
        trendLabel: "precisam de revisão",
        value: summary.stale,
      },
    ],
    reminders,
    segments,
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

  const serviceById = new Map(input.services.map((service) => [service.id, service]));
  const summaryByBooking = new Map(
    input.summaries.map((summary) => [summary.booking_id, summary]),
  );
  const timeline = input.bookings
    .filter((booking) => booking.patient_profile_id === input.patientId)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
    .map((booking) => {
      const service = serviceById.get(booking.service_id);
      const summary = summaryByBooking.get(booking.id);
      const serviceTitle = service?.title ?? "Sessão TES";
      const topicLabels = inferTopics([
        serviceTitle,
        summary?.title ?? "",
        summary?.summary ?? "",
      ]);

      return {
        bookingId: booking.id,
        date: booking.starts_at,
        description:
          summary?.summary ??
          "Sessão registrada sem resumo compartilhado nesta superfície.",
        href: routes.therapist.sessionDetail(booking.id),
        id: booking.id,
        status: booking.status,
        serviceTitle,
        title: summary?.title ?? serviceTitle,
        topicLabels: topicLabels.length ? topicLabels : ["Continuidade"],
      };
    });

  return {
    client,
    source: page.source,
    therapistProfileId: page.therapistProfileId,
    timeline,
  };
}

function buildClients(input: MappingInput, now: Date): JourneyHistoryClient[] {
  const patientById = new Map(input.patients.map((patient) => [patient.id, patient]));
  const relationshipByPatient = new Map(
    input.relationships.map((relationship) => [
      relationship.patient_profile_id,
      relationship,
    ]),
  );
  const serviceById = new Map(input.services.map((service) => [service.id, service]));
  const summariesByPatient = groupBy(input.summaries, "patient_profile_id");
  const patientIds = [
    ...new Set([
      ...input.relationships.map((relationship) => relationship.patient_profile_id),
      ...input.bookings.map((booking) => booking.patient_profile_id),
    ]),
  ];

  return patientIds
    .map((patientId) => {
      const patient = patientById.get(patientId);
      if (!patient) return null;

      const bookings = input.bookings
        .filter((booking) => booking.patient_profile_id === patientId)
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      const countedBookings = bookings.filter((booking) =>
        ACTIVE_BOOKING_STATUSES.has(booking.status),
      );
      const pastBookings = countedBookings.filter(
        (booking) => new Date(booking.starts_at).getTime() <= now.getTime(),
      );
      const futureBookings = bookings.filter(
        (booking) =>
          booking.status === "confirmed" &&
          new Date(booking.starts_at).getTime() > now.getTime(),
      );
      const lastSession = pastBookings.at(-1) ?? null;
      const nextSession = futureBookings.at(0) ?? null;
      const relationship = relationshipByPatient.get(patientId);
      const therapyLabels = unique(
        bookings
          .map((booking) => serviceById.get(booking.service_id)?.title)
          .filter(isPresent),
      ).slice(0, 3);
      const topicLabels = inferTopics([
        ...therapyLabels,
        ...(summariesByPatient.get(patientId) ?? []).flatMap((summary) => [
          summary.title ?? "",
          summary.summary ?? "",
        ]),
      ]);

      return {
        avatarUrl: patient.avatar_url,
        emailLabel: patient.timezone ?? "Cliente TES",
        firstSessionAt: countedBookings[0]?.starts_at ?? relationship?.started_at ?? null,
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
        status: getClientStatus(relationship?.status, lastSession?.starts_at, now),
        therapyLabels: therapyLabels.length ? therapyLabels : ["Jornada TES"],
        timelineHref: routes.therapist.patientJourney(patient.id),
        totalEncounters: countedBookings.filter((booking) =>
          COMPLETED_BOOKING_STATUSES.has(booking.status),
        ).length,
        topicLabels: topicLabels.length ? topicLabels : ["Continuidade"],
      };
    })
    .filter(isPresent)
    .sort((a, b) => {
      const nextA = a.lastSessionAt ? new Date(a.lastSessionAt).getTime() : 0;
      const nextB = b.lastSessionAt ? new Date(b.lastSessionAt).getTime() : 0;
      return nextB - nextA || a.name.localeCompare(b.name, "pt-BR");
    });
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

  return daysSinceLast > 60 ? "stale" : "active";
}

function buildSummary(clients: JourneyHistoryClient[]): JourneyHistorySummary {
  return {
    active: clients.filter((client) => client.status === "active").length,
    paused: clients.filter((client) => client.status === "paused").length,
    stale: clients.filter((client) => client.status === "stale").length,
    total: clients.length,
  };
}

function buildSegments(clients: JourneyHistoryClient[]): JourneyHistorySegment[] {
  const counts = new Map<string, number>();
  for (const client of clients) {
    for (const topic of client.topicLabels) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, 6)
    .map(([label, count], index) => ({
      count,
      id: slug(label),
      label,
      tone: TOPIC_RULES.find((rule) => rule.label === label)?.tone ?? segmentTone(index),
    }));
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
        description: "Acompanhar confirmação do encontro",
      href: routes.therapist.agenda,
      id: "upcoming",
      label: "clientes agendados",
      tone: "brand",
    },
    {
      count: withoutReturn.length,
      description: "Sem sessão há mais de 60 dias",
      href: routes.therapist.messages,
      id: "stale",
      label: "clientes sem retorno",
      tone: "warning",
    },
    {
      count: noSummaries.length,
      description: "Sem encontros concluídos registrados",
      href: routes.therapist.sessions,
      id: "new",
      label: "jornadas em inicio",
      tone: "danger",
    },
  ];

  return reminders.filter((reminder) => reminder.count > 0);
}

function countNewRelationships(relationships: JourneyRelationshipRow[], now: Date) {
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return relationships.filter(
    (relationship) => new Date(relationship.started_at).getTime() >= monthStart.getTime(),
  ).length;
}

function inferTopics(values: string[]) {
  const text = values.join(" ");
  const matched = TOPIC_RULES.filter((rule) => rule.pattern.test(text)).map(
    (rule) => rule.label,
  );

  return unique(matched).slice(0, 3);
}

function segmentTone(index: number): JourneyHistorySegment["tone"] {
  return ["brand", "danger", "success", "info", "warning"][index % 5] as JourneyHistorySegment["tone"];
}

function groupBy<T extends Record<K, string>, K extends keyof T>(
  rows: T[],
  key: K,
) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const id = row[key];
    grouped.set(id, [...(grouped.get(id) ?? []), row]);
  }
  return grouped;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
