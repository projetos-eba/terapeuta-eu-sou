import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../zoom-video-session-adapter", () => ({
  ZoomVideoSessionAdapter: ({
    actorRole,
    ambientAudioSrc,
    displayMode,
  }: {
    actorRole: string;
    ambientAudioSrc?: string | null;
    displayMode: string;
  }) => (
    <div aria-label="Sala Zoom" data-ambient-audio-src={ambientAudioSrc}>
      {actorRole}:{displayMode}
    </div>
  ),
}));

import { ZoomVideoCallPage } from "./zoom-video-call-page";

describe("ZoomVideoCallPage", () => {
  it("renders an immersive patient room with a safe return path", () => {
    render(
      <ZoomVideoCallPage
        access={null}
        actorRole="patient"
        backHref="/app/encontros/booking-id"
        bookingId="booking-id"
        participantLabel="Com Ana"
        scheduleLabel="11/08, 14:00"
        scheduledEndsAt="2026-08-11T15:00:00.000Z"
        scheduledStartsAt="2026-08-11T14:00:00.000Z"
        sessionTitle="Reiki online"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Sala de vídeo" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Sala Zoom")).toHaveTextContent(
      "patient:dedicated",
    );
    expect(screen.getByLabelText("Sala Zoom")).toHaveAttribute(
      "data-ambient-audio-src",
      "/zoom/waiting-room-ambient.mp3",
    );
    expect(
      screen.getByRole("link", { name: "Voltar aos detalhes" }),
    ).toHaveAttribute("href", "/app/encontros/booking-id");
  });
});
