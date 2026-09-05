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
      within(invitation as HTMLElement).getByRole("img", {
        name: "Vídeo de apresentação indisponível no momento",
      }),
    ).toBeInTheDocument();
    expect(within(invitation as HTMLElement).queryByRole("link")).toBeNull();
  });

  it("places the invitation copy below the video", () => {
    render(
      <TherapistProfilePage
        profile={{
          ...baseProfile,
          video: {
            provider: "external",
            thumbnailUrl: "/therapists/ana-oliveira.png",
            title: "Vídeo de apresentação",
            url: "https://example.com/video",
          },
        }}
        reviews={[]}
      />,
    );

    const invitationCopy = screen.getByText(baseProfile.content.invitationBody);
    const videoLayout = invitationCopy.parentElement;

    expect(videoLayout).toHaveClass("grid", "gap-5");
    expect(videoLayout).not.toHaveClass("xl:grid-cols-[253px_1fr]");
    expect(videoLayout?.children[1]).toBe(invitationCopy);
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

  it("keeps the public profile hero compact on mobile", () => {
    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);

    expect(
      screen.getByAltText("Retrato de Ana Oliveira").parentElement,
    ).toHaveClass("size-[210px]");
    expect(screen.getByText("Perfil verificado")).toHaveClass(
      "shrink-0",
      "whitespace-nowrap",
    );
    expect(screen.getByText("Terapeuta Plus")).toHaveClass(
      "shrink-0",
      "whitespace-nowrap",
    );
    expect(screen.getByText("Perfil verificado").parentElement).toHaveClass(
      "flex-nowrap",
    );
  });

  it("renders a static preview without public actions or background requests", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TherapistProfilePage
        mode="preview"
        profile={{
          ...baseProfile,
          isAcceptingBookings: true,
          services: [
            {
              availability: [
                {
                  date: "2026-08-26",
                  dateLabel: "26/08",
                  dayLabel: "qua",
                  slots: [
                    {
                      dateLabel: "26/08",
                      dayLabel: "qua",
                      endsAt: "2026-08-26T15:50:00.000Z",
                      serviceId: "service-1",
                      startsAt: "2026-08-26T15:00:00.000Z",
                      timeLabel: "12:00",
                    },
                  ],
                },
              ],
              bookingUrl: "/reserva?serviceId=service-1",
              currency: "BRL",
              description: "Atendimento online com presença.",
              durationMinutes: 50,
              id: "service-1",
              imageUrl: null,
              priceCents: 12000,
              priceLabel: "R$ 120",
              themeNames: [],
              therapyId: "therapy-1",
              therapyName: "Reiki",
              therapySlug: "reiki",
              title: "Reiki online",
            },
          ],
          video: {
            provider: "external",
            thumbnailUrl: "/therapists/ana-oliveira.png",
            title: "Vídeo de apresentação",
            url: "https://example.com/video",
          },
        }}
        reviews={[]}
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", {
        name: "Adicionar aos favoritos de Ana Oliveira",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Compartilhar perfil" }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "Agendar" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Vídeo de apresentação" }),
    ).toBeNull();
    expect(screen.queryByTitle("Vídeo de apresentação")).toBeNull();
  });

  it("scrolls the hero booking CTA to the therapist agenda", () => {
    render(
      <TherapistProfilePage
        profile={{
          ...baseProfile,
          isAcceptingBookings: true,
          services: [
            {
              availability: [],
              bookingUrl: "/reserva?serviceId=service-1",
              currency: "BRL",
              description: "Atendimento online com presença.",
              durationMinutes: 50,
              id: "service-1",
              imageUrl: null,
              priceCents: 12000,
              priceLabel: "R$ 120",
              themeNames: [],
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
      screen.getByRole("link", { name: /Agendar sessão/ }),
    ).toHaveAttribute("href", "#agenda-terapeuta");
    expect(document.getElementById("agenda-terapeuta")).toBeInTheDocument();
  });

  it("uses the plural label when the profile has zero reviews", () => {
    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);

    expect(screen.getByText("0 avaliações")).toBeInTheDocument();
  });

  it("does not render legacy profile tags in the public hero", () => {
    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);

    expect(
      screen.queryByText("Reiki", { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("previews long service descriptions and opens the full text", async () => {
    const longWord = "x".repeat(220);

    render(
      <TherapistProfilePage
        profile={{
          ...baseProfile,
          services: [
            {
              availability: [],
              bookingUrl: "/reserva?serviceId=service-1",
              currency: "BRL",
              description: longWord,
              durationMinutes: 60,
              id: "service-1",
              imageUrl: null,
              priceCents: 18500,
              priceLabel: "R$ 185",
              themeNames: [],
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

    const description = screen.getByText(`${longWord.slice(0, 180)}…`);

    expect(description).toHaveClass("break-words");
    expect(description).not.toHaveClass("overflow-hidden");
    expect(description.className).not.toContain("line-clamp");

    const moreButton = screen.getByRole("button", {
      name: "Ver mais sobre Reiki",
    });
    expect(moreButton).toHaveClass("font-bold");
    fireEvent.click(moreButton);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(longWord)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
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

  it("keeps the hero presentation beside the photo from the tablet breakpoint", () => {
    render(<TherapistProfilePage profile={baseProfile} reviews={[]} />);

    const hero = document.querySelector('[data-profile-theme="serene"]');
    const heroLayout = hero?.querySelector(":scope > div.relative");

    expect(heroLayout).toHaveClass(
      "md:grid-cols-[minmax(252px,0.9fr)_minmax(0,1.1fr)]",
    );
  });

  it("shows six guide themes in a compact responsive public layout", () => {
    const guideItems = [
      { icon: "heart", label: "Emoções e Bem-Estar" },
      { icon: "mind", label: "Autoconhecimento e Transformação" },
      { icon: "connection", label: "Relacionamentos" },
      { icon: "star", label: "Autoestima e Poder Pessoal" },
      { icon: "compass", label: "Propósito e Direção" },
      { icon: "sparkles", label: "Espiritualidade e Conexão Interior" },
    ];

    render(
      <TherapistProfilePage
        profile={{
          ...baseProfile,
          content: { ...baseProfile.content, guideItems },
        }}
        reviews={[]}
      />,
    );

    const guideCard = screen
      .getByRole("heading", { name: "Como posso te guiar" })
      .closest("article");
    expect(guideCard).not.toBeNull();

    const guideList = within(guideCard as HTMLElement).getByRole("list", {
      name: "Caminhos pelos quais posso te guiar",
    });
    expect(guideList).toHaveClass("grid-cols-1");
    expect(guideList).toHaveClass("min-[420px]:grid-cols-2");
    expect(guideList).toHaveClass("xl:grid-cols-3");
    expect(within(guideList).getAllByRole("listitem")).toHaveLength(6);
    guideItems.forEach((item) => {
      expect(within(guideList).getByText(item.label)).toBeVisible();
    });
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

  it("rolls back and explains when the favorite request cannot reach the server", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          throw new Error("network unavailable");
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
      screen.getByText(
        "Não foi possível atualizar favoritos agora. Tente novamente.",
      ),
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
              imageUrl: "https://cdn.example.test/reiki-profile.jpg",
              priceCents: 17000,
              priceLabel: "R$ 170",
              themeNames: [],
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
    const services = screen.getByRole("list", {
      name: "Vivências e terapias disponíveis",
    });
    expect(services).toHaveClass("overflow-x-auto", "snap-x");
    expect(within(services).getByRole("listitem")).toBeInTheDocument();
    expect(screen.queryByText("Serviços online")).not.toBeInTheDocument();
    expect(screen.getAllByText("Reiki").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("img", { name: "Imagem da terapia Reiki" }),
    ).toHaveAttribute("src", "https://cdn.example.test/reiki-profile.jpg");
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

  it("uses compact review navigation and can show every review", () => {
    render(
      <TherapistProfilePage
        profile={{
          ...baseProfile,
          rating: { average: 4.7, count: 3, sessionsCompleted: 3 },
        }}
        reviews={[
          {
            authorLabel: "Paciente TES",
            body: "Primeira experiência compartilhada.",
            createdLabel: "Hoje",
            id: "review-1",
            patientContext: "Sessão concluída pela plataforma",
            rating: 5,
            reply: null,
          },
          {
            authorLabel: "Paciente TES",
            body: "Segunda experiência compartilhada.",
            createdLabel: "Ontem",
            id: "review-2",
            patientContext: "Sessão concluída pela plataforma",
            rating: 4,
            reply: null,
          },
          {
            authorLabel: "Paciente TES",
            body: "Terceira experiência compartilhada.",
            createdLabel: "Há uma semana",
            id: "review-3",
            patientContext: "Sessão concluída pela plataforma",
            rating: 5,
            reply: null,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Navegação das avaliações" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver página 1 de avaliações" }),
    ).toHaveAttribute("aria-current", "step");
    expect(
      screen.queryByText("Terceira experiência compartilhada."),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Ver próximas avaliações" }),
    );
    expect(
      screen.getByText("Terceira experiência compartilhada."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Ver todas as avaliações" }),
    );
    expect(
      screen.getByText("Primeira experiência compartilhada."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Segunda experiência compartilhada."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Terceira experiência compartilhada."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Navegação das avaliações" }),
    ).not.toBeInTheDocument();
  });
});
