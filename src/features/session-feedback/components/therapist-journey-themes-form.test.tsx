import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOURNEY_THEME_OPTIONS } from "../session-journey-themes";
import { TherapistJourneyThemesForm } from "./therapist-journey-themes-form";

const bookingId = "96000000-0000-4000-8000-000000000001";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TherapistJourneyThemesForm", () => {
  it("uses the welcoming copy and renders an icon for every theme", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ data: { selection: null }, ok: true }),
        ),
    );

    render(<TherapistJourneyThemesForm bookingId={bookingId} />);

    expect(
      await screen.findByRole("heading", {
        name: "Quais foram os temas da sua sessão?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Registre até três temas para acompanhar essa jornada no seu histórico com o cliente.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Opcional")).toBeInTheDocument();

    for (const theme of JOURNEY_THEME_OPTIONS) {
      const checkbox = screen.getByLabelText(theme.label);
      expect(checkbox.closest("label")?.querySelector("svg")).not.toBeNull();
    }
  });

  it("limits the selection to three themes and requires acknowledgement", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ data: { selection: null }, ok: true }),
        ),
    );

    render(<TherapistJourneyThemesForm bookingId={bookingId} />);
    await screen.findByLabelText("Autoconhecimento");

    const first = screen.getByLabelText("Autoconhecimento");
    const second = screen.getByLabelText("Bem-estar emocional");
    const third = screen.getByLabelText("Relações e vínculos");
    const fourth = screen.getByLabelText("Comunicação");
    const submit = screen.getByRole("button", { name: "Registrar temas" });

    fireEvent.click(first);
    fireEvent.click(second);
    fireEvent.click(third);

    expect(fourth).toBeDisabled();
    expect(submit).toBeDisabled();

    fireEvent.click(
      screen.getByLabelText(
        "Confirmo que os temas selecionados refletem assuntos tratados nesta sessão.",
      ),
    );
    expect(submit).toBeEnabled();

    fireEvent.click(first);
    expect(fourth).toBeEnabled();
    expect(screen.getByText("2/3 temas selecionados")).toBeInTheDocument();
  });

  it("saves the selection and renders immutable chips with their icons", async () => {
    const selection = {
      bookingId,
      selectedAt: "2026-09-11T18:00:00.000Z",
      taxonomyVersion: "journey_topics_v1",
      themeKeys: ["self_knowledge", "communication"],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { selection: null }, ok: true }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { selection }, ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapistJourneyThemesForm
        bookingId={bookingId}
        presentation="standalone"
      />,
    );
    await screen.findByLabelText("Autoconhecimento");

    fireEvent.click(screen.getByLabelText("Autoconhecimento"));
    fireEvent.click(screen.getByLabelText("Comunicação"));
    fireEvent.click(
      screen.getByLabelText(
        "Confirmo que os temas selecionados refletem assuntos tratados nesta sessão.",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Registrar temas" }));

    expect(
      await screen.findByText("Temas registrados para esta sessão"),
    ).toBeInTheDocument();
    const savedList = screen.getByRole("list", { name: "Temas registrados" });
    expect(savedList.querySelectorAll("li")).toHaveLength(2);
    expect(savedList.querySelectorAll("svg")).toHaveLength(2);
    expect(
      screen.getByText(
        "Este registro fica disponível somente para você e não pode ser alterado.",
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      const request = fetchMock.mock.calls[1];
      expect(request[0]).toBe("/api/therapist/session-journey-themes");
      expect(JSON.parse(String(request[1]?.body))).toMatchObject({
        acknowledged: true,
        bookingId,
        themeKeys: ["self_knowledge", "communication"],
      });
    });
  });

  it("keeps a read failure visible instead of presenting an empty saved state", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ json: async () => null, ok: false, status: 503 }),
    );

    render(<TherapistJourneyThemesForm bookingId={bookingId} />);

    expect(
      await screen.findByText("Não foi possível consultar os temas agora."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Temas registrados para esta sessão"),
    ).not.toBeInTheDocument();
  });
});

function jsonResponse(payload: unknown) {
  return {
    json: async () => payload,
    ok: true,
    status: 200,
  };
}
