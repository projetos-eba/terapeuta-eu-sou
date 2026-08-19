import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapyCard } from "./therapy-card";

describe("TherapyCard", () => {
  it("keeps the official editorial image of the therapy", () => {
    render(
      <TherapyCard
        therapy={{
          category: { name: "Energia", slug: "energia" },
          id: "therapy-1",
          imageUrl: "/therapies/reiki-editorial.png",
          isNew: false,
          isPopular: false,
          name: "Reiki",
          shortDescription: "Uma prática complementar de presença.",
          slug: "reiki",
          therapistCount: 3,
        }}
      />,
    );

    expect(
      decodeURIComponent(screen.getByAltText("").getAttribute("src")!),
    ).toContain("/therapies/reiki-editorial.png");
    expect(screen.queryByText("Reiki")).toBeInTheDocument();
  });
});
