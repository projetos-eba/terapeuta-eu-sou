import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  DistributionDonut,
  MetricsFunnel,
  MetricsHeatmap,
  SessionsEvolutionChart,
  TherapyBarsChart,
} from "./therapist-metrics-charts";

afterEach(cleanup);

describe("therapist metrics charts", () => {
  it("describes a percentage ranking with its real unit and scales its height", () => {
    const { container } = render(
      <TherapyBarsChart
        items={Array.from({ length: 6 }, (_, index) => ({
          name: `Terapia ${index + 1}`,
          value: 60 + index,
        }))}
        label="Taxa de retorno por terapia"
        seriesLabel="Taxa de retorno"
        valueSuffix="%"
      />,
    );

    expect(
      screen.getByRole("img", {
        name: /Taxa de retorno por terapia: Terapia 1, 60%/,
      }),
    ).toBeInTheDocument();
    expect(container.querySelector('[role="img"]')).toHaveStyle({
      height: "300px",
    });
  });

  it("keeps one keyboard stop for the heatmap and exposes every cell as text", () => {
    const { container } = render(
      <MetricsHeatmap
        points={[{ dayOfWeek: 1, hourBucketStart: 8, value: 3 }]}
        valueLabel="sessões"
      />,
    );

    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    expect(screen.getByText(/Seg, 08h a 10h: 3 sessões/)).toHaveClass(
      "sr-only",
    );
  });

  it("does not present relative bar width as a conversion rate", () => {
    render(
      <MetricsFunnel
        stages={[
          { label: "Visualizações", value: 20 },
          { label: "Interesses", value: 8 },
          { label: "Reservas", value: 4 },
        ]}
      />,
    );

    expect(
      screen.getByRole("list", {
        name: /Visualizações: 20; Interesses: 8; Reservas: 4/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("40%")).not.toBeInTheDocument();
  });

  it("identifies both the value and date of the daily peak", () => {
    render(
      <SessionsEvolutionChart
        points={[
          { date: "2026-09-01", sessionsCompleted: 1 },
          { date: "2026-09-02", sessionsCompleted: 4 },
        ]}
      />,
    );

    expect(screen.getByText("Pico diário")).toBeInTheDocument();
    expect(screen.getByText("em 02/09")).toBeInTheDocument();
  });

  it("includes donut values and suffixes in its accessible description", () => {
    render(
      <DistributionDonut
        centerLabel="65%"
        items={[
          { label: "Ocupado", value: 65 },
          { label: "Disponível", value: 35 },
        ]}
        label="Ocupação da agenda"
        valueSuffix="%"
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Ocupação da agenda: Ocupado, 65%; Disponível, 35%",
      }),
    ).toBeInTheDocument();
  });
});
