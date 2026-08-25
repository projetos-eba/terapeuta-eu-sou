import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TherapistPlan } from "@/domain/tes";

import { TherapistWeekSummary } from "./therapist-week-summary";

describe("TherapistWeekSummary", () => {
  afterEach(() => cleanup());

  it("explains the locked Free view without navigating to Results", () => {
    render(
      <TherapistWeekSummary
        plan={TherapistPlan.Free}
        week={{
          attendanceRate: 0,
          days: [],
          rangeLabel: "Semana atual",
          state: "empty",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Sua semana/ }));

    expect(
      screen.getByRole("dialog", {
        name: "Acompanhe sua semana com mais clareza",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Conhecer Premium" })).toHaveAttribute(
      "href",
      "/terapeuta/plano",
    );
    expect(screen.queryByRole("link", { name: /Resultados|Métricas/ })).not.toBeInTheDocument();
  });
});
