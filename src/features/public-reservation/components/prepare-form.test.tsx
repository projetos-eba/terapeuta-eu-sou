import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { PrepareForm } from "./prepare-form";

afterEach(cleanup);

describe("PrepareForm", () => {
  it("shows the reservation terms and legal policy links", () => {
    render(
      <PrepareForm
        acceptedTerms
        canContinueToPayment
        marketingConsent={false}
        onAdvanceToPayment={() => undefined}
        onMarketingConsentChange={() => undefined}
        onSharedNoteChange={() => undefined}
        onTermsChange={() => undefined}
        sharedNote=""
      />,
    );

    expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute(
      "href",
      "/termos",
    );
    expect(
      screen.getByRole("link", { name: "Política de Privacidade" }),
    ).toHaveAttribute("href", "/privacidade");
    expect(
      screen.getByRole("link", {
        name: "Política de Cancelamento, Reagendamento e Reembolso",
      }),
    ).toHaveAttribute("href", "/cancelamento-reagendamento-reembolso");
    expect(
      screen.getByText(/Autorizo o uso da forma de pagamento cadastrada/),
    ).toBeInTheDocument();
  });

  it("keeps the shared note in the controlled reservation state", () => {
    function Harness() {
      const [sharedNote, setSharedNote] = useState("");

      return (
        <PrepareForm
          acceptedTerms
          canContinueToPayment
          marketingConsent={false}
          onAdvanceToPayment={() => undefined}
          onMarketingConsentChange={() => undefined}
          onSharedNoteChange={setSharedNote}
          onTermsChange={() => undefined}
          sharedNote={sharedNote}
        />
      );
    }

    render(<Harness />);
    const textarea = screen.getByRole("textbox", {
      name: "O que você gostaria de compartilhar?",
    });

    fireEvent.change(textarea, {
      target: { value: "Quero chegar com calma." },
    });

    expect(textarea).toHaveValue("Quero chegar com calma.");
  });
});
