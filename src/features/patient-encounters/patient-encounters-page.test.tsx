import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PatientEncountersPage } from "./patient-encounters-page";
import type {
  PatientEncounter,
  PatientEncountersPageData,
} from "./patient-encounters.types";

describe("PatientEncountersPage", () => {
  it("prioritizes the next encounter without rendering dashboard metrics", () => {
    const next = createEncounter({
      id: "encounter-next",
      primaryAction: {
        href: "/app/encontros/encounter-next",
        kind: "link",
        label: "Ver detalhes",
      },
    });
    const following = createEncounter({
      dateLabel: "Sexta",
      id: "encounter-following",
      therapist: {
        avatarUrl: null,
        id: "therapist-2",
        name: "Sofia Mendes",
      },
    });
    const html = renderToStaticMarkup(
      <PatientEncountersPage
        data={createPageData({
          nextEncounter: next,
          upcomingEncounters: [next, following],
        })}
      />,
    );

    expect(html).toContain("Próximo encontro");
    expect(html).toContain("Seu espaço de acompanhamento");
    expect(html).toContain(
      "Tudo o que faz parte da sua jornada reunido em um único lugar.",
    );
    expect(html).toContain("hero-acompanhamento.png");
    expect(html).toContain("Próximos encontros");
    expect(html).toContain("Histórico de encontros");
    expect(html).toContain("Sofia Mendes");
    expect(html.match(/Ana Oliveira/g)).toHaveLength(1);
    expect(html).not.toContain("Sua jornada");
    expect(html).not.toContain("Favoritos");
    expect(html).not.toContain("validações autoritativas");
  });

  it("guides an empty state to Match and therapist discovery", () => {
    const html = renderToStaticMarkup(
      <PatientEncountersPage
        data={createPageData({
          nextEncounter: null,
          upcomingEncounters: [],
        })}
      />,
    );

    expect(html).toContain("Você ainda não tem encontros agendados");
    expect(html).toContain("Fazer meu Match TES");
    expect(html).toContain("Explorar terapeutas");
    expect(html).not.toContain("sessão");
  });

  it.each([
    {
      action: "Entrar no encontro",
      eyebrow: "Entrada disponível",
      status: "live" as const,
    },
    {
      action: "Ver pagamento",
      eyebrow: "Atenção necessária",
      status: "pending_payment" as const,
    },
    {
      action: "Acompanhar reagendamento",
      eyebrow: "Reagendamento",
      status: "reschedule_requested" as const,
    },
  ])("renders the $status state with its authorized action", (state) => {
    const encounter = createEncounter({
      primaryAction: {
        href: "/app/encontros/encounter-1",
        kind: "link",
        label: state.action,
      },
      status: state.status,
      statusLabel: state.eyebrow,
    });
    const html = renderToStaticMarkup(
      <PatientEncountersPage
        data={createPageData({
          nextEncounter: encounter,
          upcomingEncounters: [encounter],
        })}
      />,
    );

    expect(html).toContain(state.eyebrow);
    expect(html).toContain(state.action);
    expect(html).not.toContain("meeting_url");
  });
});

function createPageData(
  overrides: Partial<PatientEncountersPageData> = {},
): PatientEncountersPageData {
  return {
    favoriteTherapistsCount: 0,
    historyEncounters: [],
    metrics: {
      activeCount: 1,
      completedCount: 0,
      favoriteTherapistsCount: 0,
    },
    nextEncounter: null,
    patient: {
      avatarUrl: null,
      id: "patient-user",
      name: "Carlos",
      patientProfileId: "patient-profile",
    },
    recentJourneyTopics: [],
    source: "supabase",
    unreadMessagesCount: 0,
    unreadNotificationsCount: 0,
    upcomingEncounters: [],
    ...overrides,
  };
}

function createEncounter(
  overrides: Partial<PatientEncounter> = {},
): PatientEncounter {
  return {
    approachLabel: "Abordagem energética",
    dateLabel: "Hoje",
    endsAt: "2026-08-14T12:00:00.000Z",
    id: "encounter-1",
    meetingUrl: null,
    paymentStatus: "paid",
    primaryAction: {
      href: "/app/encontros/encounter-1",
      kind: "link",
      label: "Ver detalhes",
    },
    rescheduleStatus: null,
    scheduleLabel: "14 ago · 08h",
    serviceLabel: "Reiki",
    startsAt: "2026-08-14T11:00:00.000Z",
    status: "confirmed",
    statusLabel: "Confirmada",
    summaryId: null,
    therapist: {
      avatarUrl: null,
      id: "therapist-1",
      name: "Ana Oliveira",
    },
    therapyLabel: "Reiki",
    ...overrides,
  };
}
