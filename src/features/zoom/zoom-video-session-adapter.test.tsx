import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ZoomAccessReason } from "@/domain/tes";

import { ZoomVideoSessionAdapter } from "./zoom-video-session-adapter";

const calls: string[] = [];
const handlers = new Map<string, (...args: unknown[]) => void>();
const destroyClient = vi.fn(() => {
  calls.push("destroy");
});
const remoteElement = document.createElement("video");
const mockClient = {
  getAllUser: vi.fn(() => []),
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
  attachVideo: vi.fn(async () => remoteElement),
  detachVideo: vi.fn(async () => undefined),
  getCurrentUserInfo: vi.fn(() => ({ userId: 7 })),
  muteAudio: vi.fn(async () => undefined),
  renderVideo: vi.fn(async () => undefined),
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
    cleanup();
    calls.length = 0;
    handlers.clear();
    remoteElement.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the button disabled outside the join window", () => {
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
      screen.getByRole("button", { name: /15 min antes/i }),
    ).toBeDisabled();
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
      await screen.findByText(/voce entrou na sessao/i),
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
    await screen.findByText(/voce entrou na sessao/i);

    handlers.get("peer-video-state-change")?.({ action: "Start", userId: 9 });

    expect(await screen.findByLabelText(/video remoto/i)).toContainElement(
      remoteElement,
    );

    fireEvent.click(screen.getByRole("button", { name: /^sair$/i }));
    expect(await screen.findByText(/voce saiu/i)).toBeInTheDocument();
    expect(mockStream.detachVideo).toHaveBeenCalledWith(9);
    expect(destroyClient).toHaveBeenCalled();
  });

  it("allows therapist role 1 to end the session after confirmation", async () => {
    vi.stubGlobal("fetch", accessResponse(1));
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );

    render(
      <ZoomVideoSessionAdapter
        access={allowedAccess}
        actorRole="therapist"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByText(/responsavel/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /encerrar sessao/i }));

    expect(
      await screen.findByText(/sessao foi encerrada para todos/i),
    ).toBeInTheDocument();
    expect(mockClient.leave).toHaveBeenCalledWith(true);
    expect(destroyClient).toHaveBeenCalled();
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
        }}
        actorRole="patient"
        bookingId="96000000-0000-4000-8000-000000000001"
      />,
    );

    expect(
      screen.getByText(/aguardando o terapeuta iniciar/i),
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

  it("previews patient access before showing join when server data is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          access: {
            ...allowedAccess,
            allowed: false,
            reason: ZoomAccessReason.TherapistNotInSession,
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

    expect(screen.getByRole("button", { name: /verificando/i })).toBeDisabled();
    expect(
      await screen.findByText(/aguardando o terapeuta iniciar/i),
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
    await screen.findByText(/voce entrou na sessao/i);
    fireEvent.click(screen.getByRole("button", { name: /^sair$/i }));

    expect(
      await screen.findByText(/falha parcial de cleanup/i),
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
