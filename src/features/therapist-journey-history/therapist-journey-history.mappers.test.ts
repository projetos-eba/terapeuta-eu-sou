import { describe, expect, it } from "vitest";

import { filterJourneyClients } from "./therapist-journey-history-page";
import {
  mapJourneyHistoryDetail,
  mapJourneyHistoryPage,
  type JourneyHistoryRows,
} from "./therapist-journey-history.mappers";

const now = new Date("2026-07-27T12:00:00-03:00");

describe("therapist journey history", () => {
  it("maps relationships, sessions and summaries into portfolio rows", () => {
    const data = mapJourneyHistoryPage({
      ...createRows(),
      now,
      source: "supabase",
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    });

    expect(data.summary).toEqual({
      active: 1,
      paused: 1,
      stale: 1,
      total: 3,
    });
    expect(data.metrics.find((metric) => metric.id === "new")?.value).toBe(2);
    expect(data.clients[0].name).toBe("Ana Lima");
    expect(data.clients[0].topicLabels).toContain("Autoconhecimento");
    expect(data.segments.some((segment) => segment.label === "Ansiedade")).toBe(
      true,
    );
  });

  it("filters by query, status, segment and sort", () => {
    const data = mapJourneyHistoryPage({
      ...createRows(),
      now,
      source: "supabase",
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    });

    const filtered = filterJourneyClients(data.clients, {
      q: "reiki",
      segment: "Autoconhecimento",
      sort: "sessions",
      status: "active",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Ana Lima");
  });

  it("maps detail timeline for one related client", () => {
    const detail = mapJourneyHistoryDetail({
      ...createRows(),
      now,
      patientId: "b1000000-0000-4000-8000-000000000001",
      source: "supabase",
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    });

    expect(detail?.client.name).toBe("Ana Lima");
    expect(detail?.timeline.some((item) => item.title === "Clareza")).toBe(
      true,
    );
    expect(detail?.timeline[0]).toMatchObject({
      serviceTitle: "Reiki",
      topicLabels: ["Espiritualidade"],
    });
    expect(detail?.client.nextSessionServiceTitle).toBe("Reiki");
    expect(detail?.client.lastSessionServiceTitle).toBe("Reiki");
    expect(detail?.timeline[0].href).toContain("/terapeuta/sessoes/");
  });
});

function createRows(): JourneyHistoryRows {
  return {
    bookings: [
      {
        completed_at: "2026-07-20T15:00:00-03:00",
        created_at: "2026-07-10T09:00:00-03:00",
        ends_at: "2026-07-20T15:00:00-03:00",
        id: "f2000000-0000-4000-8000-000000000001",
        patient_profile_id: "b1000000-0000-4000-8000-000000000001",
        payment_status: "paid",
        service_id: "s1000000-0000-4000-8000-000000000001",
        starts_at: "2026-07-20T14:00:00-03:00",
        status: "completed",
      },
      {
        completed_at: null,
        created_at: "2026-07-20T09:00:00-03:00",
        ends_at: "2026-08-03T15:00:00-03:00",
        id: "f2000000-0000-4000-8000-000000000002",
        patient_profile_id: "b1000000-0000-4000-8000-000000000001",
        payment_status: "paid",
        service_id: "s1000000-0000-4000-8000-000000000001",
        starts_at: "2026-08-03T14:00:00-03:00",
        status: "confirmed",
      },
      {
        completed_at: "2026-04-01T11:00:00-03:00",
        created_at: "2026-03-25T09:00:00-03:00",
        ends_at: "2026-04-01T11:00:00-03:00",
        id: "f2000000-0000-4000-8000-000000000003",
        patient_profile_id: "b1000000-0000-4000-8000-000000000002",
        payment_status: "paid",
        service_id: "s1000000-0000-4000-8000-000000000002",
        starts_at: "2026-04-01T10:00:00-03:00",
        status: "completed",
      },
      {
        completed_at: "2026-07-14T11:00:00-03:00",
        created_at: "2026-07-01T09:00:00-03:00",
        ends_at: "2026-07-14T11:00:00-03:00",
        id: "f2000000-0000-4000-8000-000000000004",
        patient_profile_id: "b1000000-0000-4000-8000-000000000003",
        payment_status: "paid",
        service_id: "s1000000-0000-4000-8000-000000000003",
        starts_at: "2026-07-14T10:00:00-03:00",
        status: "completed",
      },
    ],
    patients: [
      {
        avatar_url: null,
        display_name: "Ana Lima",
        id: "b1000000-0000-4000-8000-000000000001",
        timezone: "America/Sao_Paulo",
        user_id: "p1000000-0000-4000-8000-000000000001",
      },
      {
        avatar_url: null,
        display_name: "Bruno Costa",
        id: "b1000000-0000-4000-8000-000000000002",
        timezone: "America/Sao_Paulo",
        user_id: "p1000000-0000-4000-8000-000000000002",
      },
      {
        avatar_url: null,
        display_name: "Clara Vaz",
        id: "b1000000-0000-4000-8000-000000000003",
        timezone: "America/Sao_Paulo",
        user_id: "p1000000-0000-4000-8000-000000000003",
      },
    ],
    relationships: [
      {
        patient_profile_id: "b1000000-0000-4000-8000-000000000001",
        started_at: "2026-07-15T10:00:00-03:00",
        status: "active",
      },
      {
        patient_profile_id: "b1000000-0000-4000-8000-000000000002",
        started_at: "2026-03-20T10:00:00-03:00",
        status: "active",
      },
      {
        patient_profile_id: "b1000000-0000-4000-8000-000000000003",
        started_at: "2026-07-01T10:00:00-03:00",
        status: "paused",
      },
    ],
    services: [
      { id: "s1000000-0000-4000-8000-000000000001", title: "Reiki" },
      { id: "s1000000-0000-4000-8000-000000000002", title: "Mindfulness" },
      { id: "s1000000-0000-4000-8000-000000000003", title: "Aromaterapia" },
    ],
    summaries: [
      {
        booking_id: "f2000000-0000-4000-8000-000000000001",
        created_at: "2026-07-20T15:10:00-03:00",
        patient_profile_id: "b1000000-0000-4000-8000-000000000001",
        summary: "Resumo de autoconhecimento e clareza.",
        title: "Clareza",
        visibility: "patient",
      },
      {
        booking_id: "f2000000-0000-4000-8000-000000000003",
        created_at: "2026-04-01T11:10:00-03:00",
        patient_profile_id: "b1000000-0000-4000-8000-000000000002",
        summary: "Pratica de calma para ansiedade.",
        title: "Pausa",
        visibility: "patient",
      },
    ],
  };
}
