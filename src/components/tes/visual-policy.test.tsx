import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TESButton } from "./tes-button";
import { TherapistCard, type TherapistCardData } from "./therapist-card";

const therapist: TherapistCardData = {
  description: "Atendimento online com escuta responsável.",
  highlight: "Perfil verificado",
  highlightTone: "verified",
  image: "/therapists/ana-oliveira.png",
  name: "Ana Oliveira",
  nextSlot: "Hoje, 15h",
  price: "R$ 170",
  quote: "Caminho com presença e cuidado.",
  rating: "4,9",
  reviews: "3 avaliações",
  slug: "ana-oliveira",
  specialty: "Reiki",
  tags: ["Reiki", "Tarô"],
};

describe("TES shared visual policy", () => {
  it("keeps small buttons at the accessible functional text and touch target floor", () => {
    render(<TESButton size="sm">Continuar</TESButton>);

    expect(screen.getByRole("button", { name: "Continuar" })).toHaveClass(
      "min-h-11",
      "text-sm",
    );
  });

  it("names favorite icon buttons and exposes pressed state", () => {
    render(<TherapistCard therapist={therapist} />);

    const favoriteButton = screen.getByRole("button", {
      name: "Favoritar Ana Oliveira",
    });

    expect(favoriteButton).toHaveAttribute("aria-pressed", "false");
    expect(favoriteButton).toHaveClass("size-11");
  });
});
