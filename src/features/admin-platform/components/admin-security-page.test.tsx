import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdminSecurityPage } from "./admin-security-page";

import type { AdminSecurityPageData } from "../admin-platform.types";

afterEach(cleanup);

describe("AdminSecurityPage", () => {
  it("shows an explicit warning when centralized audit cannot be loaded", () => {
    render(
      <AdminSecurityPage
        data={makeData({
          auditEvents: [],
          auditEventsStatus: "unavailable",
        })}
      />,
    );

    expect(
      screen.getByText(/Auditoria central indisponível/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Sem eventos administrativos recentes acessíveis/i),
    ).not.toBeInTheDocument();
  });

  it("shows the empty audit state only when centralized audit is available", () => {
    render(
      <AdminSecurityPage
        data={makeData({
          auditEvents: [],
          auditEventsStatus: "available",
        })}
      />,
    );

    expect(
      screen.getByText(/Sem eventos administrativos recentes acessíveis/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Auditoria central indisponível/i),
    ).not.toBeInTheDocument();
  });
});

function makeData(
  overrides: Pick<AdminSecurityPageData, "auditEvents" | "auditEventsStatus">,
): AdminSecurityPageData {
  return {
    auditEvents: overrides.auditEvents,
    auditEventsStatus: overrides.auditEventsStatus,
    generatedAt: "2026-08-08T12:00:00.000Z",
    moduleSignals: [
      {
        description: "Sessões administrativas autenticadas.",
        key: "sessions",
        label: "Sessões admin",
        source: "requireAdminSession",
        status: "available",
        tone: "success",
        value: 1,
      },
    ],
    reviewItems: [
      {
        description: "Validar findings reais antes de homologar.",
        key: "advisor",
        label: "Supabase Advisor",
        severity: "warning",
        source: "Supabase HML",
        status: "manual_review",
      },
    ],
  };
}
