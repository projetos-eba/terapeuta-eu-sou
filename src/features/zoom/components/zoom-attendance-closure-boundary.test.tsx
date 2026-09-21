import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZoomAttendanceClosureBoundary } from "./zoom-attendance-closure-boundary";

const startsAt = "2026-09-18T23:00:00.000Z";
const fetchMock = vi.fn();
const unmount = vi.fn();
function Call() {
  useEffect(() => () => unmount(), []);
  return <div>Chamada ativa</div>;
}
function mount(
  actorRole: "patient" | "therapist" = "therapist",
  showFeedback = false,
) {
  return render(
    <ZoomAttendanceClosureBoundary
      actorRole={actorRole}
      bookingId="booking-id"
      participantLabel="Cliente"
      scheduleLabel="20h"
      scheduledStartsAt={startsAt}
      showFeedback={showFeedback}
    >
      <Call />
    </ZoomAttendanceClosureBoundary>,
  );
}
function response(
  attendance: Record<string, unknown>,
  realizationStatus = "pending",
) {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      data: {
        contractVersion: 2,
        realizationStatus,
        attendance: { sessionStartsAt: startsAt, ...attendance },
      },
    }),
  };
}
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("therapist attendance closure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    unmount.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("unmounts the call only after authoritative patient absence, without feedback", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ patientPresentAtTolerance: false }),
    );
    mount();
    await flush();
    expect(screen.getByText("Chamada ativa")).toBeVisible();
    fetchMock.mockResolvedValueOnce(
      response(
        {
          classification: "no_show_patient",
          therapistPresentAtTolerance: true,
          patientPresentAtTolerance: false,
        },
        "not_performed",
      ),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        "O paciente não compareceu até o fim da tolerância. Se precisar de ajuda, fale com o suporte.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Chamada ativa")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /entrar/i }),
    ).not.toBeInTheDocument();
  });

  it.each([{ patientPresentAtTolerance: true }, { bothJoined: true }])(
    "preserves reentry after timely evidence %j",
    async (attendance) => {
      fetchMock.mockResolvedValue(response(attendance));
      mount();
      await flush();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(unmount).not.toHaveBeenCalled();
      expect(screen.getByText("Chamada ativa")).toBeVisible();
    },
  );

  it("does not observe the patient room or the completed-session form", async () => {
    mount("patient");
    await flush();
    cleanup();
    mount("therapist", true);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the call on network errors and rejects stale schedule evidence", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    mount();
    await flush();
    fetchMock.mockResolvedValueOnce(
      response(
        {
          sessionStartsAt: "2026-09-19T23:00:00Z",
          classification: "no_show_patient",
          therapistPresentAtTolerance: true,
          patientPresentAtTolerance: false,
        },
        "not_performed",
      ),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(unmount).not.toHaveBeenCalled();
    expect(screen.getByText("Chamada ativa")).toBeVisible();
  });

  it("ignores a late response after leaving the page", async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = mount();
    view.unmount();
    resolve(
      response(
        {
          classification: "no_show_patient",
          therapistPresentAtTolerance: true,
          patientPresentAtTolerance: false,
        },
        "not_performed",
      ),
    );
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
