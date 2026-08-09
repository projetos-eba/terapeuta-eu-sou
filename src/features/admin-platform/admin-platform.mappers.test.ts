import { describe, expect, it } from "vitest";

import {
  buildIntegrationHealth,
  buildModuleSignals,
  resolveSignalStatus,
} from "./admin-platform.mappers";
import type { AdminOperationalSignal } from "./admin-platform.types";

const baseSignal: AdminOperationalSignal = {
  description: "Sinal de teste.",
  key: "test",
  label: "Teste",
  source: "test",
  status: "available",
  tone: "success",
  value: 0,
};

describe("admin platform mappers", () => {
  it("marks healthy integrations when all available warning signals are zero", () => {
    expect(
      resolveSignalStatus([
        { ...baseSignal, tone: "warning", value: 0 },
        { ...baseSignal, key: "ok", value: 0 },
      ]),
    ).toBe("healthy");
  });

  it("marks integrations as degraded when danger or warning signals are positive", () => {
    expect(
      resolveSignalStatus([{ ...baseSignal, tone: "danger", value: 1 }]),
    ).toBe("degraded");
    expect(
      resolveSignalStatus([{ ...baseSignal, tone: "warning", value: 2 }]),
    ).toBe("degraded");
  });

  it("keeps blocked reads as unavailable instead of zero", () => {
    expect(
      resolveSignalStatus([{ ...baseSignal, status: "unavailable", value: null }]),
    ).toBe("unavailable");
  });

  it("keeps manual review signals explicit", () => {
    expect(
      resolveSignalStatus([{ ...baseSignal, status: "manual", value: null }]),
    ).toBe("manual_review");
  });

  it("builds integration health from signals", () => {
    expect(
      buildIntegrationHealth({
        description: "Stripe operacional.",
        key: "stripe",
        label: "Stripe",
        signals: [{ ...baseSignal, tone: "warning", value: 3 }],
      }).status,
    ).toBe("degraded");
  });

  it("builds module visibility signals for the admin shell", () => {
    expect(buildModuleSignals({ enabledCount: 5, hiddenCount: 10 })).toEqual([
      expect.objectContaining({
        key: "enabled-admin-modules",
        status: "available",
        value: 5,
      }),
      expect.objectContaining({
        key: "hidden-admin-modules",
        tone: "warning",
        value: 10,
      }),
    ]);
  });
});
