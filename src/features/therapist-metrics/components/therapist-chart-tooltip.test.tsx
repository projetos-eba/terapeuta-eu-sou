import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TherapistChartTooltip } from "./therapist-chart-tooltip";

afterEach(cleanup);

describe("TherapistChartTooltip", () => {
  it("shows the point label and all available series values", () => {
    render(
      <TherapistChartTooltip
        active
        label="2026-07-27"
        labelFormatter={() => "27 de julho de 2026"}
        payload={[
          {
            color: "var(--tes-color-brand-primary)",
            dataKey: "sessionsCompleted",
            name: "Sessões concluídas",
            value: 9,
          },
          {
            color: "var(--tes-color-brand-cyan)",
            dataKey: "previous",
            name: "Período anterior",
            value: 6,
          },
        ]}
      />,
    );

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("27 de julho de 2026")).toBeInTheDocument();
    expect(screen.getByText("Sessões concluídas")).toBeInTheDocument();
    expect(screen.getByText("Período anterior")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("stays hidden when the chart is not active", () => {
    render(
      <TherapistChartTooltip
        label="2026-07-27"
        payload={[{ name: "Valor", value: 9 }]}
      />,
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
