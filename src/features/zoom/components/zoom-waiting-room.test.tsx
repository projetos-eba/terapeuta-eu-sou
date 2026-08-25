import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZoomWaitingRoom } from "./zoom-waiting-room";

const baseProps = {
  actorRole: "patient" as const,
  bookingId: "f2000000-0000-4000-8000-000000000001",
  isOnline: true,
  kind: "too_early" as const,
  onJoin: vi.fn(),
  onRefresh: vi.fn(),
  participantLabel: "Com Juliane Moore",
  previewLoading: false,
  scheduleLabel: "24 de ago. de 2026, 13:03",
  sessionTitle: "Reiki online",
};

describe("ZoomWaitingRoom", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens a local camera preview without asking for microphone access", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: { getUserMedia },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();

    render(<ZoomWaitingRoom {...baseProps} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Testar câmera" })[0]);

    expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: true });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sua prévia de câmera está pronta.",
    );
    expect(screen.getByTestId("waiting-room-camera-preview")).toHaveClass(
      "opacity-100",
    );
  });

  it("tests the microphone independently and releases its stream on unmount", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: { getUserMedia },
    });

    const view = render(<ZoomWaitingRoom {...baseProps} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Testar áudio" })[0]);

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Seu microfone está sendo testado agora.",
    );
    expect(screen.getByLabelText("Nível do microfone")).toBeVisible();

    view.unmount();
    expect(track.stop).toHaveBeenCalled();
  });

  it("releases a microphone stream when the local level meter cannot start", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: { getUserMedia },
    });
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("meter unavailable");
        }
      },
    );

    render(<ZoomWaitingRoom {...baseProps} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Testar áudio" })[0]);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Não conseguimos acessar seu microfone.",
    );
    expect(track.stop).toHaveBeenCalled();
  });

  it("keeps ambient audio visibly unavailable until a licensed source is configured", () => {
    render(<ZoomWaitingRoom {...baseProps} />);

    expect(
      screen.getByRole("button", { name: "Áudio ambiente indisponível" }),
    ).toBeDisabled();
    expect(screen.getByText("Música suave para um momento de calma")).toBeVisible();
  });

  it("keeps the waiting-room mark centered over the supplied cover", () => {
    render(<ZoomWaitingRoom {...baseProps} />);

    expect(screen.getByTestId("waiting-room-center-mark")).toHaveClass(
      "left-1/2",
      "top-1/2",
      "-translate-x-1/2",
      "-translate-y-1/2",
    );
  });

  it("shows the booking ID below the participant name", () => {
    render(<ZoomWaitingRoom {...baseProps} />);

    expect(screen.getByTestId("booking-reference")).toHaveTextContent(
      "ID: f2000000-0000-4000-8000-000000000001",
    );
  });

  it("enables the play control only when an ambient audio source is provided", () => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

    render(
      <ZoomWaitingRoom
        {...baseProps}
        ambientAudioSrc="/zoom/ambient-waiting-room.mp3"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Ouvir áudio ambiente" }),
    ).toBeEnabled();
  });
});
