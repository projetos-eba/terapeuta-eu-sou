import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZoomAccessReason } from "@/domain/tes";

import {
  formatActiveSessionCountdown,
  formatScheduledSessionCountdown,
  isFinalEndAvailable,
  ZoomVideoSessionAdapter,
} from "./zoom-video-session-adapter";

const calls: string[] = [];
const handlers = new Map<string, (...args: unknown[]) => void>();
type MockExecutedFailure = {
  errorCode: number;
  reason: string;
  type: string;
};
const destroyClient = vi.fn(() => {
  calls.push("destroy");
});
const remoteElement = document.createElement("video");
const localElement = document.createElement("video");
const mockClient = {
  getAllUser: vi.fn(
    (): Array<{
      bVideoOn?: boolean;
      displayName?: string;
      userId: number;
    }> => [],
  ),
  getCurrentUserInfo: vi.fn(() => ({ userId: 7 })),
  getMediaStream: vi.fn(() => mockStream),
  init: vi.fn(async (): Promise<"" | MockExecutedFailure> => {
    calls.push("init");
    return "" as const;
  }),
  join: vi.fn(async (): Promise<"" | MockExecutedFailure> => {
    calls.push("join");
    return "" as const;
  }),
  leave: vi.fn(async (end?: boolean): Promise<"" | MockExecutedFailure> => {
    calls.push(end ? "end" : "leave");
    return "" as const;
  }),
  off: vi.fn((event: string) => {
    handlers.delete(event);
  }),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    handlers.set(event, handler);
  }),
};
const mockStream = {
  attachVideo: vi.fn(async (userId: number) =>
    userId === 7 ? localElement : remoteElement,
  ),
  detachVideo: vi.fn(async () => undefined),
  muteAudio: vi.fn(async () => "" as const),
  startAudio: vi.fn(async () => "" as const),
  startVideo: vi.fn(async () => "" as const),
  stopAudio: vi.fn(async () => "" as const),
  stopRenderVideo: vi.fn(async () => undefined),
  stopVideo: vi.fn(async () => "" as const),
  unmuteAudio: vi.fn(async () => "" as const),
};
const createClient = vi.fn(() => mockClient);

vi.mock("@zoom/videosdk", () => ({
  default: {
    checkSystemRequirements: () => ({ audio: true, video: true }),
    createClient,
    destroyClient,
    preloadDependentAssets: vi.fn(async () => undefined),
  },
}));

const allowedAccess = {
  allowed: true,
  availableFrom: "2026-07-26T12:45:00.000Z",
  availableUntil: "2026-07-26T14:00:00.000Z",
  videoSessionStatus: "ready" as const,
  reason: null,
};

describe("ZoomVideoSessionAdapter", () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    calls.length = 0;
    handlers.clear();
    remoteElement.remove();
    localElement.remove();
    vi.clearAllMocks();
    createClient.mockImplementation(() => mockClient);
    destroyClient.mockImplementation(() => {
      calls.push("destroy");
    });
    mockClient.init.mockImplementation(async () => {
      calls.push("init");
      return "" as const;
    });
    mockClient.join.mockImplementation(async () => {
      calls.push("join");
      return "" as const;
    });
    mockClient.leave.mockImplementation(async (end?: boolean) => {
      calls.push(end ? "end" : "leave");
      return "" as const;
    });
    mockClient.getAllUser.mockReturnValue([]);
    vi.unstubAllGlobals();
  });

  it("keeps entry unavailable outside the join window", () => {
    render(
      <ZoomVideoSessionAdapter
        access={{
          allowed: false,
          availableFrom: "2026-07-26T12:45:00.000Z",
          availableUntil: "2026-07-26T14:00:00.000Z",
          videoSessionStatus: "ready",
          reason: ZoomAccessReason.TooEarly,
        }}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    expect(
      screen.getByText(/Disponível 15 minutos antes do início/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /entrar/i }),
    ).not.toBeInTheDocument();
  });

  it("initializes before joining as patient role 0 and does not render tokens", async () => {
    vi.stubGlobal("fetch", accessResponse(0));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      await screen.findByText(/voc[eê] entrou no encontro/i),
    ).toBeInTheDocument();
    expect(calls.slice(0, 2)).toEqual(["init", "join"]);
    expect(mockClient.init).toHaveBeenCalledWith(
      "pt-BR",
      "Global",
      expect.objectContaining({ enforceMultipleVideos: true }),
    );
    expect(mockClient.join).toHaveBeenCalledWith(
      "tesvs-session",
      "jwt-token-role-0",
      "Paciente",
      undefined,
    );
    expect(mockStream.muteAudio).toHaveBeenCalled();
    expect(mockStream.unmuteAudio).not.toHaveBeenCalled();
    expect(mockStream.startVideo).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/jwt-token|secret|token/i);
  });

  it.each(["patient", "therapist"] as const)(
    "applies both preflight media preferences for the %s in the active room",
    async (actorRole) => {
      const cameraTrack = { stop: vi.fn() };
      const audioTrack = { stop: vi.fn() };
      const cameraStream = {
        getTracks: () => [cameraTrack],
      } as unknown as MediaStream;
      const audioStream = {
        getTracks: () => [audioTrack],
      } as unknown as MediaStream;
      const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) =>
        constraints.video ? cameraStream : audioStream,
      );

      vi.stubGlobal("fetch", accessResponse(actorRole === "therapist" ? 1 : 0));
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia },
      });
      vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();

      render(
        <ZoomVideoSessionAdapter
          access={allowedAccess}
          actorRole={actorRole}
          bookingId="96000000-0000-4000-8000-000000000001"
        />,
      );

      fireEvent.click(
        screen.getAllByRole("button", { name: "Testar câmera" })[0],
      );
      expect(await screen.findByRole("status")).toHaveTextContent(
        "Sua prévia de câmera está pronta.",
      );
      fireEvent.click(
        screen.getAllByRole("button", { name: "Testar áudio" })[0],
      );
      expect(await screen.findByRole("status")).toHaveTextContent(
        "Seu microfone está sendo testado agora.",
      );

      fireEvent.click(screen.getByRole("button", { name: /entrar na sala/i }));

      expect(
        await screen.findByText(/voc[eê] entrou no encontro|respons[aá]vel/i),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(mockStream.unmuteAudio).toHaveBeenCalled();
        expect(mockStream.startVideo).toHaveBeenCalled();
        expect(mockStream.attachVideo).toHaveBeenCalledWith(7, 2);
      });
    },
  );
  it("keeps the active mount generation valid under React Strict Mode", async () => {
    vi.stubGlobal("fetch", accessResponse(0));

    render(
      <StrictMode>
        <ZoomVideoSessionAdapter
          access={allowedAccess}
          actorRole="patient"
          bookingId="96000000-0000-4000-8000-000000000001"
        />
      </StrictMode>,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      await screen.findByText(/voc[eê] entrou no encontro/i),
    ).toBeInTheDocument();
    expect(mockClient.join).toHaveBeenCalledTimes(1);
  });

  it("keeps the authenticated TES session active while the encounter is open", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/session/refresh") {
        return Promise.resolve({ ok: true });
      }

      return accessResponse(0)();
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/session/refresh",
        expect.objectContaining({
          body: JSON.stringify({ role: "patient" }),
          method: "POST",
        }),
      );
    });
  });

  it("uses the authoritative access returned when joining", async () => {
    const serverNow = Date.now();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            access: {
              ...allowedAccess,
              hardEndsAt: new Date(serverNow + 30 * 60_000).toISOString(),
              scheduledEndsAt: new Date(serverNow + 40 * 60_000).toISOString(),
              scheduledStartsAt: new Date(
                serverNow - 10 * 60_000,
              ).toISOString(),
              serverNow: new Date(serverNow).toISOString(),
            },
            roleType: 0,
            sdkKey: "public-sdk-key",
            sessionName: "tesvs-session",
            sessionPasscode: null,
            token: "jwt-token-role-0",
            userName: "Paciente",
          },
          ok: true,
        }),
        ok: true,
      }),
    );

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      await screen.findByText(/tempo restante do encontro: (39:5\d|40:00)/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/tempo seguro/i)).toBeNull();
  });

  it("blocks entry while offline and refreshes the room after reconnecting", async () => {
    const fetchMock = accessResponse(0);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fetchMock.mockClear();
    fireEvent(window, new Event("offline"));

    expect(
      screen.getAllByText(/sem conexão com a internet/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /entrar/i })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent(window, new Event("online"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: /entrar/i })).toBeEnabled();
    });
  });

  it("renders remote video on peer-video-state-change and detaches on leave", async () => {
    vi.stubGlobal("fetch", accessResponse(0));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);

    handlers.get("peer-video-state-change")?.({ action: "Start", userId: 9 });

    expect(await screen.findByLabelText(/vídeo remoto/i)).toContainElement(
      remoteElement,
    );

    fireEvent.click(screen.getByRole("button", { name: /sair do encontro/i }));
    expect(await screen.findByText(/você saiu/i)).toBeInTheDocument();
    expect(screen.queryByText(/como foi seu encontro/i)).toBeNull();
    expect(mockStream.detachVideo).toHaveBeenCalledWith(9);
    expect(destroyClient).toHaveBeenCalled();
  });

  it("attaches each remote participant only once when Zoom emits concurrent events", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    let releaseAttach: (() => void) | undefined;
    const attachGate = new Promise<void>((resolve) => {
      releaseAttach = resolve;
    });
    mockStream.attachVideo.mockImplementation(async (userId: number) => {
      if (userId === 9) await attachGate;
      return userId === 7 ? localElement : remoteElement;
    });

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    mockStream.attachVideo.mockClear();

    handlers.get("user-updated")?.([{ bVideoOn: true, userId: 9 }]);
    handlers.get("peer-video-state-change")?.({ action: "Start", userId: 9 });
    releaseAttach?.();

    await waitFor(() => {
      expect(mockStream.attachVideo).toHaveBeenCalledTimes(1);
      expect(mockStream.attachVideo).toHaveBeenCalledWith(9, 2);
    });
  });

  it("keeps the native reconnect when Zoom reports Connected within the grace window", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", accessResponse(0));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/voc[eê] entrou no encontro/i)).toBeInTheDocument();

    act(() => {
      handlers.get("connection-change")?.({
        errorCode: 5003,
        reason: "reconnecting",
        state: "Reconnecting",
      });
    });
    expect(screen.getByText(/reconectando o encontro/i)).toBeInTheDocument();

    act(() => {
      handlers.get("connection-change")?.({ state: "Connected" });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(screen.getByText(/conexao restabelecida/i)).toBeInTheDocument();
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("ignores a delayed connection event from a disposed client generation", async () => {
    vi.stubGlobal("fetch", accessResponse(0));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    const disposedConnectionHandler = handlers.get("connection-change");

    fireEvent.click(screen.getByRole("button", { name: /sair do encontro/i }));
    await screen.findByText(/você saiu/i);
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => expect(mockClient.join).toHaveBeenCalledTimes(2));

    act(() => {
      disposedConnectionHandler?.({
        errorCode: 5012,
        reason: "delayed old event",
        state: "Fail",
      });
    });

    expect(
      screen.queryByText(/recarregue esta página/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/voc[eê] entrou no encontro/i)).toBeInTheDocument();
  });

  it("uses the VideoClient participant id and attaches self-view after enabling the camera", async () => {
    vi.stubGlobal("fetch", accessResponse(0));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));

    await waitFor(() => {
      expect(mockClient.getCurrentUserInfo).toHaveBeenCalled();
      expect(mockStream.startVideo).toHaveBeenCalled();
      expect(mockStream.attachVideo).toHaveBeenCalledWith(7, 2);
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /desligar câmera/i }));
    await waitFor(() => {
      expect(mockStream.detachVideo).toHaveBeenCalledWith(7);
      expect(mockStream.stopVideo).toHaveBeenCalled();
    });
  });

  it("keeps the therapist video attached when the patient enables their own camera", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: false, userId: 7 },
      { bVideoOn: true, userId: 9 },
    ]);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    const remoteVideo = await screen.findByLabelText(/vídeo remoto/i);
    expect(remoteVideo).toContainElement(remoteElement);

    fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));
    await waitFor(() => {
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      );
    });

    mockStream.detachVideo.mockClear();
    await act(async () => {
      handlers.get("user-updated")?.([{ bVideoOn: true, userId: 7 }]);
      handlers.get("user-updated")?.([
        { displayName: "Terapeuta atualizado", userId: 9 },
      ]);
      await Promise.resolve();
    });

    expect(mockStream.detachVideo).not.toHaveBeenCalledWith(9);
    expect(remoteVideo).toContainElement(remoteElement);
    expect(screen.getByTestId("zoom-local-video")).toContainElement(
      localElement,
    );

    fireEvent.click(screen.getByRole("button", { name: /sair do encontro/i }));
    await screen.findByText(/você saiu/i);
  });

  it("allows therapist role 1 to end through the backend in the final window", async () => {
    const now = Date.now();
    const finalWindowAccess = {
      ...allowedAccess,
      scheduledEndsAt: new Date(now + 4 * 60_000).toISOString(),
      scheduledStartsAt: new Date(now - 46 * 60_000).toISOString(),
      serverNow: new Date(now).toISOString(),
    };
    const fetchMock = accessResponse(1, finalWindowAccess);
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ZoomVideoSessionAdapter
        access={finalWindowAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByText(/respons[aá]vel/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /encerrar para todos/i }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: /encerrar esta sessão/i,
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /encerrar para todos/i }),
    );

    expect(
      await screen.findByText(/você já pode compartilhar seu feedback/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/zoom/video-session-access",
      expect.objectContaining({
        body: JSON.stringify({
          actorRole: "therapist",
          bookingId: "96000000-0000-4000-8000-000000000001",
          intent: "end",
        }),
      }),
    );
    expect(mockClient.leave).toHaveBeenCalledWith(false);
    expect(mockClient.leave).not.toHaveBeenCalledWith(true);
    expect(destroyClient).toHaveBeenCalled();
    expect(mockStream.stopVideo).not.toHaveBeenCalled();
  });

  it("keeps therapist final end disabled before T-5", async () => {
    const now = Date.now();
    const accessBeforeFinalWindow = {
      ...allowedAccess,
      scheduledEndsAt: new Date(now + 6 * 60_000).toISOString(),
      scheduledStartsAt: new Date(now - 44 * 60_000).toISOString(),
      serverNow: new Date(now).toISOString(),
    };
    vi.stubGlobal("fetch", accessResponse(1, accessBeforeFinalWindow));

    render(
      <ZoomVideoSessionAdapter
        access={accessBeforeFinalWindow}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/respons[aá]vel/i);

    expect(
      screen.getByRole("button", {
        name: /disponível nos 5 minutos finais/i,
      }),
    ).toBeDisabled();
  });

  it("keeps the call recoverable when final end is rejected by the server", async () => {
    const now = Date.now();
    const finalWindowAccess = {
      ...allowedAccess,
      scheduledEndsAt: new Date(now + 4 * 60_000).toISOString(),
      scheduledStartsAt: new Date(now - 46 * 60_000).toISOString(),
      serverNow: new Date(now).toISOString(),
    };
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        intent?: string;
      };

      if (body.intent === "end") {
        return Promise.resolve({
          json: async () => ({
            data: { serverNow: finalWindowAccess.serverNow },
            error: { code: "FINAL_END_TOO_EARLY" },
            ok: false,
          }),
          ok: false,
        });
      }

      return accessResponse(1, finalWindowAccess)();
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={finalWindowAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/respons[aá]vel/i);
    mockClient.leave.mockClear();
    destroyClient.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: /encerrar para todos/i }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: /encerrar esta sessão/i,
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /encerrar para todos/i }),
    );

    expect(
      (await screen.findAllByText(/disponível nos 5 minutos finais/i)).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /sair da sessão/i }),
    ).toBeEnabled();
    expect(mockClient.leave).not.toHaveBeenCalled();
    expect(destroyClient).not.toHaveBeenCalled();
  });

  it("does not request access twice while loading", async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/session/refresh") {
        return Promise.resolve({ ok: true, status: 200 });
      }

      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    const button = screen.getByRole("button", { name: /entrar/i });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect(countAccessRequests(fetchMock, "join")).toBe(1);
    });
    resolveFetch({
      json: async () => ({
        error: { message: "A sala ainda esta em preparacao." },
        ok: false,
      }),
      ok: false,
    });

    expect(
      await screen.findByText(/n[aã]o foi poss[ií]vel validar esta sala/i),
    ).toBeInTheDocument();
  });

  it("fully disposes a stale client and rejoins with the same access payload", async () => {
    vi.useFakeTimers();
    const fetchMock = accessResponse(0);
    vi.stubGlobal("fetch", fetchMock);
    mockClient.join
      .mockResolvedValueOnce({
        errorCode: 5012,
        reason: "participant already exists",
        type: "INVALID_OPERATION",
      })
      .mockResolvedValueOnce("");

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(destroyClient).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/tentativa 2 de 3/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    expect(screen.getByText(/voc[eê] entrou no encontro/i)).toBeInTheDocument();
    expect(mockClient.join).toHaveBeenCalledTimes(2);
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.filter(([, init]) =>
        String((init as RequestInit | undefined)?.body).includes(
          '"intent":"join"',
        ),
      ),
    ).toHaveLength(1);
  });

  it("recovers the therapist initial entry when SDK init resolves with a transient failure", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", accessResponse(1));
    mockClient.init
      .mockResolvedValueOnce({
        errorCode: 2,
        reason: "internal error",
        type: "INTERNAL_ERROR",
      })
      .mockImplementationOnce(async () => {
        calls.push("init");
        return "" as const;
      });

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockClient.join).not.toHaveBeenCalled();
    expect(destroyClient).toHaveBeenCalled();
    expect(screen.getByText(/tentativa 2 de 3/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    expect(mockClient.init).toHaveBeenCalledTimes(2);
    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/respons[aá]vel/i)).toBeInTheDocument();
  });

  it("waits for destroyClient before creating the recovery client", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", accessResponse(0));
    let releaseDestroy: () => void = () => undefined;
    destroyClient.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseDestroy = resolve;
        }),
    );
    mockClient.join
      .mockResolvedValueOnce({
        errorCode: 5012,
        reason: "duplicated operation",
        type: "INVALID_OPERATION",
      })
      .mockResolvedValueOnce("");

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(createClient).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseDestroy();
      await vi.advanceTimersByTimeAsync(1_500);
    });

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/respons[aá]vel/i)).toBeInTheDocument();
  });

  it("waits for destroyClient from the previous route mount before creating a client", async () => {
    vi.stubGlobal("fetch", accessResponse(1));
    let releaseDestroy: () => void = () => undefined;
    destroyClient.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseDestroy = resolve;
        }),
    );

    const firstMount = render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/respons[aá]vel/i);
    firstMount.unmount();
    await waitFor(() => expect(destroyClient).toHaveBeenCalledTimes(1));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await Promise.resolve();
    expect(createClient).toHaveBeenCalledTimes(1);
    releaseDestroy();

    await waitFor(() => expect(createClient).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/respons[aá]vel/i)).toBeInTheDocument();
  });

  it("pauses a connected-session recovery while offline and resumes on online", async () => {
    vi.useFakeTimers();
    let online = true;
    vi.stubGlobal("navigator", {
      ...navigator,
      get onLine() {
        return online;
      },
    });
    vi.stubGlobal("fetch", accessResponse(0));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/voc[eê] entrou no encontro/i)).toBeInTheDocument();

    online = false;
    fireEvent(window, new Event("offline"));
    act(() => {
      handlers.get("connection-change")?.({
        errorCode: 5003,
        reason: "temporary network closure",
        state: "Closed",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/retomar a conexão automaticamente/i)).toBeInTheDocument();

    online = true;
    fireEvent(window, new Event("online"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    expect(createClient).toHaveBeenCalledTimes(2);
    expect(mockClient.join).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/voc[eê] entrou no encontro/i)).toBeInTheDocument();
  });

  it("recovers a transient Closed event instead of treating it as session end", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", accessResponse(0));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      handlers.get("connection-change")?.({
        errorCode: 5003,
        reason: "session temporarily closed",
        state: "Closed",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    expect(mockClient.join).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/voc[eê] entrou no encontro/i)).toBeInTheDocument();
  });

  it("does not retry when Closed means the host ended the session", async () => {
    vi.stubGlobal("fetch", accessResponse(0));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);

    act(() => {
      handlers.get("connection-change")?.({
        errorCode: 4004,
        reason: "session ended by host",
        state: "Closed",
      });
    });

    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/confirmação do encontro ficará disponível/i),
    ).toBeInTheDocument();
  });

  it("stops after three SDK attempts and explains the reload fallback", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.join.mockResolvedValue({
      errorCode: 5012,
      reason: "participant already exists",
      type: "INVALID_OPERATION",
    });

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(mockClient.join).toHaveBeenCalledTimes(3);
    expect(
      screen.getByText(
        /seu encontro, horário e pagamento não serão alterados/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /recarregar sala/i }),
    ).toBeVisible();
  });

  it("refreshes authentication and replays a rejected access request only once", async () => {
    let joinRequests = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/session/refresh") {
        return Promise.resolve({ ok: true });
      }

      joinRequests += 1;
      if (joinRequests === 1) {
        return Promise.resolve({
          json: async () => ({
            error: { requestId: "request-401" },
            ok: false,
          }),
          ok: false,
          status: 401,
        });
      }

      return accessResponse(1)();
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByText(/respons[aá]vel/i)).toBeInTheDocument();
    expect(joinRequests).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session/refresh",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("stops before requesting Zoom access when the authenticated session expired", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/session/refresh") {
        return Promise.resolve({ ok: false, status: 401 });
      }

      return accessResponse(0)();
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      await screen.findByText(/entre novamente na sua conta/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /entrar novamente/i }),
    ).toHaveAttribute("href", "/cliente/login");
    expect(countAccessRequests(fetchMock, "join")).toBe(0);
    expect(mockClient.join).not.toHaveBeenCalled();
  });

  it("treats a resolved leave failure as an incomplete cleanup", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.leave.mockResolvedValueOnce({
      errorCode: 2,
      reason: "internal error",
      type: "INTERNAL_ERROR",
    });

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    fireEvent.click(screen.getByRole("button", { name: /sair do encontro/i }));

    expect(
      await screen.findByText(
        /n[aã]o foi poss[ií]vel concluir todas as etapas/i,
      ),
    ).toBeInTheDocument();
  });

  it("offers safe recovery actions without exposing the provider error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          error: {
            message: "Token expirado.",
            requestId: "request-safe-12345678",
          },
          ok: false,
        }),
        ok: false,
      }),
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      await screen.findByText(/n[aã]o foi poss[ií]vel validar esta sala/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/token expirado/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /tentar novamente/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /recarregar sala/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copiar referência/i }));
    expect(await screen.findByText(/referencia copiada/i)).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringMatching(/5013-12345678/i),
    );
  });

  it("shows the receiving-account prerequisite returned by access policy", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/session/refresh") {
        return Promise.resolve({ ok: true, status: 200 });
      }

      return Promise.resolve({
        json: async () => ({
          error: {
            code: "therapist_receiving_account_required",
            message: "raw backend details must stay private",
            requestId: "request-receiving-0001",
          },
          ok: false,
        }),
        ok: false,
        status: 403,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      await screen.findByText(/conclua o cadastro da sua conta de recebimento/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw backend details/i)).not.toBeInTheDocument();
    expect(mockClient.join).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /recarregar sala/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps patient waiting without issuing a join token until therapist is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        data: { access: allowedAccess },
        ok: true,
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={{
          ...allowedAccess,
          allowed: false,
          reason: ZoomAccessReason.TherapistNotInSession,
          serverNow: "2026-07-26T12:46:00.000Z",
        }}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    expect(
      screen.getByText(
        /entrada será liberada assim que a presença do terapeuta/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entrar/i })).toBeNull();

    expect(
      await screen.findByRole("button", { name: /entrar/i }),
    ).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/zoom/video-session-access",
      expect.objectContaining({
        body: JSON.stringify({
          actorRole: "patient",
          bookingId: "96000000-0000-4000-8000-000000000001",
          intent: "preview",
        }),
      }),
    );
    expect(document.body.textContent).not.toMatch(/jwt-token|secret|token/i);
  });

  it("recovers a stalled preview and transitions automatically when the therapist joins", async () => {
    vi.useFakeTimers();
    const waitingAccess = {
      ...allowedAccess,
      allowed: false,
      reason: ZoomAccessReason.TherapistNotInSession,
      serverNow: "2026-07-26T12:46:00.000Z",
    };
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      )
      .mockResolvedValueOnce({
        json: async () => ({ data: { access: allowedAccess }, ok: true }),
        ok: true,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={waitingAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /atualizando/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(
      screen.getByText(/tentaremos novamente automaticamente/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /atualizar sala/i }),
    ).toBeEnabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_500);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: /entrar na sala/i }),
    ).toBeEnabled();
    expect(
      screen.queryByText(
        /entrada será liberada assim que a presença do terapeuta/i,
      ),
    ).toBeNull();
  });

  it("previews patient access before showing join when server data is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          access: {
            ...allowedAccess,
            allowed: false,
            reason: ZoomAccessReason.TherapistNotInSession,
            serverNow: "2026-07-26T12:46:00.000Z",
          },
        },
        ok: true,
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={null}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    expect(screen.getByRole("button", { name: /atualizando/i })).toBeDisabled();
    expect(
      await screen.findByText(/sua chegada foi registrada/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/zoom/video-session-access",
      expect.objectContaining({
        body: JSON.stringify({
          actorRole: "patient",
          bookingId: "96000000-0000-4000-8000-000000000001",
          intent: "preview",
        }),
      }),
    );
  });

  it("retries the initial preview after an upstream failure", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          error: { message: "upstream timeout" },
          ok: false,
        }),
        ok: false,
      })
      .mockResolvedValueOnce({
        json: async () => ({ data: { access: allowedAccess }, ok: true }),
        ok: true,
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={null}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/tentaremos novamente automaticamente/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /atualizar sala/i }),
    ).toBeEnabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: /entrar na sala/i }),
    ).toBeEnabled();
  });

  it("cancels a pending join access request when leaving the page", async () => {
    let aborted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              aborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    const view = render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    view.unmount();

    await act(async () => {
      await Promise.resolve();
    });
    expect(aborted).toBe(true);
  });

  it("reports cleanup failures instead of hiding them", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.leave.mockRejectedValueOnce(new Error("leave failed"));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    fireEvent.click(screen.getByRole("button", { name: /sair do encontro/i }));

    expect(
      await screen.findByText(
        /n[aã]o foi poss[ií]vel concluir todas as etapas/i,
      ),
    ).toBeInTheDocument();
  });
});

describe("formatScheduledSessionCountdown", () => {
  it("uses scheduled booking times and never the watchdog", () => {
    const access = {
      ...allowedAccess,
      hardEndsAt: "2026-08-25T21:55:00.000Z",
      scheduledEndsAt: "2026-08-25T18:35:00.000Z",
      scheduledStartsAt: "2026-08-25T17:45:00.000Z",
    };

    expect(
      formatScheduledSessionCountdown({
        access,
        actorRole: "patient",
        clientNowMs: Date.parse("2026-08-25T17:38:00.000Z"),
        serverClockOffsetMs: 0,
      }),
    ).toBe("O encontro começa em 07:00");
    expect(
      formatScheduledSessionCountdown({
        access,
        actorRole: "patient",
        clientNowMs: Date.parse("2026-08-25T17:55:00.000Z"),
        serverClockOffsetMs: 0,
      }),
    ).toBe("Tempo restante do encontro: 40:00");
  });
});

describe("formatActiveSessionCountdown", () => {
  const access = {
    ...allowedAccess,
    scheduledEndsAt: "2026-08-25T18:35:00.000Z",
    scheduledStartsAt: "2026-08-25T17:45:00.000Z",
  };

  it("hides the pre-start countdown in the active video room", () => {
    expect(
      formatActiveSessionCountdown({
        access,
        actorRole: "patient",
        clientNowMs: Date.parse("2026-08-25T17:44:59.999Z"),
        serverClockOffsetMs: 0,
      }),
    ).toBe("");
  });

  it("shows the scheduled end countdown after the session starts", () => {
    expect(
      formatActiveSessionCountdown({
        access,
        actorRole: "therapist",
        clientNowMs: Date.parse("2026-08-25T17:55:00.000Z"),
        serverClockOffsetMs: 0,
      }),
    ).toBe("Tempo restante da sessão: 40:00");
  });
});

describe("isFinalEndAvailable", () => {
  const endsAt = "2026-08-25T18:35:00.000Z";

  it("opens exactly at T-5 and closes at the scheduled end", () => {
    expect(
      isFinalEndAvailable({
        access: null,
        clientNowMs: Date.parse("2026-08-25T18:29:59.999Z"),
        fallbackEndsAt: endsAt,
        serverClockOffsetMs: 0,
      }),
    ).toBe(false);
    expect(
      isFinalEndAvailable({
        access: null,
        clientNowMs: Date.parse("2026-08-25T18:30:00.000Z"),
        fallbackEndsAt: endsAt,
        serverClockOffsetMs: 0,
      }),
    ).toBe(true);
    expect(
      isFinalEndAvailable({
        access: null,
        clientNowMs: Date.parse(endsAt),
        fallbackEndsAt: endsAt,
        serverClockOffsetMs: 0,
      }),
    ).toBe(false);
  });
});

function accessResponse(roleType: 0 | 1, access = allowedAccess) {
  return vi.fn((url?: string, _init?: RequestInit) => {
    if (url === "/api/auth/session/refresh") {
      return Promise.resolve({ ok: true, status: 200 });
    }

    return Promise.resolve({
      json: async () => ({
        data: {
          access,
          requestId: "request-access-0001",
          roleType,
          sdkKey: "public-sdk-key",
          sessionName: "tesvs-session",
          sessionPasscode: null,
          token: `jwt-token-role-${roleType}`,
          userName: roleType === 1 ? "Terapeuta" : "Paciente",
        },
        ok: true,
      }),
      ok: true,
      status: 200,
    });
  });
}

function countAccessRequests(
  fetchMock: ReturnType<typeof vi.fn>,
  intent: "join" | "preview",
) {
  return fetchMock.mock.calls.filter(([url, init]) => {
    if (url !== "/api/zoom/video-session-access") return false;
    if (!init || typeof init !== "object" || typeof init.body !== "string") {
      return false;
    }

    return JSON.parse(init.body).intent === intent;
  }).length;
}
