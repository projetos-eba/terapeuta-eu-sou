import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type {
  AdminDashboard,
  AdminDashboardMetric,
} from "../admin-dashboard.types";
import { AdminDashboardPage } from "./admin-dashboard-page";

afterEach(cleanup);

describe("AdminDashboardPage", () => {
  it("exposes details for each evolution point", () => {
    render(<AdminDashboardPage dashboard={dashboardFixture()} />);

    expect(
      screen.getByRole("img", {
        name: "Detalhes de Pacientes ativos: 12",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Valor atual: 12")).toBeInTheDocument();
    expect(
      screen.getByText("Pacientes cadastrados na plataforma."),
    ).toBeInTheDocument();
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
    alerts: [],
    events: [],
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
