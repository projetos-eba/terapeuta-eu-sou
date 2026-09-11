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
});
