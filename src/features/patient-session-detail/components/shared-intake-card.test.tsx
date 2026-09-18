import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SharedIntakeCard } from "./shared-intake-card";

describe("SharedIntakeCard", () => {
  afterEach(cleanup);

  it("renders the exact note shared during booking", () => {
    render(
      <SharedIntakeCard
        sharedNote="Quero chegar com calma."
        visibility="patient_therapist"
      />,
    );

    expect(screen.getByText("“Quero chegar com calma.”")).toBeInTheDocument();
  });

  it("does not render a card when no note was shared", () => {
    const { container } = render(
      <SharedIntakeCard sharedNote="   " visibility="patient_therapist" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("uses the therapist-safe copy for the same shared note", () => {
    render(
      <SharedIntakeCard
        perspective="therapist"
        sharedNote="Quero chegar com calma."
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Informações compartilhadas no agendamento",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("“Quero chegar com calma.”")).toBeInTheDocument();
  });
});
