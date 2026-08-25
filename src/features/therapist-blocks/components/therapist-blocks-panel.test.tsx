import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  TherapistBlocksReadModel,
  TherapistScheduleService,
} from "@/domain/tes";

const navigationMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: navigationMocks.refresh,
    replace: navigationMocks.replace,
  }),
  useSearchParams: () => new URLSearchParams("aba=bloqueios"),
}));

import { TherapistBlocksPanel } from "./therapist-blocks-panel";

describe("TherapistBlocksPanel", () => {
  beforeEach(() => {
    navigationMocks.refresh.mockReset();
    navigationMocks.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders summary, recurrence and explicit booking impact review", () => {
    renderPanel();

    expect(
      screen.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Séries recorrentes")).toBeInTheDocument();
    expect(screen.getByText("Recorrente semanal")).toBeInTheDocument();
    expect(screen.getByText("Marina Souza · Reiki online")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manter sessão" })).toBeVisible();
    expect(
      screen.queryByText("Reagendar automaticamente"),
    ).not.toBeInTheDocument();
  });

  it("creates a recurring partial block with the canonical timezone", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            idempotentReplay: false,
            impactedBookingCount: 0,
            occurrenceCount: 4,
            scheduleVersion: 3,
          },
          ok: true,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Novo bloqueio" }));
    expect(screen.getByTestId("tes-dialog-overlay")).toBeVisible();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByLabelText("Bloquear o dia inteiro"));
    fireEvent.change(screen.getByLabelText("Repetição"), {
      target: { value: "weekly" },
    });
    fireEvent.change(screen.getByLabelText("Repetir até"), {
      target: { value: oneWeekFromToday() },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar bloqueio" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body)) as {
      action: string;
      allDay: boolean;
      recurrenceFrequency: string;
      timezone: string;
    };
    expect(payload).toMatchObject({
      action: "create",
      allDay: false,
      recurrenceFrequency: "weekly",
      timezone: "America/Sao_Paulo",
    });
    expect(navigationMocks.refresh).toHaveBeenCalledOnce();
  });

  it("opens a prominent alert with the real paid booking details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            idempotentReplay: false,
            impactedBookingCount: 1,
            occurrenceCount: 1,
            paidImpactedBookings: [
              {
                bookingId: "f2000000-0000-4000-8000-000000000004",
                endsAt: "2026-07-30T16:00:00.000Z",
                patientName: "Marina Souza",
                serviceTitle: "Reiki online",
                startsAt: "2026-07-30T15:00:00.000Z",
                timezone: "America/Sao_Paulo",
              },
            ],
          },
          ok: true,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Novo bloqueio" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar bloqueio" }));

    await waitFor(() =>
      expect(
        screen.getByRole("dialog", {
          name: "Atenção: há sessões pagas neste horário",
        }),
      ).toBeVisible(),
    );
    expect(screen.getByText("Marina Souza")).toBeInTheDocument();
    expect(screen.getByText("Reiki online")).toBeInTheDocument();
  });

  it("cancels a series with optimistic schedule version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            cancelledCount: 3,
            idempotentReplay: false,
            scheduleVersion: 3,
          },
          ok: true,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Remover bloqueio/ }));
    fireEvent.click(screen.getByLabelText("Toda a série recorrente"));
    fireEvent.click(screen.getByRole("button", { name: "Remover bloqueio" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      action: "cancel",
      expectedScheduleVersion: 2,
      scope: "series",
    });
  });

  it("keeps an impacted booking without changing the booking itself", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            idempotentReplay: false,
            resolution: "keep_booking",
            status: "resolved",
          },
          ok: true,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Manter sessão" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      action: "resolve_impact",
      impactId: impactId,
      resolution: "keep_booking",
    });
  });
});

const blockId = "a4100000-0000-4000-8000-000000000001";
const impactId = "a4200000-0000-4000-8000-000000000001";

function oneWeekFromToday() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function renderPanel() {
  return render(
    <TherapistBlocksPanel
      initialData={blocksFixture()}
      services={servicesFixture()}
    />,
  );
}

function blocksFixture(): TherapistBlocksReadModel {
  return {
    blocks: [
      {
        allDay: false,
        createdAt: "2026-07-26T12:00:00.000Z",
        endsAt: "2026-07-30T17:00:00.000Z",
        id: blockId,
        impactedBookings: [
          {
            bookingId: "f2000000-0000-4000-8000-000000000004",
            impactId,
            patientName: "Marina Souza",
            resolution: null,
            serviceTitle: "Reiki online",
            startsAt: "2026-07-30T15:30:00.000Z",
            status: "pending",
          },
        ],
        reason: "Formação profissional",
        reasonCode: "training",
        recurrenceEndsOn: "2026-08-13",
        recurrenceFrequency: "weekly",
        seriesId: "a4000000-0000-4000-8000-000000000001",
        serviceId: "d1000000-0000-4000-8000-000000000001",
        serviceTitle: "Reiki online",
        startsAt: "2026-07-30T15:00:00.000Z",
        status: "active",
        timezone: "America/Sao_Paulo",
        version: 1,
      },
    ],
    contractVersion: 1,
    nextCursor: null,
    scheduleVersion: 2,
    summary: {
      activeBlocks: 1,
      pendingImpacts: 1,
      recurringSeries: 1,
    },
    therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    timezone: "America/Sao_Paulo",
  };
}

function servicesFixture(): TherapistScheduleService[] {
  return [
    {
      durationMinutes: 50,
      id: "d1000000-0000-4000-8000-000000000001",
      settings: {
        bookingHorizonDays: 30,
        bufferAfterMinutes: 10,
        bufferBeforeMinutes: 10,
        minimumNoticeMinutes: 120,
        slotStepMinutes: 30,
      },
      status: "active",
      title: "Reiki online",
      weeklyAvailableMinutes: 180,
    },
  ];
}
