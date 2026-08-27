import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TherapistScheduleReadModel } from "@/domain/tes";

const navigationMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: navigationMocks.refresh }),
}));

import { TherapistScheduleHours } from "./therapist-schedule-hours";

describe("TherapistScheduleHours", () => {
  beforeEach(() => {
    navigationMocks.refresh.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders canonical service settings without premature rescheduling controls", () => {
    renderSchedule();

    expect(
      screen.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Configuração aplicada a")).toHaveValue(
      serviceId,
    );
    expect(screen.getByText("Duração da sessão")).toBeInTheDocument();
    expect(screen.getByText("50 min")).toBeInTheDocument();
    expect(screen.queryByText("Tempo de preparo")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Reagendamento automático"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeDisabled();
  });

  it("limits schedule times to a dropdown while preserving a saved legacy time", () => {
    const initialSchedule = scheduleFixture();
    initialSchedule.rules[0] = {
      ...initialSchedule.rules[0]!,
      startTime: "02:59",
    };
    renderSchedule(initialSchedule);

    const startTime = screen.getByLabelText("Início de Segunda-feira");
    expect(startTime).toHaveRole("combobox");
    expect(startTime).toHaveValue("02:59");
    expect(within(startTime).getByRole("option", { name: "02:59" })).toBeInTheDocument();
    expect(within(startTime).getByRole("option", { name: "02:45" })).toBeInTheDocument();
    expect(startTime).not.toHaveAttribute("type", "time");
  });

  it("explains each session rule through an accessible information popover", () => {
    renderSchedule();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Saiba mais sobre Intervalo das sessões",
      }),
    );

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "De quanto em quanto tempo",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("distinguishes unavailable agenda insights from a legitimate empty list", () => {
    renderSchedule();

    expect(
      screen.getAllByText("Dados da agenda indisponíveis no momento."),
    ).toHaveLength(2);
  });

  it("validates reversed ranges locally without calling the command", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderSchedule();

    fireEvent.change(screen.getByLabelText("Início de Segunda-feira"), {
      target: { value: "13:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O horário final deve ser posterior ao horário inicial.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prevents a new range from overlapping another range on the same day", async () => {
    renderSchedule();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar faixa" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Adicionar faixa de horário",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Adicionar faixa" }),
    );

    const starts = screen.getAllByLabelText("Início de Segunda-feira");
    fireEvent.change(starts[1]!, { target: { value: "08:00" } });

    await waitFor(() => expect(starts[1]).toHaveValue("08:00"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.blur(screen.getAllByLabelText("Início de Segunda-feira")[0]!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Essa faixa se sobrepõe a outro horário disponível no mesmo dia.",
    );

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(starts[1]).toHaveValue("08:00");
  });

  it("sends the versioned command and confirms a successful save", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            idempotentReplay: false,
            scheduleVersion: 2,
            timezone: "America/Sao_Paulo",
          },
          ok: true,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const initialSchedule = scheduleFixture();
    initialSchedule.rules.push({
      dayOfWeek: 3,
      endTime: "18:00",
      id: "e1000000-0000-4000-8000-000000000099",
      isActive: true,
      serviceId: "d1000000-0000-4000-8000-000000000099",
      startTime: "09:00",
    });
    renderSchedule(initialSchedule);

    fireEvent.change(
      screen.getByLabelText("Intervalo das sessões"),
      { target: { value: "45" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(
      await screen.findByText("Horários salvos com sucesso."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body)) as {
      expectedVersion: number;
      rules: Array<{ serviceId: string | null }>;
      serviceSettings: Array<{
        bufferAfterMinutes: number;
        bufferBeforeMinutes: number;
        slotStepMinutes: number;
      }>;
    };
    expect(payload.expectedVersion).toBe(1);
    expect(payload.rules).toHaveLength(1);
    expect(payload.rules[0]?.serviceId).toBe(serviceId);
    expect(payload.serviceSettings[0]).toEqual(
      expect.objectContaining({
        bufferAfterMinutes: 10,
        bufferBeforeMinutes: 10,
        slotStepMinutes: 45,
      }),
    );
    expect(navigationMocks.refresh).toHaveBeenCalledOnce();
  });

  it("shows an optimistic concurrency conflict instead of success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "schedule_version_conflict",
              message: "Conflito.",
            },
            ok: false,
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 409,
          },
        ),
      ),
    );
    renderSchedule();

    fireEvent.change(
      screen.getByLabelText("Intervalo das sessões"),
      { target: { value: "45" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sua agenda foi alterada em outra janela.",
    );
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
  });

  it("copies ranges between days without mutating the source day", async () => {
    renderSchedule();

    fireEvent.click(
      screen.getByRole("button", { name: "Copiar para outros dias" }),
    );
    fireEvent.click(screen.getByLabelText("Ter"));
    fireEvent.click(screen.getByRole("button", { name: "Copiar horários" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("Início de Segunda-feira")).toHaveValue(
      "09:00",
    );
    expect(screen.getByLabelText("Início de Terça-feira")).toHaveValue("09:00");
  });
});

const serviceId = "d1000000-0000-4000-8000-000000000001";
const therapistProfileId = "c1000000-0000-4000-8000-000000000001";

function renderSchedule(initialSchedule = scheduleFixture()) {
  return render(
    <TherapistScheduleHours
      agenda={null}
      initialSchedule={initialSchedule}
      referenceNow="2026-07-26T13:00:00.000Z"
    />,
  );
}

function scheduleFixture(): TherapistScheduleReadModel {
  return {
    contractVersion: 1,
    rules: [
      {
        dayOfWeek: 1,
        endTime: "12:00",
        id: "e1000000-0000-4000-8000-000000000001",
        isActive: true,
        serviceId,
        startTime: "09:00",
      },
    ],
    scheduleVersion: 1,
    services: [
      {
        durationMinutes: 50,
        id: serviceId,
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
    ],
    summary: {
      configuredDays: 0,
      weeklyAvailableMinutes: 0,
    },
    therapistProfileId,
    timezone: "America/Sao_Paulo",
    updatedAt: "2026-07-26T12:00:00.000Z",
  };
}
