import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SharedIntakeCard } from "./shared-intake-card";

describe("SharedIntakeCard", () => {
  it("renders the exact note shared during booking", () => {
    render(
      <SharedIntakeCard
        intake={{
          focusArea: "Seu momento atual",
          sharedNote: "Quero chegar com calma.",
          therapyGoal: "Acompanhar meu momento.",
          visibility: "patient_therapist",
        }}
      />,
    );

    expect(screen.getByText("“Quero chegar com calma.”")).toBeInTheDocument();
  });
});
