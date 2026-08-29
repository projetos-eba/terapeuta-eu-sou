import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZoomVideoControls } from "./zoom-video-controls";

const baseProps = {
  audioMuted: true,
  canEndForAll: true,
  isBusy: false,
  isOnline: true,
  onJoin: vi.fn(),
  onLeave: vi.fn(),
  onReviewPermissions: vi.fn(),
  onTherapistEnd: vi.fn(),
  onToggleAudio: vi.fn(),
  onToggleVideo: vi.fn(),
  roleType: null as 0 | 1 | null,
  state: "joined" as const,
  supportHref: "/app/mensagens?context=suporte",
  videoOn: false,
};

describe("ZoomVideoControls", () => {
  afterEach(cleanup);

  it("shows distinct exit and therapist-end actions", () => {
    render(
      <ZoomVideoControls
        {...baseProps}
        actorRole="therapist"
        roleType={1}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Sair da sessão" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Encerrar para todos" }),
    ).toHaveClass("bg-status-danger");
    expect(
      screen.getByRole("button", { name: "Sair da sessão" }),
    ).toHaveClass("min-h-12");
  });

  it("keeps the patient dock to a single exit action", () => {
    render(<ZoomVideoControls {...baseProps} actorRole="patient" roleType={0} />);

    expect(
      screen.getByRole("button", { name: "Sair do encontro" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Encerrar para todos" }),
    ).toBeNull();
  });

  it("keeps the patient exit action available when the connection is offline", () => {
    render(
      <ZoomVideoControls
        {...baseProps}
        actorRole="patient"
        isOnline={false}
        roleType={0}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Sair do encontro" }),
    ).toBeEnabled();
  });


  it("keeps final end disabled before the last five minutes", () => {
    render(
      <ZoomVideoControls
        {...baseProps}
        actorRole="therapist"
        canEndForAll={false}
        roleType={1}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /disponível nos 5 minutos finais/i,
      }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "O encerramento para todos ficará disponível nos 5 minutos finais.",
      ),
    ).toBeVisible();
  });

  it("uses icons for the current microphone and camera states", () => {
    const { rerender } = render(
      <ZoomVideoControls {...baseProps} actorRole="patient" roleType={0} />,
    );

    expect(
      screen.getByRole("button", { name: "Ativar microfone" }).querySelector(".lucide-mic-off"),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Ativar câmera" }).querySelector(".lucide-video-off"),
    ).not.toBeNull();

    rerender(
      <ZoomVideoControls
        {...baseProps}
        actorRole="patient"
        audioMuted={false}
        roleType={0}
        videoOn
      />,
    );
    expect(
      screen.getByRole("button", { name: "Silenciar microfone" }).querySelector(".lucide-mic"),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Desligar câmera" }).querySelector(".lucide-video"),
    ).not.toBeNull();
  });

  it("offers a direct mobile camera activation action", () => {
    const onActivateCamera = vi.fn();
    render(
      <ZoomVideoControls
        {...baseProps}
        actorRole="patient"
        isMobileDevice
        onActivateCamera={onActivateCamera}
        roleType={0}
      />,
    );

    const button = screen.getByRole("button", { name: "Ativar minha câmera" });
    expect(button).toBeVisible();
    button.click();
    expect(onActivateCamera).toHaveBeenCalledTimes(1);
  });
});
