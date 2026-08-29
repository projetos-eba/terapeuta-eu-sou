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
      screen.getByText(/Os registros de auditoria estão indisponíveis/i),
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

  it("presents catalogued audit events in Portuguese", () => {
    render(
      <AdminSecurityPage
        data={makeData({
          auditEvents: [
            {
              actorRole: "admin",
              createdAt: "2026-08-08T12:00:00.000Z",
              entityType: "therapist_profile",
              eventType: "professional.publish",
              id: "audit-1",
              permission: "admin.professionals.verify",
              reason: null,
              source: "admin-operation-command",
            },
          ],
          auditEventsStatus: "available",
        })}
      />,
    );

    expect(
      screen.getByText("Perfil profissional publicado"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/perfil profissional · Administração/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("professional.publish")).not.toBeInTheDocument();
  });
});

function makeData(
  overrides: Pick<AdminSecurityPageData, "auditEvents" | "auditEventsStatus">,
): AdminSecurityPageData {
  return {
    auditEvents: overrides.auditEvents,
    auditEventsStatus: overrides.auditEventsStatus,
  };
}
