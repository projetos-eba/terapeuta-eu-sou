import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookies: vi.fn(),
}));

const configMocks = vi.hoisted(() => ({
  getSupabasePublicConfig: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: headerMocks.cookies,
}));

vi.mock("@/lib/supabase/public-config", () => ({
  getSupabasePublicConfig: configMocks.getSupabasePublicConfig,
}));

import { POST } from "./route";

const userId = "c1000000-0000-4000-8000-000000000001";

describe("therapist profile media route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    headerMocks.cookieGet.mockReset();
    headerMocks.cookies.mockReset();
    configMocks.getSupabasePublicConfig.mockReset();

    headerMocks.cookieGet.mockReturnValue({ value: "therapist-token" });
    headerMocks.cookies.mockResolvedValue({ get: headerMocks.cookieGet });
    configMocks.getSupabasePublicConfig.mockReturnValue({
      apiKey: "publishable-key",
      url: "https://tes.supabase.test",
    });
  });

  it("requires an authenticated therapist session", async () => {
    headerMocks.cookieGet.mockReturnValue(undefined);

    const response = await POST(
      makeRequest({
        file: makeWebpFile("photo.webp"),
        kind: "photo",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.message).toBe("Entre na sua conta para continuar.");
  });

  it("rejects invalid file types before calling Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({
        file: new File(["bad"], "photo.txt", { type: "text/plain" }),
        kind: "photo",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.message).toBe("Envie uma imagem em JPG, PNG ou WebP.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects video upload when the plan capability is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        editor: makeEditorContract({ canUploadVideo: false }),
      }),
    );

    const response = await POST(
      makeRequest({
        file: makeMp4File("intro.mp4"),
        kind: "video",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.message).toBe(
      "Seu plano atual não permite vídeo de apresentação.",
    );
  });

  it("rejects video files larger than 5 MB before upload", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const oversizedVideo = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "intro.mp4",
      { type: "video/mp4" },
    );

    const response = await POST(
      makeRequest({ file: oversizedVideo, kind: "video" }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.message).toContain("no máximo 5 MB");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads public media with a protected user-scoped object path", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({
        file: makeWebpFile("photo.webp"),
        kind: "photo",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.publicUrl).toContain(
      `/storage/v1/object/public/therapist-public-media/${userId}/profile/photo-`,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        `/storage/v1/object/therapist-public-media/${userId}/profile/photo-`,
      ),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer therapist-token",
          apikey: "publishable-key",
          "x-upsert": "false",
        }),
        method: "POST",
      }),
    );
  });

  it("returns a sanitized failure when Storage rejects the upload", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ storageStatus: 500 }));

    const response = await POST(
      makeRequest({
        file: makeWebpFile("photo.webp"),
        kind: "photo",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error.message).toBe(
      "Não foi possível enviar o arquivo agora.",
    );
  });

  it("rejects files whose bytes do not match the declared MIME type", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({
        file: new File(["not really an image"], "photo.webp", {
          type: "image/webp",
        }),
        kind: "photo",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.message).toBe(
      "O conteúdo do arquivo não corresponde ao formato informado.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function makeRequest({
  file,
  kind,
}: {
  file: File;
  kind: "photo" | "video" | "video_thumbnail";
}) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("kind", kind);

  return {
    formData: async () => formData,
  } as Request;
}

function makeFetchMock({
  editor = makeEditorContract(),
  storageStatus = 200,
}: {
  editor?: ReturnType<typeof makeEditorContract>;
  storageStatus?: number;
} = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/auth/v1/user")) {
      return jsonResponse({ id: userId });
    }

    if (url.includes("/functions/v1/therapist-profile-command")) {
      return jsonResponse({ data: editor, ok: true });
    }

    if (url.includes("/storage/v1/object/therapist-public-media/")) {
      return new Response(null, { status: storageStatus });
    }

    return new Response(null, { status: 404 });
  });
}

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init,
  });
}

function makeWebpFile(name: string) {
  return new File(
    [
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]),
    ],
    name,
    { type: "image/webp" },
  );
}

function makeMp4File(name: string) {
  return new File(
    [
      new Uint8Array([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
      ]),
    ],
    name,
    { type: "video/mp4" },
  );
}

function makeEditorContract(
  capabilities: Partial<{
    canPublishAdditionalServices: boolean;
    canPublishProfile: boolean;
    canUploadVideo: boolean;
    canUseAdvancedSections: boolean;
    canUseFeaturedMedia: boolean;
  }> = {},
) {
  return {
    capabilities: {
      canPublishAdditionalServices: true,
      canPublishProfile: true,
      canUploadVideo: true,
      canUseAdvancedSections: false,
      canUseFeaturedMedia: true,
      ...capabilities,
    },
    completeness: {
      items: [{ complete: true, key: "photo", label: "Foto de perfil" }],
      percent: 80,
      score: 4,
      total: 5,
    },
    derived: {
      accountStatus: "approved",
      activeServiceCount: 2,
      availabilityRuleCount: 3,
      averageRating: 4.9,
      canReceiveBookings: true,
      completedSessions: 12,
      hasAvailability: true,
      plan: "premium_plus",
      publicStatus: "published",
      reviewCount: 8,
      startingPriceCents: 17000,
      verificationStatus: "approved",
    },
    draft: null,
    propagationNotice:
      "As alterações publicadas podem levar até 2 a 3 horas para aparecer em todas as superfícies públicas.",
    publicProfileHref: "/terapeutas/ana-oliveira",
    published: {
      baseProfileVersion: null,
      contentVersionId: "published-version",
      fields: {
        bio: "Atendimento online com escuta responsável.",
        city: "",
        essenceBody: "Presença e cuidado.",
        experienceYears: 8,
        guideItems: [{ icon: "sparkles", label: "Escuta acolhedora" }],
        headline: "",
        invitationBody: "",
        photoUrl: "/therapists/ana-oliveira.png",
        publicName: "Ana Oliveira",
        reflections: [],
        shortIntro: "Acolhimento online.",
        state: "",
        videoProvider: "external",
        videoThumbnailUrl: "",
        videoTitle: "",
        videoUrl: "",
      },
      publishedAt: "2026-07-27T12:00:00.000Z",
      status: "published",
      updatedAt: "2026-07-27T12:00:00.000Z",
    },
    therapistProfileId: userId,
    updatedAt: "2026-07-28T12:00:00.000Z",
    version: 4,
  };
}
