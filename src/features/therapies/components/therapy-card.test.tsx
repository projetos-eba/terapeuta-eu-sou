import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapyCard } from "./therapy-card";

describe("TherapyCard", () => {
  it("keeps the official editorial image of the therapy", () => {
    render(
      <TherapyCard
        therapy={{
          id: "therapy-1",
          imageUrl: "/therapies/reiki-editorial.png",
          isNew: false,
          isPopular: false,
          name: "Reiki",
          shortDescription: "Uma prática complementar de presença.",
          slug: "reiki",
          therapistCount: 3,
          themes: [
            { name: "Energia e equilíbrio", slug: "energia-equilibrio" },
            { name: "Bem-estar", slug: "bem-estar" },
          ],
        }}
      />,
    );

    expect(
      decodeURIComponent(screen.getByAltText("").getAttribute("src")!),
    ).toContain("/therapies/reiki-editorial.png");
    expect(screen.queryByText("Reiki")).toBeInTheDocument();
    expect(screen.getByText("Energia e equilíbrio")).toBeInTheDocument();
    expect(
      screen.getByLabelText("1 tema adicional de Reiki"),
    ).toHaveTextContent("Bem-estar");
  });
});
