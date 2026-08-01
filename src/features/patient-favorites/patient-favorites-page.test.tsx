import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatientFavoriteTherapistsPage } from "./patient-favorites-page";
import type { PatientFavoriteTherapistsPageData } from "./patient-favorites.types";

afterEach(() => cleanup());

describe("PatientFavoriteTherapistsPage", () => {
  it("renders favorite therapists with public profile and remove actions", () => {
    render(
      <PatientFavoriteTherapistsPage
        data={createData()}
        removeFavoriteAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Terapeutas favoritos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana Oliveira")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver perfil" })).toHaveAttribute(
      "href",
      "/terapeutas/ana-oliveira",
    );
    expect(
      screen.getByRole("button", { name: "Remover favorito" }),
    ).toBeInTheDocument();
  });

  it("renders an honest empty state", () => {
    render(
      <PatientFavoriteTherapistsPage
        data={{ ...createData(), items: [] }}
        removeFavoriteAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Nenhum terapeuta favorito ainda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explorar terapeutas" }),
    ).toHaveAttribute("href", "/terapeutas");
  });
});

function createData(): PatientFavoriteTherapistsPageData {
  return {
    items: [
      {
        avatarUrl: "/therapists/ana-oliveira.png",
        favoriteCreatedAt: "2026-08-01T00:00:00.000Z",
        headline: "Terapeuta integrativa",
        id: "92000000-0000-4000-8000-000000000011",
        isAcceptingBookings: true,
        name: "Ana Oliveira",
        profileHref: "/terapeutas/ana-oliveira",
        reservationHref: "/terapeutas?therapist=ana-oliveira",
      },
    ],
    patient: {
      id: "90000000-0000-4000-8000-000000000001",
      name: "Carlos",
      patientProfileId: "91000000-0000-4000-8000-000000000001",
    },
    source: "supabase",
  };
}
