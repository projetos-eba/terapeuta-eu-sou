import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminMetricsTelemetryControl } from "./admin-metrics-telemetry-control";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

describe("admin metrics telemetry control", () => {
  it("shows the active state and offers only the contextual shutdown action", () => {
    render(
      <AdminMetricsTelemetryControl
        canManage
        telemetry={{
          enabled: true,
          retentionDays: 120,
          updatedAt: "2026-09-28T12:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Ativa")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desligar coleta" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar coleta" })).toBeNull();
  });

  it("requires an administrative justification before activation", () => {
    render(
      <AdminMetricsTelemetryControl
        canManage
        telemetry={{ enabled: false, retentionDays: 120, updatedAt: null }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ativar coleta" }));

    expect(
      screen.getByRole("heading", { name: /confirmar: ativar coleta/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirmar: ativar coleta/i }),
    ).toBeDisabled();
    expect(screen.getByText(/Entre 8 e 500 caracteres/i)).toBeInTheDocument();
  });

  it("keeps the control read-only without the management permission", () => {
    render(
      <AdminMetricsTelemetryControl
        canManage={false}
        telemetry={{ enabled: false, retentionDays: 120, updatedAt: null }}
      />,
    );

    expect(screen.getByText("Desligada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar coleta" })).toBeNull();
    expect(screen.getByText(/não possui acesso para alterá-la/i)).toBeInTheDocument();
  });
});
