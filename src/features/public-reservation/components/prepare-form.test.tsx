import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { PrepareForm } from "./prepare-form";

describe("PrepareForm", () => {
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
