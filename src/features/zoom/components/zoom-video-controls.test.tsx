import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZoomVideoControls } from "./zoom-video-controls";

const baseProps = {
  audioMuted: true,
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
});
