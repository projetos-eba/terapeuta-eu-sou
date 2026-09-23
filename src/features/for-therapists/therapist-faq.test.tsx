import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { therapistFaqItems } from "./content";
import { TherapistFaq } from "./therapist-faq";

describe("TherapistFaq", () => {
  afterEach(() => cleanup());

  it("starts with its answers collapsed and reveals the selected answer", () => {
    render(<TherapistFaq />);

    const question = screen.getByText("O cadastro é realmente gratuito?");
    const details = question.closest("details");

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Dúvidas de quem atende pelo TES",
    );
    expect(details).not.toBeNull();
    if (!details) throw new Error("FAQ não foi renderizado.");
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(question);

    expect(details).toHaveAttribute("open");
    expect(
      screen.getByText(/O TES possui o plano Free, com mensalidade de R\$ 0/),
    ).toBeInTheDocument();
  });

  it("includes all six approved FAQ questions", () => {
    render(<TherapistFaq />);

    expect(therapistFaqItems).toHaveLength(6);
    therapistFaqItems.forEach(({ question }) => {
      expect(screen.getByText(question)).toBeInTheDocument();
    });
    expect(
      screen.getByText("Quando e como recebo pelos atendimentos?"),
    ).toBeInTheDocument();
  });
});
