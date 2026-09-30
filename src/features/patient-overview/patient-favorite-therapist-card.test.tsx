import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PatientFavoriteTherapistCard } from "./patient-favorite-therapist-card";

describe("PatientFavoriteTherapistCard", () => {
  afterEach(cleanup);

  it("opens the favorite therapist's public profile instead of reservation", () => {
    render(
      <PatientFavoriteTherapistCard
        professional={{
          averageRating: 5,
          avatarUrl: null,
          id: "therapist-1",
          name: "Antonio Ferrari",
          profileHref: "/terapeutas/antonio-ferrari",
          reviewCount: 1,
          specialty: "Terapeuta TES",
          summary: null,
          techniques: [],
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "Ver perfil" })).toHaveAttribute(
      "href",
      "/terapeutas/antonio-ferrari",
    );
    expect(screen.queryByRole("link", { name: "Agendar" })).toBeNull();
  });

  it("shows the therapist presentation only once and uses a taller portrait frame", () => {
    render(
      <PatientFavoriteTherapistCard
        professional={{
          averageRating: 5,
          avatarUrl: "/therapists/ana-oliveira.png",
          id: "therapist-1",
          name: "Ana Oliveira",
          profileHref: "/terapeutas/ana-oliveira",
          reviewCount: 1,
          specialty: "Acolhimento e cuidado no seu tempo.",
          summary: "Acolhimento e cuidado no seu tempo.",
          techniques: ["Reiki"],
        }}
      />,
    );

    expect(
      screen.getAllByText("Acolhimento e cuidado no seu tempo."),
    ).toHaveLength(1);
    expect(screen.getByText("Reiki")).toBeInTheDocument();
    expect(screen.getByRole("presentation").parentElement).toHaveClass(
      "aspect-[1.25]",
    );
  });
});
