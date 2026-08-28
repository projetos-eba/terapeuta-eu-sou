import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  PatientEncounter,
  PatientEncountersPagination,
} from "../patient-encounters.types";
import { EncounterHistorySection } from "./encounter-history-section";

afterEach(cleanup);

describe("EncounterHistorySection", () => {
  it("keeps the scroll region and exposes pagination outside it", () => {
    const encounters = Array.from({ length: 10 }, (_, index) =>
      createEncounter(`encounter-${index + 1}`),
    );

    render(
      <EncounterHistorySection
        encounters={encounters}
        pagination={pagination({
          hasNext: true,
          page: 1,
          total: 12,
          totalPages: 2,
        })}
      />,
    );

    const scrollRegion = screen.getByTestId("patient-history-scroll");
    const paginationNav = screen.getByRole("navigation", {
      name: "Paginação do histórico de encontros",
    });

    expect(scrollRegion).toHaveClass(
      "max-h-[760px]",
      "overflow-y-auto",
      "overscroll-contain",
    );
    expect(scrollRegion).not.toContainElement(paginationNav);
    expect(paginationNav).toHaveTextContent("1–10 de 12 encontros");
    expect(
      screen.getByRole("link", { name: "Próxima página do histórico" }),
    ).toHaveAttribute(
      "href",
      "/app/encontros?historyPage=2#patient-history-encounters-title",
    );
  });

  it("links back to the first page and disables the next action on the last page", () => {
    render(
      <EncounterHistorySection
        encounters={[
          createEncounter("encounter-11"),
          createEncounter("encounter-12"),
        ]}
        pagination={pagination({ page: 2, total: 12, totalPages: 2 })}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Página anterior do histórico" }),
    ).toHaveAttribute(
      "href",
      "/app/encontros#patient-history-encounters-title",
    );
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getByText("Próxima", { selector: "span" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

function pagination(
  overrides: Partial<PatientEncountersPagination>,
): PatientEncountersPagination {
  return {
    hasNext: false,
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    ...overrides,
  };
}

function createEncounter(id: string): PatientEncounter {
  return {
    approachLabel: "Abordagem energética",
    dateLabel: "Hoje",
    endsAt: "2026-08-14T12:00:00.000Z",
    id,
    meetingUrl: null,
    paymentStatus: "paid",
    primaryAction: {
      href: `/app/encontros/${id}`,
      kind: "link",
      label: "Ver detalhes",
    },
    rescheduleStatus: null,
    scheduleLabel: "14 ago · 08h",
    serviceLabel: "Reiki",
    startsAt: "2026-08-14T11:00:00.000Z",
    status: "completed",
    statusLabel: "Já realizada",
    summaryId: null,
    therapist: {
      avatarUrl: null,
      id: "therapist-1",
      name: "Ana Oliveira",
    },
    therapyLabel: "Reiki",
    timezone: "America/Sao_Paulo",
  };
}
