import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TherapistProfilePage } from "./profile-page";
import { getFavoriteLoginHref } from "./favorite-therapist-button";
import { getCanonicalProfileShareUrl } from "./profile-share-button";
import type { PublicTherapistProfile } from "../types";

const baseProfile: PublicTherapistProfile = {
  acceptsOnlineSessions: true,
  badges: ["Perfil verificado"],
  bio: "Acolhimento responsável.",
  cityState: "São Paulo, SP",
  content: {
    bioIllustrationId: null,
    essenceBody: "Atendo com presença, escuta e combinados claros.",
    experienceYears: 8,
    guideItems: [{ icon: "heart", label: "Clareza emocional" }],
    invitationBody:
      "Conheça minha abordagem com calma, sem promessa de resultado.",
    reflections: [],
    shortIntro: "Escuta responsável para seu momento.",
    publicProfileTheme: "serene",
  },
  heroImage: "/therapists/ana-oliveira.png",
  headline: "Escuta responsável para seu momento.",
  id: "profile-1",
  isAcceptingBookings: false,
  isVerified: true,
  name: "Ana Oliveira",
  plan: "premium_plus",
  profileUrl: "/terapeutas/ana-oliveira",
  publicProfileTheme: "serene",
  rating: {
    average: null,
    count: 0,
    sessionsCompleted: 0,
  },
  services: [],
  slug: "ana-oliveira",
  tags: ["Reiki"],
  video: null,
};

describe("TherapistProfilePage video block", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, "clipboard");
    Reflect.deleteProperty(navigator, "share");
    vi.unstubAllGlobals();
  });

  it("does not render a clickable video link when the profile has no valid video", () => {
    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);

    const invitation = screen
      .getByRole("heading", { name: "Um convite para você" })
      .closest("article");

    expect(invitation).not.toBeNull();
    expect(
      within(invitation as HTMLElement).getByText(
        "Vídeo de apresentação indisponível no momento.",
      ),
    ).toBeInTheDocument();
    expect(within(invitation as HTMLElement).queryByRole("link")).toBeNull();
  });

  it("keeps favorite and share icon buttons accessible", () => {
    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);

    expect(
      screen.getByRole("button", {
        name: "Adicionar aos favoritos de Ana Oliveira",
      }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Compartilhar perfil" }),
    ).toHaveClass("size-[52px]");
  });

  it("reads the current favorite state for an authenticated patient", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ isFavorite: true, ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Remover dos favoritos de Ana Oliveira",
        }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/patient/favorite-therapists?therapistProfileId=profile-1",
      { cache: "no-store" },
    );
  });

  it("builds the client login return URL from the current public profile", () => {
    expect(
      getFavoriteLoginHref("/terapeutas/ana-oliveira", "?source=home"),
    ).toBe("/cliente/login?next=%2Fterapeutas%2Fana-oliveira%3Fsource%3Dhome");
  });

  it("shares only the canonical public profile URL", async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    window.history.replaceState({}, "", "/terapeutas/ana-oliveira?source=home");

    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Compartilhar perfil" }),
    );

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        url: getCanonicalProfileShareUrl(
          "/terapeutas/ana-oliveira",
          window.location.origin,
        ),
      }),
    );
    expect(screen.getByText("Link do perfil compartilhado.")).toHaveAttribute(
      "role",
      "status",
    );
  });

  it("copies the canonical profile URL when Web Share is unavailable", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Reflect.deleteProperty(navigator, "share");

    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Compartilhar perfil" }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        getCanonicalProfileShareUrl(
          "/terapeutas/ana-oliveira",
          window.location.origin,
        ),
      ),
    );
    expect(screen.getByText("Link do perfil copiado.")).toHaveAttribute(
      "role",
      "status",
    );
  });

  it("applies the selected theme only to the hero", () => {
    render(
      <TherapistProfilePage
        profile={{ ...baseProfile, publicProfileTheme: "natural" }}
        reviews={[]}
      />,
    );

    expect(
      document.querySelector('[data-profile-theme="natural"]'),
    ).toBeInTheDocument();
    expect(document.querySelectorAll("[data-profile-theme]")).toHaveLength(1);
  });

  it.each([["serene"], ["natural"], ["warm"]] as const)(
    "uses the official %s hero assets as decorative layers",
    (theme) => {
      render(
        <TherapistProfilePage
          profile={{ ...baseProfile, publicProfileTheme: theme }}
          reviews={[]}
        />,
      );

      expect(
        document.querySelector(`[data-theme-hero-background="${theme}"]`),
      ).toHaveAttribute("alt", "");
      expect(
        document.querySelector(`[data-theme-hero-illustration="${theme}"]`),
      ).toHaveAttribute("alt", "");
    },
  );

  it("keeps the essential hero free from a dominant illustration", () => {
    render(
      <TherapistProfilePage
        profile={{ ...baseProfile, publicProfileTheme: "essential" }}
        reviews={[]}
      />,
    );

    expect(
      document.querySelector("[data-theme-hero-illustration]"),
    ).not.toBeInTheDocument();
  });

  it("keeps a legacy bio illustration value silent on the public profile", () => {
    render(
      <TherapistProfilePage
        profile={{
          ...baseProfile,
          content: {
            ...baseProfile.content,
            bioIllustrationId: "organic_flow",
          },
        }}
        reviews={[]}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: /Ampliar ilustração/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(baseProfile.content.essenceBody)).toBeVisible();
  });

  it("posts favorite changes from the public profile", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") return Response.json({ ok: true });
        return Response.json({ isFavorite: false, ok: true });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Adicionar aos favoritos de Ana Oliveira",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Remover dos favoritos de Ana Oliveira",
        }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/patient/favorite-therapists",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not let a stale state read overwrite a completed favorite change", async () => {
    const pendingStateRead: {
      resolve?: (response: Response) => void;
    } = {};
    const stateRead = new Promise<Response>((resolve) => {
      pendingStateRead.resolve = resolve;
    });
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") return Response.json({ ok: true });
        if (String(_input).includes("/api/patient/favorite-therapists")) {
          return stateRead;
        }
        return Response.json({ ok: true });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).includes("/api/patient/favorite-therapists"),
        ),
      ).toHaveLength(1),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Adicionar aos favoritos de Ana Oliveira",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Remover dos favoritos de Ana Oliveira",
        }),
      ).toHaveAttribute("aria-pressed", "true"),
    );

    expect(pendingStateRead.resolve).toBeTypeOf("function");
    pendingStateRead.resolve?.(Response.json({ isFavorite: false, ok: true }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).includes("/api/patient/favorite-therapists"),
        ),
      ).toHaveLength(2),
    );
    expect(
      screen.getByRole("button", {
        name: "Remover dos favoritos de Ana Oliveira",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("rolls back the optimistic favorite state when the mutation fails", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Response.json(
            {
              error: { message: "Não foi possível salvar favorito." },
              ok: false,
            },
            { status: 403 },
          );
        }
        return Response.json({ isFavorite: false, ok: true });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Adicionar aos favoritos de Ana Oliveira",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Adicionar aos favoritos de Ana Oliveira",
        }),
      ).toHaveAttribute("aria-pressed", "false"),
    );
    expect(
      screen.getByText("Não foi possível salvar favorito."),
    ).toHaveAttribute("role", "status");
  });

  it("shows public services by canonical therapy name without operational labels", () => {
    render(
      <TherapistProfilePage
        profile={{
          ...baseProfile,
          isAcceptingBookings: true,
          services: [
            {
              availability: [],
              bookingUrl: "/reserva?service=service-1",
              currency: "BRL",
              description: "Sessão online com cuidado responsável.",
              durationMinutes: 50,
              id: "service-1",
              priceCents: 17000,
              priceLabel: "R$ 170",
              title: "Reiki online",
              therapyId: "therapy-1",
              therapyName: "Reiki",
              therapySlug: "reiki",
            },
          ],
        }}
        reviews={[]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Vivências e terapias" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Serviços online")).not.toBeInTheDocument();
    expect(screen.getAllByText("Reiki").length).toBeGreaterThan(0);
    expect(screen.queryByText("Reiki online")).not.toBeInTheDocument();
  });

  it("shows one therapist reply sentence before expanding the full answer", () => {
    render(
      <TherapistProfilePage
        profile={{
          ...baseProfile,
          rating: { average: 5, count: 1, sessionsCompleted: 1 },
        }}
        reviews={[
          {
            authorLabel: "Paciente TES",
            body: "Conversa atenta e respeitosa com o meu momento.",
            createdLabel: "Há uma semana",
            id: "review-1",
            patientContext: "Sessão concluída pela plataforma",
            rating: 5,
            reply: {
              body: "Obrigada por compartilhar sua experiência com tanto cuidado. Seguimos com presença e combinados claros para a continuidade.",
              publishedAt: null,
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByText(
        "Obrigada por compartilhar sua experiência com tanto cuidado.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Seguimos com presença e combinados claros/),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Ler resposta completa" }),
    );

    expect(
      screen.getByText(/Seguimos com presença e combinados claros/),
    ).toBeInTheDocument();
  });
});
