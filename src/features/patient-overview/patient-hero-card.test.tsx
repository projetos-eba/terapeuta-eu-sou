import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PatientHeroCard } from "./patient-hero-card";

describe("PatientHeroCard", () => {
  afterEach(cleanup);

  it("applies the brand gradient to the patient's name only", () => {
    render(
      <PatientHeroCard
        patient={{
          avatarUrl: null,
          id: "patient-1",
          name: "Brunna Paiva",
          patientProfileId: "patient-profile-1",
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Olá, Brunna Paiva.",
    );
    expect(screen.getByText("Brunna Paiva.")).toHaveClass(
      "bg-clip-text",
      "text-transparent",
    );
  });
});
