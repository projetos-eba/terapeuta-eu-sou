import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auraEnabledMock = vi.hoisted(() => vi.fn());
const getAuraPageMock = vi.hoisted(() => vi.fn());
const requireSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/therapist-shell", () => ({
  therapistRoutePolicies: { assessorIa: { capability: "aura_full" } },
}));

vi.mock("@/lib/auth/therapist-session", () => ({
  requireTherapistSession: requireSessionMock,
}));

vi.mock("@/features/therapist-aura", () => ({
  getTherapistAuraPage: getAuraPageMock,
  isTherapistAuraEnabled: auraEnabledMock,
  TherapistAuraComingSoon: () => <p>Aura em breve</p>,
  TherapistAuraErrorState: () => <p>Erro Aura</p>,
  TherapistAuraPage: () => <p>Painel Aura</p>,
}));

import TherapistAssessorIaPage from "./page";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/terapeuta/assessor-ia", () => {
  it("renders the authenticated soft-launch page without loading Aura data", async () => {
    auraEnabledMock.mockReturnValue(false);
    requireSessionMock.mockResolvedValue({});

    render(await TherapistAssessorIaPage({}));

    expect(screen.getByText("Aura em breve")).toBeInTheDocument();
    expect(requireSessionMock).toHaveBeenCalledWith();
    expect(getAuraPageMock).not.toHaveBeenCalled();
  });

  it("restores the entitled page when the feature is enabled", async () => {
    auraEnabledMock.mockReturnValue(true);
    requireSessionMock.mockResolvedValue({
      accessToken: "token",
      plan: "premium_plus",
      profileId: "profile-id",
    });
    getAuraPageMock.mockResolvedValue({ data: {}, ok: true });

    render(await TherapistAssessorIaPage({}));

    expect(requireSessionMock).toHaveBeenCalledWith({
      capability: "aura_full",
    });
    expect(getAuraPageMock).toHaveBeenCalledWith({
      accessToken: "token",
      periodDays: 30,
      plan: "premium_plus",
      profileId: "profile-id",
    });
    expect(screen.getByText("Painel Aura")).toBeInTheDocument();
  });
});
