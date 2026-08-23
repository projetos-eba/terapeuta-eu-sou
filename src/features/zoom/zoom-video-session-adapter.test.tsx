import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZoomAccessReason } from "@/domain/tes";

import { ZoomVideoSessionAdapter } from "./zoom-video-session-adapter";

const calls: string[] = [];
const handlers = new Map<string, (...args: unknown[]) => void>();
const destroyClient = vi.fn(() => {
  calls.push("destroy");
});
const remoteElement = document.createElement("video");
const localElement = document.createElement("video");
const mockClient = {
  getAllUser: vi.fn(() => []),
  getCurrentUserInfo: vi.fn(() => ({ userId: 7 })),
  getMediaStream: vi.fn(() => mockStream),
  init: vi.fn(async () => {
    calls.push("init");
  }),
  join: vi.fn(async () => {
    calls.push("join");
  }),
  leave: vi.fn(async (end?: boolean) => {
    calls.push(end ? "end" : "leave");
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
  muteAudio: vi.fn(async () => undefined),
  startAudio: vi.fn(async () => undefined),
  startVideo: vi.fn(async () => undefined),
  stopAudio: vi.fn(async () => undefined),
  stopRenderVideo: vi.fn(async () => undefined),
  stopVideo: vi.fn(async () => undefined),
  unmuteAudio: vi.fn(async () => undefined),
};

vi.mock("@zoom/videosdk", () => ({
  default: {
    checkSystemRequirements: () => ({ audio: true, video: true }),
    createClient: () => mockClient,
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

    expect(screen.getByText(/Entrada liberada 15 min antes/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entrar/i })).not.toBeInTheDocument();
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
      await screen.findByText(/voce entrou no encontro/i),
    ).toBeInTheDocument();
    expect(calls.slice(0, 2)).toEqual(["init", "join"]);
    expect(mockClient.join).toHaveBeenCalledWith(
      "tesvs-session",
      "jwt-token-role-0",
      "Paciente",
      undefined,
    );
    expect(document.body.textContent).not.toMatch(/jwt-token|secret|token/i);
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
    await screen.findByText(/voce entrou no encontro/i);

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

    expect(await screen.findByText(/tempo restante:/i)).toBeInTheDocument();
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

    fireEvent(window, new Event("offline"));

    expect(screen.getAllByText(/sem conexão com a internet/i).length).toBeGreaterThan(0);
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
    await screen.findByText(/voce entrou no encontro/i);

    handlers.get("peer-video-state-change")?.({ action: "Start", userId: 9 });

    expect(await screen.findByLabelText(/vídeo remoto/i)).toContainElement(
      remoteElement,
    );

    fireEvent.click(screen.getByRole("button", { name: /sair da sessão/i }));
    expect(await screen.findByText(/voce saiu/i)).toBeInTheDocument();
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
    await screen.findByText(/voce entrou no encontro/i);
    mockStream.attachVideo.mockClear();

    handlers.get("user-updated")?.([{ bVideoOn: true, userId: 9 }]);
    handlers.get("peer-video-state-change")?.({ action: "Start", userId: 9 });
    releaseAttach?.();

    await waitFor(() => {
      expect(mockStream.attachVideo).toHaveBeenCalledTimes(1);
      expect(mockStream.attachVideo).toHaveBeenCalledWith(9, 2);
    });
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
    await screen.findByText(/voce entrou no encontro/i);
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

  it("allows therapist role 1 to end the session after confirmation", async () => {
    vi.stubGlobal("fetch", accessResponse(1));
    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByText(/responsavel/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /encerrar para todos/i }));
    const dialog = await screen.findByRole("dialog", {
      name: /encerrar esta sessão/i,
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /encerrar para todos/i }),
    );

    expect(
      await screen.findByText(/encontro foi encerrado para todos/i),
    ).toBeInTheDocument();
    expect(mockClient.leave).toHaveBeenCalledWith(true);
    expect(destroyClient).toHaveBeenCalled();
    expect(mockStream.stopVideo).not.toHaveBeenCalled();
  });

  it("does not request access twice while loading", async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch({
      json: async () => ({
        error: { message: "A sala ainda esta em preparacao." },
        ok: false,
      }),
      ok: false,
    });

    expect(await screen.findByText(/preparacao/i)).toBeInTheDocument();
  });

  it("offers contextual recovery actions after a Zoom access failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          error: { message: "Token expirado." },
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

    expect(await screen.findByText(/token expirado/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /tentar novamente/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /renovar acesso/i }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: /revisar permissões/i }),
    );
    expect(
      await screen.findByText(/permissoes liberadas/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copiar referência/i }));
    expect(await screen.findByText(/referencia copiada/i)).toBeInTheDocument();
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
      screen.getByText(/entrada será liberada assim que a presença do terapeuta/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entrar/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /atualizar sala/i }));

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
    expect(
      screen.getByRole("button", { name: /atualizando/i }),
    ).toBeDisabled();

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
    expect(screen.queryByText(/entrada será liberada assim que a presença do terapeuta/i)).toBeNull();
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
      await screen.findByText(/presença do terapeuta/i),
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
    await screen.findByText(/voce entrou no encontro/i);
    fireEvent.click(screen.getByRole("button", { name: /sair da sessão/i }));

    expect(
      await screen.findByText(/nao foi possivel concluir todas as etapas/i),
    ).toBeInTheDocument();
  });
});

function accessResponse(roleType: 0 | 1) {
  return vi.fn().mockResolvedValue({
    json: async () => ({
      data: {
        access: allowedAccess,
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
  });
}
