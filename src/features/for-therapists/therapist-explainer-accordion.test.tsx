import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { therapistExplainerAccordions } from "./content";
import { TherapistExplainerAccordion } from "./therapist-explainer-accordion";

describe("TherapistExplainerAccordion", () => {
  afterEach(() => cleanup());

  it("starts closed and reveals the selected accordion independently", () => {
    render(
      <>
        {therapistExplainerAccordions.map((accordion) => (
          <TherapistExplainerAccordion
            key={accordion.id}
            accordion={accordion}
          />
        ))}
      </>,
    );

    const reachDetails = screen
      .getByText("O que acontece antes de um atendimento chegar até você?")
      .closest("details");
    const partnershipDetails = screen
      .getByText("Como funciona essa parceria na prática?")
      .closest("details");

    expect(reachDetails).not.toBeNull();
    expect(partnershipDetails).not.toBeNull();

    if (!reachDetails || !partnershipDetails) {
      throw new Error("Os acordeões informativos não foram renderizados.");
    }

    expect(reachDetails).not.toHaveAttribute("open");
    expect(partnershipDetails).not.toHaveAttribute("open");

    fireEvent.click(
      screen.getByText("O que acontece antes de um atendimento chegar até você?"),
    );

    expect(reachDetails).toHaveAttribute("open");
    expect(partnershipDetails).not.toHaveAttribute("open");
    expect(
      screen.getByText("Fazer o TES chegar a mais pessoas"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Porque antes de existir um agendamento, precisa existir um encontro.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the financial partnership explanation available in the second accordion", () => {
    render(
      <TherapistExplainerAccordion
        accordion={therapistExplainerAccordions[1]}
      />,
    );

    fireEvent.click(
      screen.getByText("Como funciona essa parceria na prática?"),
    );

    expect(
      screen.getByText("Quando uma sessão acontece pelo TES"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/85% do valor efetivamente cobrado é destinado a você/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Como funciona o recebimento dos seus atendimentos"),
    ).toBeInTheDocument();
  });
});
