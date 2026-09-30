import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeaturedTherapistsCarousel } from "./featured-therapists-carousel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FeaturedTherapistsCarousel", () => {
  it("shows published therapies as badges and the therapist essence instead of the service title", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    );

    render(
      <FeaturedTherapistsCarousel
        therapists={[
          {
            essence:
              "Uma apresentação curta e responsável para ajudar na escolha.",
            headline: "Terapeuta integrativa",
            href: "/terapeutas/ana-oliveira",
            isPremium: false,
            name: "Ana Oliveira",
            photoUrl: "/therapists/ana-oliveira.png",
            priceLabel: "A partir de R$ 120",
            ratingLabel: "5,0",
            reviewCountLabel: "1 avaliação",
            serviceTitle: "Reiki online individual",
            slug: "ana-oliveira",
            therapies: [
              { id: "reiki", label: "Reiki", slug: "reiki" },
              { id: "taro", label: "Tarô", slug: "taro" },
            ],
          },
        ]}
      />,
    );

    expect(
      screen.getByText(
        "Uma apresentação curta e responsável para ajudar na escolha.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Reiki")).toBeInTheDocument();
    expect(screen.getByText("Tarô")).toBeInTheDocument();
    expect(
      screen.queryByText("Reiki online individual"),
    ).not.toBeInTheDocument();
  });
});
