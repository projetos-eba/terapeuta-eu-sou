import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  AdminDashboard,
  AdminDashboardMetric,
} from "../admin-dashboard.types";
import { AdminDashboardPage } from "./admin-dashboard-page";

afterEach(cleanup);

describe("AdminDashboardPage", () => {
  it("does not render the platform health module", () => {
    render(<AdminDashboardPage dashboard={dashboardFixture()} />);

    expect(
      screen.queryByRole("heading", { name: "Saúde da plataforma" }),
    ).not.toBeInTheDocument();
  });

  it("renders the activity chart with aggregate data", () => {
    render(<AdminDashboardPage dashboard={dashboardFixture()} />);

    expect(
      screen.getByRole("img", {
        name: /Evolução da plataforma: 01\/09: 3 pacientes, 2 profissionais e 4 sessões/,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Pacientes cadastrados").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sessões criadas").length).toBeGreaterThan(0);
  });

  it("keeps the main indicators actionable and shows the financial result area", () => {
    render(<AdminDashboardPage dashboard={dashboardFixture()} />);

    expect(
      screen.getByRole("heading", { name: "Resultado financeiro" }),
    ).toBeInTheDocument();

    for (const label of [
      "Receita líquida",
      "Comissão bruta",
      "Taxas Stripe",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(
      screen.getByRole("img", { name: /Resultado financeiro: 01\/09/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/1\.080,00/).length).toBeGreaterThan(0);

    const detailLinks = screen.getAllByRole("link", { name: "Ver detalhes" });

    expect(detailLinks).toHaveLength(5);
    expect(detailLinks[0]).toHaveAttribute(
      "href",
      "/admin/profissionais",
    );
  });
});

function dashboardFixture(): AdminDashboard {
  const metrics = [
    metric("active-patients", "Pacientes ativos", 12, "info"),
    metric("active-therapists", "Profissionais ativos", 8, "success"),
    metric("future-sessions", "Sessões futuras", 6, "info"),
    metric("paid-session-payments", "Sessões pagas", 5, "success"),
    metric("active-subscriptions", "Assinaturas ativas", 4, "success"),
  ];

  return {
    activity: {
      metrics: {
        patients: { current: 12, previous: 9 },
        professionals: { current: 8, previous: 7 },
        sessions: { current: 6, previous: 4 },
      },
      periodLabel: "Últimos 30 dias",
      series: [
        {
          label: "01/09",
          patients: 3,
          professionals: 2,
          sessions: 4,
        },
        {
          label: "05/09",
          patients: 5,
          professionals: 4,
          sessions: 6,
        },
      ],
      status: "available",
    },
    alerts: [],
    events: [],
    financial: {
      currency: "BRL",
      feesStatus: "available",
      metrics: {
        grossCommission: { currentCents: 120000, previousCents: 100000 },
        netRevenue: { currentCents: 108000, previousCents: 91000 },
        stripeFees: { currentCents: 12000, previousCents: 9000 },
      },
      periodLabel: "Últimos 30 dias",
      series: [
        {
          grossCommissionCents: 120000,
          label: "01/09",
          netRevenueCents: 108000,
          stripeFeesCents: 12000,
        },
        {
          grossCommissionCents: 100000,
          label: "05/09",
          netRevenueCents: 91000,
          stripeFeesCents: 9000,
        },
      ],
      status: "available",
    },
    generatedAt: "2026-08-23T12:00:00.000Z",
    modules: [
      {
        description: "Indicadores da operação da plataforma.",
        href: "/admin/sessoes",
        key: "operation",
        label: "Operação",
        metrics,
        status: "ready",
      },
    ],
    summary: metrics,
  };
}

function metric(
  key: string,
  label: string,
  value: number,
  tone: AdminDashboardMetric["tone"],
): AdminDashboardMetric {
  return {
    description:
      key === "active-patients"
        ? "Pacientes cadastrados na plataforma."
        : `${label} disponíveis para acompanhamento.`,
    key,
    label,
    source: "fixture",
    status: "available",
    tone,
    value,
  };
}
