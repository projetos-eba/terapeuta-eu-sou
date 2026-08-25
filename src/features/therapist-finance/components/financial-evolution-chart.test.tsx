import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FinancialEvolutionChart } from "./financial-evolution-chart";

afterEach(cleanup);

const series = [
  {
    color: "var(--tes-color-brand-primary)",
    dataKey: "current" as const,
    label: "Receita líquida",
    type: "bar" as const,
  },
  {
    color: "var(--tes-color-brand-deep)",
    dataKey: "previous" as const,
    label: "Período anterior",
    type: "line" as const,
  },
];

describe("FinancialEvolutionChart", () => {
  it("keeps the plotted area visible with an honest empty state", () => {
    render(<FinancialEvolutionChart points={[]} series={series} />);

    expect(
      screen.getByText("Ainda estamos reunindo sua evolução"),
    ).toBeInTheDocument();
    expect(screen.getByText("Aguardando dados")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Evolução financeira" }),
    ).toBeInTheDocument();
  });

  it("describes the real series and keeps the chart accessible", () => {
    render(
      <FinancialEvolutionChart
        points={[
          { current: 12000, label: "01/08", previous: 9000 },
          { current: 18000, label: "08/08", previous: 14000 },
        ]}
        series={series}
      />,
    );

    expect(screen.getByText("2 períodos")).toBeInTheDocument();
    expect(screen.getAllByText("Receita líquida").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Período anterior").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("img", {
        name: "Gráfico com a evolução dos valores financeiros",
      }),
    ).toBeInTheDocument();
  });
});
