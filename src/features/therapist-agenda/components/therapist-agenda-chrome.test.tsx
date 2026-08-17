import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TherapistAgendaHeader } from "./therapist-agenda-chrome";

describe("TherapistAgendaHeader", () => {
  it("preserves the agenda typography and tab treatment across sibling views", () => {
    render(<TherapistAgendaHeader activeTab="horarios" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Minha agenda" }),
    ).toHaveClass("font-display", "italic");
    expect(screen.getByLabelText("Seções da agenda")).toHaveClass(
      "max-w-[520px]",
      "border-b",
    );
    expect(screen.getByRole("link", { name: "Horários" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
