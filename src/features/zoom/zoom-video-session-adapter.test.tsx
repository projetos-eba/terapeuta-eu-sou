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
let localElement: HTMLElement = document.createElement("video");
const mockClient = {
  getAllUser: vi.fn(
    (): Array<{
      bVideoOn?: boolean;
      displayName?: string;
      userKey?: string;
      userId: number;
    }> => [],
  ),
  getCurrentUserInfo: vi.fn(
    ():
      | { bVideoOn?: boolean; userId: number; userKey?: string }
      | undefined => ({
      bVideoOn: true,
      userId: 7,
      userKey: "tes-v1-p-local-participant",
    }),
  ),
  getUser: vi.fn(
    (
      userId: number,
    ): { bVideoOn?: boolean; userId: number; userKey?: string } | undefined =>
      mockClient.getAllUser().find((user) => user.userId === userId),
  ),
  getMediaStream: vi.fn(() => mockStream),
  init: vi.fn(async (): Promise<"" | MockExecutedFailure> => {
    calls.push("init");
    return "" as const;
  }),
  join: vi.fn(async (): Promise<unknown> => {
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
  attachVideo: vi.fn(
    async (userId: number, _quality?: number, element?: HTMLElement) => {
      if (element) {
        localElement = element;
        element.setAttribute("node-id", String(userId));
        return element;
      }
      return userId === 7 ? localElement : remoteElement;
    },
  ),
  detachVideo: vi.fn(async (_userId: number, element?: HTMLElement) => {
    element?.setAttribute("node-id", "0");
    return element;
  }),
  muteAudio: vi.fn(async () => "" as const),
  startAudio: vi.fn(async (): Promise<"" | MockExecutedFailure> => "" as const),
  // SDK 2.4.5 resolves capture success without a value (not ExecutedResult).
  startVideo: vi.fn(async (): Promise<unknown> => undefined),
  stopAudio: vi.fn(async () => "" as const),
  stopRenderVideo: vi.fn(async () => undefined),
  stopVideo: vi.fn(async () => "" as const),
  unmuteAudio: vi.fn(async () => "" as const),
};

function getLocalAttachCalls(userId = 7) {
  return mockStream.attachVideo.mock.calls.filter(
    ([candidateUserId]) => candidateUserId === userId,
  );
}

function expectLocalAttach(userId = 7) {
  expect(getLocalAttachCalls(userId)).toContainEqual([
    userId,
    2,
    expect.any(HTMLElement),
  ]);
}

function bindLocalMockPlayer(userId: number, element?: HTMLElement) {
  if (!element) return localElement;
  localElement = element;
  element.setAttribute("node-id", String(userId));
  return element;
}
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
  afterEach(async () => {
    vi.useRealTimers();
    cleanup();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    calls.length = 0;
    handlers.clear();
    remoteElement.remove();
    localElement.remove();
    localElement = document.createElement("video");
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
    mockClient.getCurrentUserInfo.mockReturnValue({
      bVideoOn: true,
      userId: 7,
      userKey: "tes-v1-p-local-participant",
    });
    mockClient.getUser.mockImplementation((userId: number) =>
      mockClient.getAllUser().find((user) => user.userId === userId),
    );
    mockStream.attachVideo.mockImplementation(
      async (userId: number, _quality?: number, element?: HTMLElement) => {
        if (element) {
          localElement = element;
          element.setAttribute("node-id", String(userId));
          return element;
        }
        return userId === 7 ? localElement : remoteElement;
      },
    );
    mockStream.detachVideo.mockImplementation(
      async (_userId: number, element?: HTMLElement) => {
        element?.setAttribute("node-id", "0");
        return element;
      },
    );
    mockStream.muteAudio.mockResolvedValue("" as const);
    mockStream.startAudio.mockResolvedValue("" as const);
    mockStream.startVideo.mockResolvedValue(undefined);
    mockStream.stopAudio.mockResolvedValue("" as const);
    mockStream.stopVideo.mockResolvedValue("" as const);
    mockStream.unmuteAudio.mockResolvedValue("" as const);
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

  it("defers mobile camera publication until the in-room activation click", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      vendor: "Apple Computer, Inc.",
      maxTouchPoints: 5,
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
    await screen.findByRole("button", { name: "Ativar minha câmera" });
    expect(mockStream.startVideo).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Ativar minha câmera" }),
    );
    await waitFor(() => expect(mockStream.startVideo).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Câmera ativada.")).toBeInTheDocument();
    expect(mockStream.attachVideo).toHaveBeenCalledWith(7, 2);
    expect(screen.getByTestId("zoom-local-video")).toContainElement(
      localElement,
    );
  });

  it("keeps the therapist in the room when initial audio setup resolves with a transient failure", async () => {
    vi.stubGlobal("fetch", accessResponse(1));
    mockStream.startAudio.mockResolvedValueOnce({
      errorCode: 2,
      reason: "internal error",
      type: "INTERNAL_ERROR",
    });

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      await screen.findByText(
        /você entrou na sessão, mas não foi possível preparar o áudio/i,
      ),
    ).toBeInTheDocument();
    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(mockClient.leave).not.toHaveBeenCalled();
    expect(destroyClient).not.toHaveBeenCalled();
    expect(mockStream.startAudio).toHaveBeenCalledWith({ mute: true });
    expect(
      screen.getByRole("button", { name: /sair da sessão/i }),
    ).toBeEnabled();
  });

  it("accepts the installed SDK join participant payload instead of manufacturing error 2", async () => {
    vi.stubGlobal("fetch", accessResponse(1));
    mockClient.join.mockResolvedValueOnce({
      userId: 7,
      displayName: "Local participant",
    });
    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(
      await screen.findByText(/você entrou como responsável/i),
    ).toBeInTheDocument();
    expect(mockClient.leave).not.toHaveBeenCalled();
    expect(destroyClient).not.toHaveBeenCalled();
  });

  it("uses the participant returned by join before an incomplete current-user snapshot", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.join.mockResolvedValueOnce({
      displayName: "Paciente",
      userId: 7,
      userKey: "tes-v1-p-local-participant",
    });
    mockClient.getCurrentUserInfo.mockReturnValueOnce({ userId: 0 });
    mockClient.getAllUser.mockReturnValue([
      {
        bVideoOn: true,
        userId: 7,
        userKey: "tes-v1-p-local-participant",
      },
      {
        bVideoOn: true,
        userId: 9,
        userKey: "tes-v1-t-remote-participant",
      },
    ]);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);

    expect(getLocalAttachCalls()).toHaveLength(0);
    expect(mockStream.attachVideo).toHaveBeenCalledWith(9, 2);
    expect(screen.getByTestId("zoom-remote-video")).not.toContainElement(
      localElement,
    );
    expect(screen.getByTestId("zoom-remote-video")).toContainElement(
      remoteElement,
    );
  });

  it("blocks remote rendering until the local participant identity becomes authoritative", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.getCurrentUserInfo.mockReturnValue({ userId: 0 });
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: false, userId: 7, userKey: "tes-v1-p-local" },
      { bVideoOn: true, userId: 9, userKey: "tes-v1-t-remote" },
    ]);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    expect(mockStream.attachVideo).not.toHaveBeenCalled();

    mockClient.getCurrentUserInfo.mockReturnValue({
      userId: 7,
      userKey: "tes-v1-p-local",
    });
    act(() => {
      handlers.get("connection-change")?.({ state: "Connected" });
    });

    await waitFor(() =>
      expect(mockStream.attachVideo).toHaveBeenCalledWith(9, 2),
    );
    expect(screen.getByTestId("zoom-remote-video")).toContainElement(
      remoteElement,
    );
  });

  it("recovers the published patient self-view when local identity becomes available after join", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.getCurrentUserInfo.mockReturnValue({ userId: 0 });
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 7, userKey: "tes-v1-p-local" },
      { bVideoOn: true, userId: 9, userKey: "tes-v1-t-remote" },
    ]);

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

    await screen.findByText(/sem prévia neste dispositivo/i);
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(getLocalAttachCalls()).toHaveLength(0);

    mockClient.getCurrentUserInfo.mockReturnValue({
      userId: 7,
      userKey: "tes-v1-p-local",
    });
    act(() => {
      handlers.get("connection-change")?.({ state: "Connected" });
    });

    await waitFor(() => {
      expectLocalAttach();
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      );
      expect(screen.getByTestId("zoom-remote-video")).toContainElement(
        remoteElement,
      );
    });
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/sem prévia neste dispositivo/i),
    ).not.toBeInTheDocument();
  });

  it("does not describe the local participant user-added event as another person", async () => {
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
      handlers.get("user-added")?.([
        { userId: 7, userKey: "tes-v1-p-local-participant" },
      ]);
    });

    expect(
      screen.queryByText(/a outra pessoa entrou no encontro/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/voc[eê] entrou no encontro/i)).toBeInTheDocument();
  });

  it("recovers preflight camera and microphone with delayed identity through roster timers, without rejoining", async () => {
    const fetchMock = accessResponse(0);
    vi.stubGlobal("fetch", fetchMock);
    const track = { stop: vi.fn() };
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    mockClient.getCurrentUserInfo.mockReturnValue(undefined);
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 7, userKey: "tes-v1-p-local" },
      { bVideoOn: true, userId: 9, userKey: "tes-v1-t-remote" },
    ]);
    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Testar câmera" })[0],
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Sua prévia de câmera está pronta.",
      ),
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Testar áudio" })[0]);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Seu microfone está sendo testado agora.",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar na sala/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(mockStream.unmuteAudio).toHaveBeenCalledTimes(1);
    expect(mockStream.attachVideo).not.toHaveBeenCalled();
    mockClient.getCurrentUserInfo.mockReturnValue({
      userId: 7,
      userKey: "tes-v1-p-local",
    });
    // No Connected or peer event: the existing bounded resync must repair both tiles.
    await waitFor(
      () => {
        expect(screen.getByTestId("zoom-local-video")).toContainElement(
          localElement,
        );
        expect(screen.getByTestId("zoom-remote-video")).toContainElement(
          remoteElement,
        );
      },
      { timeout: 2_000 },
    );
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(countAccessRequests(fetchMock, "join")).toBe(1);
    expect(track.stop).toHaveBeenCalled();
  });

  it("bounds failed self-view retries and lets the patient retry preview without restarting publication", async () => {
    const fetchMock = accessResponse(0);
    vi.stubGlobal("fetch", fetchMock);
    mockClient.getAllUser.mockReturnValue([{ userId: 9, bVideoOn: true }]);
    let previewAvailable = false;
    mockStream.attachVideo.mockImplementation(
      async (userId, _quality, element) => {
        if (userId === 7 && !previewAvailable)
          throw new Error("preview unavailable");
        return userId === 7
          ? bindLocalMockPlayer(userId, element)
          : remoteElement;
      },
    );
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
    await screen.findByText(/sem prévia neste dispositivo/i);
    const selfAttaches = () =>
      mockStream.attachVideo.mock.calls.filter(([id]) => id === 7);
    await waitFor(() => expect(selfAttaches()).toHaveLength(3), {
      timeout: 2_000,
    });
    act(() => {
      handlers.get("user-updated")?.([{ userId: 7 }]);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(selfAttaches()).toHaveLength(3);
    expect(screen.getByTestId("zoom-remote-video")).toContainElement(
      remoteElement,
    );
    previewAvailable = true;
    fireEvent.click(
      screen.getByRole("button", { name: "Tentar mostrar minha câmera" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      ),
    );
    expect(selfAttaches()).toHaveLength(4);
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(mockStream.stopVideo).not.toHaveBeenCalled();
    expect(mockClient.leave).not.toHaveBeenCalled();
    expect(countAccessRequests(fetchMock, "join")).toBe(1);
  });

  it("attaches the mobile self-view when the roster lags behind published video", async () => {
    const fetchMock = accessResponse(0);
    vi.stubGlobal("fetch", fetchMock);
    let providerReflectsVideo = false;
    mockClient.getCurrentUserInfo.mockImplementation(() => ({
      bVideoOn: providerReflectsVideo,
      userId: 7,
      userKey: "tes-v1-p-local-participant",
    }));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    fireEvent.click(screen.getByRole("button", { name: /ativar c.mera/i }));
    await waitFor(
      () =>
        expect(screen.getByTestId("zoom-local-video")).toContainElement(
          localElement,
        ),
      { timeout: 2_000 },
    );
    // On iPhone the SDK may publish first and expose bVideoOn later, without
    // emitting another roster event. Rendering must not wait for that flag.
    expect(providerReflectsVideo).toBe(false);
    expect(
      screen.queryByRole("button", { name: /tentar mostrar minha c.mera/i }),
    ).not.toBeInTheDocument();
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(countAccessRequests(fetchMock, "join")).toBe(1);
  });

  it("recovers the patient self-view when capture becomes ready after an abrupt reentry", async () => {
    const fetchMock = accessResponse(0);
    vi.stubGlobal("fetch", fetchMock);
    const reenteredLocalUserId = 17;
    const localUserKey = "tes-v1-p-local-participant";
    let captureReady = false;

    mockClient.join.mockImplementation(async () => {
      calls.push("join");
      return { userId: reenteredLocalUserId, userKey: localUserKey };
    });
    mockClient.getCurrentUserInfo.mockReturnValue({
      userId: reenteredLocalUserId,
      userKey: localUserKey,
    });
    mockClient.getAllUser.mockReturnValue([
      // The provider may retain the connection that disappeared without leave.
      { bVideoOn: true, userId: 7, userKey: localUserKey },
      {
        bVideoOn: true,
        userId: reenteredLocalUserId,
        userKey: localUserKey,
      },
      { bVideoOn: true, userId: 9, userKey: "tes-v1-t-remote" },
    ]);
    mockStream.attachVideo.mockImplementation(
      async (userId: number, _quality?: number, element?: HTMLElement) => {
        if (userId === reenteredLocalUserId) {
          if (!captureReady) {
            throw { errorCode: 2, type: "INTERNAL_ERROR" };
          }
          return bindLocalMockPlayer(userId, element);
        }
        return remoteElement;
      },
    );

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    // A full browser restart loses the transient waiting-room media snapshot.
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    await waitFor(() =>
      expect(screen.getByTestId("zoom-remote-video")).toContainElement(
        remoteElement,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));
    await screen.findByText(/sem prévia neste dispositivo/i);
    await waitFor(
      () => {
        expect(
          mockStream.attachVideo.mock.calls.filter(
            ([userId]) => userId === reenteredLocalUserId,
          ),
        ).toHaveLength(3);
      },
      { timeout: 2_000 },
    );

    captureReady = true;
    act(() => {
      handlers.get("video-capturing-change")?.({ state: "Started" });
    });

    await waitFor(() =>
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      ),
    );
    expect(screen.getByTestId("zoom-remote-video")).toContainElement(
      remoteElement,
    );
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(countAccessRequests(fetchMock, "join")).toBe(1);
    expect(getLocalAttachCalls()).toHaveLength(0);
  });

  it("retries after capture readiness when the provisional self-view attach is still pending", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    let rejectProvisional!: (reason: unknown) => void;
    const provisionalAttach = new Promise<HTMLVideoElement>(
      (_resolve, reject) => {
        rejectProvisional = reject;
      },
    );
    let localAttempts = 0;
    mockStream.attachVideo.mockImplementation(
      async (userId: number, _quality?: number, element?: HTMLElement) => {
        if (userId !== 7) return remoteElement;
        localAttempts += 1;
        if (localAttempts === 1) return provisionalAttach;
        return bindLocalMockPlayer(userId, element);
      },
    );

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
    await waitFor(() => expect(localAttempts).toBe(1));

    act(() => {
      handlers.get("video-capturing-change")?.({ state: "Started" });
      rejectProvisional({ errorCode: 2, type: "INTERNAL_ERROR" });
    });

    await waitFor(() =>
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      ),
    );
    expect(localAttempts).toBe(2);
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(mockClient.join).toHaveBeenCalledTimes(1);
  });

  it.each(["stop", "unmount"] as const)(
    "discards a pending recovery self-view on %s and never duplicates its attach",
    async (action) => {
      vi.stubGlobal("fetch", accessResponse(0));
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let localAttempts = 0;
      mockStream.attachVideo.mockImplementation(
        async (userId, _quality, element) => {
          if (userId !== 7) return remoteElement;
          if (++localAttempts === 1)
            throw new Error("initial preview unavailable");
          await gate;
          return bindLocalMockPlayer(userId, element);
        },
      );
      const view = render(
        <ZoomVideoSessionAdapter
          access={allowedAccess}
          actorRole="patient"
          bookingId="96000000-0000-4000-8000-000000000001"
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
      await screen.findByText(/voc[eê] entrou no encontro/i);
      fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));
      await waitFor(() => expect(localAttempts).toBe(2));
      act(() => {
        handlers.get("user-updated")?.([{ userId: 7 }]);
        handlers.get("connection-change")?.({ state: "Connected" });
      });
      if (action === "unmount") view.unmount();
      else {
        fireEvent.click(
          screen.getByRole("button", { name: /desligar câmera/i }),
        );
        await waitFor(() =>
          expect(mockStream.stopVideo).toHaveBeenCalledTimes(1),
        );
      }
      expect(localAttempts).toBe(2);
      expect(destroyClient).not.toHaveBeenCalled();
      await act(async () => {
        release();
      });
      await waitFor(() => {
        expect(mockStream.detachVideo).toHaveBeenCalledWith(7, localElement);
        expect(localElement.getAttribute("node-id")).toBe("0");
      });
      if (action === "unmount") {
        expect(localElement.isConnected).toBe(false);
        await waitFor(() => expect(destroyClient).toHaveBeenCalledTimes(1));
      } else {
        expect(localElement.isConnected).toBe(true);
        expect(
          screen.getByRole("button", { name: /ativar câmera/i }),
        ).toBeEnabled();
        expect(mockClient.leave).not.toHaveBeenCalled();
      }
    },
  );

  it("does not expose a teardown warning when active remote rendering cleanup fails", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: false, userId: 7, userKey: "tes-v1-p-local-participant" },
      { bVideoOn: true, userId: 9, userKey: "tes-v1-t-remote" },
    ]);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    await waitFor(() =>
      expect(screen.getByTestId("zoom-remote-video")).toContainElement(
        remoteElement,
      ),
    );

    mockStream.detachVideo.mockRejectedValueOnce(new Error("detach failed"));
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: false, userId: 7, userKey: "tes-v1-p-local-participant" },
    ]);
    act(() => {
      handlers.get("user-removed")?.([
        { userId: 9, userKey: "tes-v1-t-remote" },
      ]);
    });
    await waitFor(() => expect(remoteElement.isConnected).toBe(false));

    expect(
      screen.queryByText(/algumas etapas de encerramento falharam/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sair do encontro/i }),
    ).toBeEnabled();
  });

  it("does not render another device from the local TES identity as the remote participant", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.join.mockResolvedValueOnce({
      userId: 7,
      userKey: "tes-v1-p-same-profile",
    });
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 7, userKey: "tes-v1-p-same-profile" },
      { bVideoOn: true, userId: 8, userKey: "tes-v1-p-same-profile" },
      { bVideoOn: true, userId: 9, userKey: "tes-v1-t-counterpart" },
    ]);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);

    expect(mockStream.attachVideo).not.toHaveBeenCalledWith(8, 2);
    expect(mockStream.attachVideo).toHaveBeenCalledWith(9, 2);
  });

  it("selects only one stable device for the remote TES identity", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.join.mockResolvedValueOnce({
      userId: 7,
      userKey: "tes-v1-p-local",
    });
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: false, userId: 7, userKey: "tes-v1-p-local" },
      { bVideoOn: true, userId: 9, userKey: "tes-v1-t-counterpart" },
      { bVideoOn: true, userId: 10, userKey: "tes-v1-t-counterpart" },
    ]);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);

    const remoteAttachCalls = mockStream.attachVideo.mock.calls.filter(
      ([userId]) => userId === 9 || userId === 10,
    );
    expect(remoteAttachCalls).toHaveLength(1);
    expect(
      screen
        .getByTestId("zoom-remote-video")
        .querySelectorAll("video, video-player"),
    ).toHaveLength(1);
  });

  it("fails closed when more than one distinct remote TES identity is present", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.join.mockResolvedValueOnce({
      userId: 7,
      userKey: "tes-v1-p-local",
    });
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: false, userId: 7, userKey: "tes-v1-p-local" },
      { bVideoOn: true, userId: 9, userKey: "tes-v1-t-first" },
      { bVideoOn: true, userId: 10, userKey: "tes-v1-t-second" },
    ]);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);

    expect(mockStream.attachVideo).not.toHaveBeenCalledWith(9, 2);
    expect(mockStream.attachVideo).not.toHaveBeenCalledWith(10, 2);
    expect(screen.getByTestId("zoom-remote-video")).not.toContainElement(
      remoteElement,
    );
  });

  it("preserves the ZoomVideo receiver when destroying the client", async () => {
    vi.stubGlobal("fetch", accessResponse(1));
    destroyClient.mockImplementationOnce(function (this: unknown) {
      expect(this).toMatchObject({ createClient, destroyClient });
      calls.push("destroy");
    });
    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/responsável/i);
    fireEvent.click(screen.getByRole("button", { name: /sair da sessão/i }));
    expect(await screen.findByText(/você saiu da sessão/i)).toBeInTheDocument();
    expect(destroyClient).toHaveBeenCalledTimes(1);
  });

  it("distinguishes joined media initialization from a rejected audio start and recovers only audio", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = accessResponse(1);
    vi.stubGlobal("fetch", fetchMock);
    let rejectAudio: (error: unknown) => void = () => undefined;
    mockStream.startAudio.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectAudio = reject;
        }),
    );
    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/você entrou. preparando/i);
    expect(
      screen.getByRole("region", { name: "Sala de video" }),
    ).toHaveAttribute("data-session-state", "media_initializing");
    expect(
      screen.getByRole("button", { name: /sair da sessão/i }),
    ).toBeEnabled();
    act(() => {
      handlers.get("connection-change")?.({ state: "Connected" });
    });
    await act(async () => {
      rejectAudio({
        errorCode: 2,
        reason: "audio init",
        type: "INTERNAL_ERROR",
      });
    });
    expect(
      screen.getByRole("region", { name: "Sala de video" }),
    ).toHaveAttribute("data-session-state", "media_degraded");
    expect(
      warn.mock.calls.map(([line]) => JSON.parse(String(line))),
    ).toContainEqual(
      expect.objectContaining({
        code: 2,
        phase: "audio",
        operation: "audio.start",
        joinConfirmed: true,
        connectionState: "Connected",
      }),
    );
    expect(mockClient.leave).not.toHaveBeenCalled();
    act(() => {
      handlers.get("connection-change")?.({ state: "Reconnecting" });
      handlers.get("connection-change")?.({ state: "Connected" });
    });
    expect(
      screen.getByRole("region", { name: "Sala de video" }),
    ).toHaveAttribute("data-session-state", "media_degraded");
    fireEvent.click(screen.getByRole("button", { name: /ativar microfone/i }));
    await waitFor(() => expect(mockStream.startAudio).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Sala de video" }),
      ).toHaveAttribute("data-session-state", "joined"),
    );
    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(countAccessRequests(fetchMock, "join")).toBe(1);
    warn.mockRestore();
  });

  it("rejoins with a fresh client and the same JWT after a Closed event during media startup", async () => {
    vi.useFakeTimers();
    const fetchMock = accessResponse(1);
    vi.stubGlobal("fetch", fetchMock);
    mockStream.startAudio.mockImplementationOnce(async () => {
      handlers.get("connection-change")?.({ state: "Closed", errorCode: 5003 });
      return "";
    });
    const secondClient = {
      ...mockClient,
      join: vi.fn(async () => ({ userId: 8 })),
    };
    createClient
      .mockReturnValueOnce(mockClient)
      .mockReturnValueOnce(secondClient);
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
    expect(
      screen.getByRole("region", { name: "Sala de video" }),
    ).toHaveAttribute("data-session-state", "joined");
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(destroyClient).toHaveBeenCalledTimes(1);
    expect(secondClient.join.mock.calls[0]).toEqual(
      mockClient.join.mock.calls[0],
    );
    expect(countAccessRequests(fetchMock, "join")).toBe(1);
  });

  it("refreshes two waiting devices through host absence, presence, and absence again without issuing JWTs", async () => {
    vi.useFakeTimers();
    let present = false;
    let unavailable = false;
    const fetchMock = vi.fn(async () => ({
      ok: !unavailable,
      json: async () => ({
        ok: !unavailable,
        data: {
          access: {
            ...allowedAccess,
            allowed: present,
            reason: present ? null : ZoomAccessReason.TherapistNotInSession,
          },
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const waiting = {
      ...allowedAccess,
      allowed: false,
      reason: ZoomAccessReason.TherapistNotInSession,
    };
    const deviceA = render(
      <ZoomVideoSessionAdapter
        access={waiting}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    const deviceB = render(
      <ZoomVideoSessionAdapter
        access={waiting}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const entries = () =>
      [deviceA, deviceB].map((device) =>
        within(device.container).queryByRole("button", {
          name: /entrar na sala/i,
        }),
      );
    entries().forEach((button) => expect(button).toBeNull());
    present = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    entries().forEach((button) => expect(button).toBeEnabled());
    present = false;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    entries().forEach((button) => expect(button).toBeNull());
    present = true;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    entries().forEach((button) => expect(button).toBeEnabled());
    unavailable = true;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    entries().forEach((button) => expect(button).toBeNull());
    expect(mockClient.join).not.toHaveBeenCalled();
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
      mockStream.startVideo.mockImplementation(async () => {
        expect(
          screen
            .getByTestId("zoom-local-video")
            .querySelector("video-player"),
        ).toBeInTheDocument();
        return undefined;
      });

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
        expectLocalAttach();
        expect(screen.getByTestId("zoom-local-video")).toContainElement(
          localElement,
        );
        expect(
          screen.getByRole("button", { name: /silenciar microfone/i }),
        ).toBeEnabled();
        expect(
          screen.getByRole("button", { name: /desligar câmera/i }),
        ).toBeEnabled();
      });
      expect(cameraTrack.stop).toHaveBeenCalled();
      expect(audioTrack.stop).toHaveBeenCalled();
      expect(cameraTrack.stop.mock.invocationCallOrder[0]).toBeLessThan(
        mockStream.startVideo.mock.invocationCallOrder[0],
      );
      expect(audioTrack.stop.mock.invocationCallOrder[0]).toBeLessThan(
        mockStream.startAudio.mock.invocationCallOrder[0],
      );
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

    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 7 },
      { bVideoOn: true, userId: 9 },
    ]);

    handlers.get("peer-video-state-change")?.({ action: "Start", userId: 9 });

    expect(await screen.findByLabelText(/vídeo remoto/i)).toContainElement(
      remoteElement,
    );

    fireEvent.click(screen.getByRole("button", { name: /sair do encontro/i }));
    expect(await screen.findByText(/você saiu/i)).toBeInTheDocument();
    expect(screen.queryByText(/como foi seu encontro/i)).toBeNull();
    expect(mockStream.detachVideo).toHaveBeenCalledWith(9, remoteElement);
    expect(destroyClient).toHaveBeenCalled();
  });

  it("attaches each remote participant only once when Zoom emits concurrent events", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    let releaseAttach: (() => void) | undefined;
    const attachGate = new Promise<void>((resolve) => {
      releaseAttach = resolve;
    });
    mockStream.attachVideo.mockImplementation(
      async (userId: number, _quality?: number, element?: HTMLElement) => {
        if (userId === 9) await attachGate;
        return userId === 7
          ? bindLocalMockPlayer(userId, element)
          : remoteElement;
      },
    );

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
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: false, userId: 7 },
      { bVideoOn: true, userId: 9 },
    ]);

    handlers.get("user-updated")?.([{ bVideoOn: true, userId: 9 }]);
    handlers.get("peer-video-state-change")?.({ action: "Start", userId: 9 });
    releaseAttach?.();

    await waitFor(() => {
      expect(mockStream.attachVideo).toHaveBeenCalledTimes(1);
      expect(mockStream.attachVideo).toHaveBeenCalledWith(9, 2);
    });
  });

  it("does not let a delayed remote attachment from a disposed generation mutate the replacement client", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", accessResponse(0));
    const staleRemoteElement = document.createElement("video");
    let releaseStaleAttach: () => void = () => undefined;
    const staleAttachGate = new Promise<void>((resolve) => {
      releaseStaleAttach = resolve;
    });
    let remoteAttachCount = 0;
    mockStream.attachVideo.mockImplementation(
      async (userId: number, _quality?: number, element?: HTMLElement) => {
        if (userId === 9 && remoteAttachCount++ === 0) {
          await staleAttachGate;
          return staleRemoteElement;
        }
        return userId === 7
          ? bindLocalMockPlayer(userId, element)
          : remoteElement;
      },
    );

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
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: false, userId: 7 },
      { bVideoOn: true, userId: 9 },
    ]);

    act(() => {
      handlers.get("peer-video-state-change")?.({ action: "Start", userId: 9 });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockStream.attachVideo).toHaveBeenCalledWith(9, 2);

    act(() => {
      handlers.get("connection-change")?.({
        errorCode: 5003,
        reason: "temporary connection closure",
        state: "Closed",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(mockClient.join).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseStaleAttach();
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(mockClient.join).toHaveBeenCalledTimes(2);

    expect(screen.getByTestId("zoom-remote-video")).not.toContainElement(
      staleRemoteElement,
    );
    expect(mockStream.attachVideo).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("zoom-remote-video")).toContainElement(
      remoteElement,
    );
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
      expectLocalAttach();
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      );
    });
    const persistentPlayer = localElement;
    expect(
      screen
        .getByTestId("zoom-local-video")
        .querySelectorAll("video-player-container > video-player"),
    ).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /desligar câmera/i }));
    await waitFor(() => {
      expect(mockStream.detachVideo).toHaveBeenCalledWith(7, localElement);
      expect(mockStream.stopVideo).toHaveBeenCalled();
    });
    expect(persistentPlayer.isConnected).toBe(true);
    expect(persistentPlayer.getAttribute("node-id")).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));
    await waitFor(() => expect(getLocalAttachCalls()).toHaveLength(2));
    expect(localElement).toBe(persistentPlayer);
    expect(persistentPlayer.getAttribute("node-id")).toBe("7");
    expect(mockStream.startVideo).toHaveBeenCalledTimes(2);
    expect(
      screen
        .getByTestId("zoom-local-video")
        .querySelectorAll("video-player-container > video-player"),
    ).toHaveLength(1);
  });

  it("does not gate published mobile self-view attachment on the local roster", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.getCurrentUserInfo.mockReturnValue({
      bVideoOn: false,
      userId: 7,
      userKey: "tes-v1-p-local-participant",
    });
    mockClient.getAllUser.mockReturnValue([
      {
        bVideoOn: false,
        userId: 7,
        userKey: "tes-v1-p-local-participant",
      },
      {
        bVideoOn: true,
        userId: 9,
        userKey: "tes-v1-t-remote-participant",
      },
    ]);

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
    await waitFor(() => expect(mockStream.startVideo).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        mockStream.attachVideo.mock.calls.filter(([userId]) => userId === 7),
      ).toHaveLength(1),
    );
    expect(screen.getByTestId("zoom-local-video")).toContainElement(
      localElement,
    );
    expect(screen.getByTestId("zoom-remote-video")).toContainElement(
      remoteElement,
    );

    mockClient.getCurrentUserInfo.mockReturnValue({
      bVideoOn: true,
      userId: 7,
      userKey: "tes-v1-p-local-participant",
    });
    mockClient.getAllUser.mockReturnValue([
      {
        bVideoOn: true,
        userId: 7,
        userKey: "tes-v1-p-local-participant",
      },
      {
        bVideoOn: true,
        userId: 9,
        userKey: "tes-v1-t-remote-participant",
      },
    ]);
    act(() => {
      handlers.get("user-updated")?.([
        {
          bVideoOn: true,
          userId: 7,
          userKey: "tes-v1-p-local-participant",
        },
      ]);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(
      mockStream.attachVideo.mock.calls.filter(([userId]) => userId === 7),
    ).toHaveLength(1);
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(mockClient.join).toHaveBeenCalledTimes(1);
  });

  it("keeps the mobile self-view pending until the persistent player is bound", async () => {
    const fetchMock = accessResponse(0);
    vi.stubGlobal("fetch", fetchMock);
    mockClient.getAllUser.mockReturnValue([
      {
        bVideoOn: true,
        userId: 7,
        userKey: "tes-v1-p-local-participant",
      },
      {
        bVideoOn: true,
        userId: 9,
        userKey: "tes-v1-t-remote-participant",
      },
    ]);
    mockStream.attachVideo.mockImplementation(
      async (userId: number, _quality?: number, element?: HTMLElement) => {
        if (userId !== 7) return remoteElement;
        if (!element) throw new Error("persistent player required");
        localElement = element;
        return element;
      },
    );

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

    await waitFor(() => expectLocalAttach());
    expect(localElement.isConnected).toBe(true);
    expect(localElement.getAttribute("node-id")).toBeNull();
    expect(
      screen.getByText(/sem prévia neste dispositivo/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("zoom-remote-video")).toContainElement(
      remoteElement,
    );

    act(() => {
      localElement.setAttribute("node-id", "7");
    });

    await waitFor(() =>
      expect(
        screen.queryByText(/sem prévia neste dispositivo/i),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("zoom-local-video")).toContainElement(
      localElement,
    );
    expect(getLocalAttachCalls()).toHaveLength(1);
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(countAccessRequests(fetchMock, "join")).toBe(1);
  });

  it("detaches only the timed-out local player and retries binding without restarting capture", async () => {
    const fetchMock = accessResponse(0);
    vi.stubGlobal("fetch", fetchMock);
    mockClient.getAllUser.mockReturnValue([
      {
        bVideoOn: true,
        userId: 7,
        userKey: "tes-v1-p-local-participant",
      },
      {
        bVideoOn: true,
        userId: 9,
        userKey: "tes-v1-t-remote-participant",
      },
    ]);
    let bindOnAttach = false;
    mockStream.attachVideo.mockImplementation(
      async (userId: number, _quality?: number, element?: HTMLElement) => {
        if (userId !== 7) return remoteElement;
        if (!element) throw new Error("persistent player required");
        localElement = element;
        if (bindOnAttach) element.setAttribute("node-id", String(userId));
        return element;
      },
    );

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
    await waitFor(() => expect(getLocalAttachCalls()).toHaveLength(1));
    await waitFor(
      () =>
        expect(mockStream.detachVideo).toHaveBeenCalledWith(7, localElement),
      { timeout: 4_000 },
    );
    expect(localElement.isConnected).toBe(true);
    expect(localElement.getAttribute("node-id")).toBe("0");
    expect(screen.getByTestId("zoom-remote-video")).toContainElement(
      remoteElement,
    );

    bindOnAttach = true;
    act(() => {
      handlers.get("video-detailed-data-change")?.({ userId: 7 });
    });

    await waitFor(() => expect(getLocalAttachCalls()).toHaveLength(2));
    await waitFor(() =>
      expect(
        screen.queryByText(/sem prévia neste dispositivo/i),
      ).not.toBeInTheDocument(),
    );
    expect(localElement.getAttribute("node-id")).toBe("7");
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(countAccessRequests(fetchMock, "join")).toBe(1);
  });

  it.each(["resolved", "rejected"])(
    "does not mistake a %s capture failure for a working camera or a failed join",
    async (kind) => {
      vi.stubGlobal("fetch", accessResponse(0));
      const failure = {
        errorCode: 103,
        reason: "camera denied",
        type: "VIDEO_ERROR",
      };
      if (kind === "resolved")
        mockStream.startVideo.mockResolvedValueOnce(failure);
      else mockStream.startVideo.mockRejectedValueOnce(failure);
      render(
        <ZoomVideoSessionAdapter
          access={allowedAccess}
          actorRole="patient"
          bookingId="96000000-0000-4000-8000-000000000001"
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
      await screen.findByText(/voc[eê] entrou no encontro/i);
      expect(mockStream.startVideo).not.toHaveBeenCalled();
      expect(mockStream.unmuteAudio).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));
      expect(
        await screen.findByText(/permiss[aã]o|permissões/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /ativar câmera/i }),
      ).toBeEnabled();
      expect(getLocalAttachCalls()).toHaveLength(0);
      expect(mockClient.leave).not.toHaveBeenCalled();
      expect(mockClient.join).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps publishing with an honest local-preview state if attachment fails, and can switch the camera off", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockStream.attachVideo.mockRejectedValueOnce({
      errorCode: 2,
      reason: "attach failed",
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
    fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));
    await screen.findByText(/sem prévia neste dispositivo/i);
    expect(
      screen.getByRole("button", { name: /desligar câmera/i }),
    ).toBeEnabled();
    expect(mockStream.stopVideo).not.toHaveBeenCalled();
    expect(mockClient.leave).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/verifique as permissões/i),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /desligar câmera/i }));
    await waitFor(() => expect(mockStream.stopVideo).toHaveBeenCalledTimes(1));
    await screen.findByRole("button", { name: /ativar câmera/i });
  });

  it("uses an SDK-created local player after the persistent mobile player times out", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    const createdPlayer = document.createElement("video-player");
    mockStream.attachVideo.mockImplementation(
      async (userId: number, _quality?: number, element?: HTMLElement) => {
        if (element) return element;
        createdPlayer.setAttribute("node-id", String(userId));
        return createdPlayer;
      },
    );

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByRole("button", { name: /ativar c.mera/i });
    fireEvent.click(screen.getByRole("button", { name: /ativar c.mera/i }));

    await waitFor(
      () =>
        expect(screen.getByTestId("zoom-local-video")).toContainElement(
          createdPlayer,
        ),
      { timeout: 7_000 },
    );
    expect(mockStream.attachVideo).toHaveBeenNthCalledWith(
      1,
      7,
      2,
      expect.any(HTMLElement),
    );
    expect(mockStream.attachVideo).toHaveBeenNthCalledWith(2, 7, 2);
    expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
    expect(mockClient.join).toHaveBeenCalledTimes(1);
  });

  it("stops publishing even when local detachment fails", async () => {
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
    await waitFor(() =>
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      ),
    );
    mockStream.detachVideo.mockRejectedValueOnce(new Error("detach failed"));
    fireEvent.click(screen.getByRole("button", { name: /desligar câmera/i }));
    await screen.findByRole("button", { name: /ativar câmera/i });
    expect(mockStream.stopVideo).toHaveBeenCalledTimes(1);
    expect(localElement.isConnected).toBe(true);
    expect(localElement.getAttribute("node-id")).toBe("7");
    expect(mockClient.leave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));
    await waitFor(() => expect(getLocalAttachCalls()).toHaveLength(2));
    expect(mockStream.startVideo).toHaveBeenCalledTimes(2);
  });

  it.each(["capture", "attachment"])(
    "serializes camera clicks and unmount cleanup behind pending %s",
    async (phase) => {
      vi.stubGlobal("fetch", accessResponse(0));
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      if (phase === "capture")
        mockStream.startVideo.mockImplementationOnce(() => gate);
      else
        mockStream.attachVideo.mockImplementationOnce(
          async (userId, _quality, element) => {
            await gate;
            return bindLocalMockPlayer(userId, element);
          },
        );
      const view = render(
        <ZoomVideoSessionAdapter
          access={allowedAccess}
          actorRole="patient"
          bookingId="96000000-0000-4000-8000-000000000001"
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
      await screen.findByText(/voc[eê] entrou no encontro/i);
      fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));
      await waitFor(() =>
        expect(mockStream.startVideo).toHaveBeenCalledTimes(1),
      );
      fireEvent.click(screen.getByRole("button", { name: /câmera/i }));
      if (phase === "attachment") await waitFor(() => expectLocalAttach());
      view.unmount();
      await act(async () => {
        await Promise.resolve();
      });
      expect(destroyClient).not.toHaveBeenCalled();
      await act(async () => {
        release();
      });
      await waitFor(() => expect(destroyClient).toHaveBeenCalledTimes(1));
      expect(mockStream.startVideo).toHaveBeenCalledTimes(1);
      expect(mockStream.stopVideo).toHaveBeenCalledTimes(1);
      expect(mockClient.leave).toHaveBeenCalledWith(false);
      expect(localElement.isConnected).toBe(false);
    },
  );

  it("keeps the therapist video attached when the patient enables their own camera", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 7 },
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
    await waitFor(() => expect(remoteVideo).toContainElement(remoteElement));

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

    expect(mockStream.detachVideo).not.toHaveBeenCalledWith(9, remoteElement);
    expect(remoteVideo).toContainElement(remoteElement);
    expect(screen.getByTestId("zoom-local-video")).toContainElement(
      localElement,
    );

    fireEvent.click(screen.getByRole("button", { name: /sair do encontro/i }));
    await screen.findByText(/você saiu/i);
  });

  it("never moves the patient self-view into the therapist tile when the therapist stops video", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 7 },
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
    await screen.findByText(/voc[eê] entrou no encontro/i);
    await waitFor(() =>
      expect(screen.getByTestId("zoom-remote-video")).toContainElement(
        remoteElement,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));
    await waitFor(() =>
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      ),
    );

    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 7 },
      { bVideoOn: false, userId: 9 },
    ]);
    act(() => {
      handlers.get("peer-video-state-change")?.({ action: "Stop", userId: 9 });
    });

    await waitFor(() =>
      expect(mockStream.detachVideo).toHaveBeenCalledWith(9, remoteElement),
    );
    expect(screen.getByTestId("zoom-local-video")).toContainElement(
      localElement,
    );
    expect(screen.getByTestId("zoom-remote-video")).not.toContainElement(
      localElement,
    );
  });

  it("fails the self-view closed when the SDK returns an element already owned by the remote tile", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 7 },
      { bVideoOn: true, userId: 9 },
    ]);
    mockStream.attachVideo.mockResolvedValue(remoteElement);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    await waitFor(() =>
      expect(screen.getByTestId("zoom-remote-video")).toContainElement(
        remoteElement,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /ativar câmera/i }));

    await screen.findByText(/sem prévia neste dispositivo/i);
    expect(screen.getByTestId("zoom-remote-video")).toContainElement(
      remoteElement,
    );
    expect(screen.getByTestId("zoom-local-video")).not.toContainElement(
      remoteElement,
    );
    expect(
      screen
        .getByTestId("zoom-remote-video")
        .querySelectorAll("video, video-player"),
    ).toHaveLength(1);
  });

  it("fails remote rendering closed when the SDK returns the element owned by the self-view", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.getAllUser.mockReturnValue([{ bVideoOn: true, userId: 7 }]);
    mockStream.attachVideo.mockImplementation(
      async (userId, _quality, element) =>
        element ? bindLocalMockPlayer(userId, element) : localElement,
    );

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
    await waitFor(() =>
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      ),
    );

    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 7 },
      { bVideoOn: true, userId: 9 },
    ]);
    act(() => {
      handlers.get("peer-video-state-change")?.({ action: "Start", userId: 9 });
    });

    await waitFor(() =>
      expect(mockStream.detachVideo).toHaveBeenCalledWith(9, localElement),
    );
    expect(screen.getByTestId("zoom-local-video")).toContainElement(
      localElement,
    );
    expect(screen.getByTestId("zoom-remote-video")).not.toContainElement(
      localElement,
    );
  });

  it("refreshes local identity and reattaches the correct tiles after a native reconnect", async () => {
    vi.stubGlobal("fetch", accessResponse(0));
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 7, userKey: "tes-v1-p-local" },
      { bVideoOn: true, userId: 9, userKey: "tes-v1-t-remote" },
    ]);
    mockClient.getCurrentUserInfo.mockReturnValue({
      bVideoOn: true,
      userId: 7,
      userKey: "tes-v1-p-local",
    });
    mockStream.attachVideo.mockImplementation(
      async (userId: number, _quality?: number, element?: HTMLElement) =>
        userId === 9 ? remoteElement : bindLocalMockPlayer(userId, element),
    );

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
    await waitFor(() =>
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      ),
    );

    mockClient.getCurrentUserInfo.mockReturnValue({
      bVideoOn: true,
      userId: 17,
      userKey: "tes-v1-p-local",
    });
    mockClient.getAllUser.mockReturnValue([
      { bVideoOn: true, userId: 17, userKey: "tes-v1-p-local" },
      { bVideoOn: true, userId: 9, userKey: "tes-v1-t-remote" },
    ]);
    act(() => {
      handlers.get("connection-change")?.({ state: "Reconnecting" });
      handlers.get("connection-change")?.({ state: "Connected" });
    });

    await waitFor(() => {
      expect(mockStream.detachVideo).toHaveBeenCalledWith(7, localElement);
      expectLocalAttach(17);
      expect(screen.getByTestId("zoom-local-video")).toContainElement(
        localElement,
      );
      expect(screen.getByTestId("zoom-remote-video")).toContainElement(
        remoteElement,
      );
    });
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
    expect(
      screen.getByText(/retomar a conexão automaticamente/i),
    ).toBeInTheDocument();

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
      screen.getByRole("region", { name: "Sala de video" }).textContent,
    ).toContain("Seu encontro, horário e pagamento não serão alterados");
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
      await screen.findByText(
        /conclua o cadastro da sua conta de recebimento/i,
      ),
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

  it("does not announce therapist entry to the therapist when preview access is allowed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ data: { access: allowedAccess }, ok: true }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /atualizar sala/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText(/o terapeuta iniciou o encontro/i),
    ).not.toBeInTheDocument();
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
    expect(
      screen.getByText(/algumas etapas de encerramento falharam/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    await screen.findByText(/voc[eê] entrou no encontro/i);
    expect(
      screen.queryByText(/algumas etapas de encerramento falharam/i),
    ).not.toBeInTheDocument();
  });

  it("lets the therapist leave with leave(false) and reenter the same logical session", async () => {
    vi.stubGlobal("fetch", accessResponse(1));

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText(/respons[aá]vel/i);

    fireEvent.click(screen.getByRole("button", { name: /sair da sessão/i }));
    expect(await screen.findByText(/você saiu da sessão/i)).toBeInTheDocument();
    expect(mockClient.leave).toHaveBeenCalledWith(false);
    expect(mockClient.leave).not.toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(
      await screen.findByText(/você entrou como responsável/i),
    ).toBeInTheDocument();
    expect(mockClient.join).toHaveBeenCalledTimes(2);
  });

  it("stops recovery after a destroyClient failure instead of issuing more join attempts", async () => {
    vi.useFakeTimers();
    const fetchMock = accessResponse(1);
    vi.stubGlobal("fetch", fetchMock);
    mockClient.join.mockImplementationOnce(async () => {
      handlers.get("connection-change")?.({ state: "Connected" });
      return {
        errorCode: 2,
        reason: "internal error",
        type: "INTERNAL_ERROR",
      };
    });
    destroyClient.mockImplementation(() => {
      calls.push("destroy");
      return Promise.reject(new Error("destroy failed"));
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
    expect(destroyClient).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });

    expect(
      screen.getByText(
        /recarregue esta página para reiniciar somente o vídeo/i,
      ),
    ).toBeInTheDocument();
    expect(mockClient.join).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(destroyClient).toHaveBeenCalledTimes(1);
    const joinRequests = () =>
      fetchMock.mock.calls.filter(([, init]) =>
        String((init as RequestInit | undefined)?.body).includes(
          '"intent":"join"',
        ),
      );
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    fireEvent.click(screen.getByRole("button", { name: /entrar na sessão/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(joinRequests()).toHaveLength(1);
    expect(createClient).toHaveBeenCalledTimes(1);
    cleanup();
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
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(joinRequests()).toHaveLength(1);
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
