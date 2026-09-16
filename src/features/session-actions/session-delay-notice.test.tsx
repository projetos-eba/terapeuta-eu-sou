import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionDelayNotice } from "./session-delay-notice";

const startsAt = "2026-09-15T20:00:00.000Z";
const baseProps = {
  actorRole: "patient" as const,
  bookingConfirmed: true,
  bookingId: "10000000-0000-4000-8000-000000000001",
  bookingVersion: 2,
  initialState: { participantJoined: false, sentAt: null },
  scheduledStartsAt: startsAt,
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SessionDelayNotice", () => {
  it.each([
    ["T-61", "2026-09-15T18:59:00.000Z", false],
    ["T-60", "2026-09-15T19:00:00.000Z", true],
    ["T+10", "2026-09-15T20:10:00.000Z", true],
    ["T+11", "2026-09-15T20:11:00.000Z", false],
  ])("%s availability", (_label, now, visible) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    render(<SessionDelayNotice {...baseProps} />);
    expect(Boolean(screen.queryByRole("button", { name: "Vou me atrasar" }))).toBe(
      visible,
    );
  });

  it("explains that the notice never extends tolerance", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T19:30:00.000Z"));
    render(<SessionDelayNotice {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Vou me atrasar" }));
    expect(screen.getByText(/não pausa, reinicia ou amplia/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar aviso" })).toBeInTheDocument();
  });

  it("shows sent state but hides after a trusted participant join", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T19:30:00.000Z"));
    const { rerender } = render(
      <SessionDelayNotice
        {...baseProps}
        initialState={{ participantJoined: false, sentAt: startsAt }}
      />,
    );
    expect(screen.getByText("Aviso enviado")).toBeInTheDocument();
    rerender(
      <SessionDelayNotice
        {...baseProps}
        initialState={{ participantJoined: true, sentAt: startsAt }}
      />,
    );
    expect(screen.queryByText("Aviso enviado")).not.toBeInTheDocument();
  });
});
