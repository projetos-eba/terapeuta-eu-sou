import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ZoomAccessState } from "@/domain/tes";

import { TherapistEarlyRoomEntry } from "./therapist-early-room-entry";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children?: ReactNode;
  href: string;
};

vi.mock("next/link", async () => {
  const React = await import("react");

  return {
    default: ({ children, href, ...props }: LinkProps) =>
      React.createElement("a", { ...props, href }, children),
  };
});

const scheduledStartsAt = "2026-09-30T14:30:00.000Z";
const fetchMock = vi.fn();

function accessFixture(
  overrides: Partial<ZoomAccessState> = {},
): ZoomAccessState {
  return {
    allowed: true,
    availableFrom: "2026-09-30T14:15:00.000Z",
    availableUntil: "2026-09-30T15:30:00.000Z",
    reason: null,
    scheduledStartsAt,
    serverNow: "2026-09-30T14:15:00.000Z",
    videoSessionStatus: "ready",
    ...overrides,
  };
}

function renderEntry(access = accessFixture()) {
  return render(
    <TherapistEarlyRoomEntry
      access={access}
      href="/terapeuta/sessoes/booking-id/video"
      label="Abrir sala"
      scheduleLabel="30 de set. de 2026, 14:30"
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("TherapistEarlyRoomEntry", () => {
  it("opens the confirmation without requesting room access, and waiting only closes it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T14:15:00.000Z"));
    vi.stubGlobal("fetch", fetchMock);
    renderEntry();

    act(() => {
      expect(
        fireEvent.click(screen.getByRole("link", { name: "Abrir sala" })),
      ).toBe(false);
    });
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Aguardar o horário" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the server-clock offset and keeps the current room route for early entry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T14:10:00.000Z"));
    renderEntry(accessFixture({ serverNow: "2026-09-30T14:15:00.000Z" }));

    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Abrir sala" }));
    });
    expect(screen.getByRole("dialog")).toBeVisible();

    const earlyEntryLink = screen.getByRole("link", { name: "Entrar agora" });
    expect(earlyEntryLink).toHaveAttribute(
      "href",
      "/terapeuta/sessoes/booking-id/video",
    );
    expect(fireEvent.click(earlyEntryLink)).toBe(true);
  });

  it.each([
    ["before the opening window", "2026-09-30T14:14:59.999Z", true],
    ["without an eligible room", "2026-09-30T14:15:00.000Z", false],
    ["one minute before the scheduled start", "2026-09-30T14:29:00.000Z", true],
    ["at the scheduled start", "2026-09-30T14:30:00.000Z", true],
  ])("navigates directly %s", (_label, now, allowed) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    renderEntry(accessFixture({ allowed, serverNow: now }));

    expect(
      fireEvent.click(screen.getByRole("link", { name: "Abrir sala" })),
    ).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes an open confirmation at the direct-entry boundary and after returning to the tab", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T14:28:59.000Z"));
    renderEntry(accessFixture({ serverNow: "2026-09-30T14:28:59.000Z" }));

    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Abrir sala" }));
    });
    expect(screen.getByRole("dialog")).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date("2026-09-30T14:30:00.000Z"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(
      fireEvent.click(screen.getByRole("link", { name: "Abrir sala" })),
    ).toBe(true);
  });
});
