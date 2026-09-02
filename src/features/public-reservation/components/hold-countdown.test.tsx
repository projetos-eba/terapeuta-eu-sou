import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HoldCountdown } from "./hold-countdown";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HoldCountdown", () => {
  it("uses the absolute server deadline and expires only once", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
    const onExpire = vi.fn();
    render(
      <HoldCountdown
        expiresAt="2026-09-01T12:00:05.000Z"
        onExpire={onExpire}
        serverNow="2026-09-01T12:00:00.000Z"
      />,
    );

    expect(screen.getByText("00:05")).toBeInTheDocument();
    act(() => {
      vi.setSystemTime(new Date("2026-09-01T12:00:03.000Z"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByText("00:02")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(onExpire).toHaveBeenCalledOnce();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onExpire).toHaveBeenCalledOnce();
  });
});
