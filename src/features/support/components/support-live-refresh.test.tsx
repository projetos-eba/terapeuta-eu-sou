import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSupportLiveRefresh } from "./support-live-refresh";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useSupportLiveRefresh", () => {
  it("uses temporary polling when SSE is unavailable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", undefined);
    const onRefresh = vi.fn();

    const { unmount } = renderHook(() =>
      useSupportLiveRefresh({ actorRole: "patient", onRefresh }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("reconnects progressively after an SSE error while keeping the fallback", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const instances: Array<{
      close: ReturnType<typeof vi.fn>;
      onerror: ((event: Event) => void) | null;
      onmessage: ((event: MessageEvent) => void) | null;
      onopen: ((event: Event) => void) | null;
    }> = [];

    class EventSourceMock {
      close = vi.fn();
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: ((event: Event) => void) | null = null;

      constructor() {
        instances.push(this);
      }
    }
    vi.stubGlobal("EventSource", EventSourceMock);
    const onRefresh = vi.fn();

    const { unmount } = renderHook(() =>
      useSupportLiveRefresh({ actorRole: "therapist", onRefresh }),
    );

    act(() => instances[0]?.onerror?.(new Event("error")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(instances).toHaveLength(2);
    expect(instances[0]?.close).toHaveBeenCalledTimes(1);

    unmount();
  });
});
