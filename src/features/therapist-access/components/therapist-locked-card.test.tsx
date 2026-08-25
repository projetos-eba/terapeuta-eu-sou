import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapistPlan } from "@/domain/tes";

import { TherapistLockedCard } from "./therapist-locked-card";

describe("TherapistLockedCard", () => {
  it("opens an accessible human upgrade dialog without rendering private values", () => {
    render(
      <TherapistLockedCard
        description="Acompanhe padrões da sua prática no Premium."
        requiredPlan={TherapistPlan.Premium}
        title="Resumo da agenda"
      />,
    );

    const trigger = screen.getByRole("button", {
      name: /resumo da agenda.*recurso disponível no premium/i,
    });
    expect(screen.queryByText(/R\$|123|Paciente/)).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(
      screen.getByRole("dialog", { name: "Um recurso para sua prática" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Conhecer Premium" }),
    ).toHaveAttribute("href", "/terapeuta/plano");
  });
});

