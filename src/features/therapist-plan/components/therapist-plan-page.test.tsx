import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TherapistPlan } from "@/domain/tes";

import type { TherapistPlanPageData } from "../therapist-plan.types";
import { TherapistPlanPage } from "./therapist-plan-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("TherapistPlanPage", () => {
  afterEach(cleanup);

  it("offers both paid plans to a Free therapist using real catalog prices", () => {
    render(<TherapistPlanPage data={fixture("free")} />);

    expect(screen.getByText("Seu plano atual:")).toHaveTextContent("TES Free");
    expect(screen.getByText("R$ 60,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 120,00")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Fazer upgrade" })).toHaveLength(
      2,
    );
  });

  it("offers only Premium Plus to a Premium therapist", () => {
    render(<TherapistPlanPage data={fixture("premium")} />);

    expect(screen.getByText("Seu plano atual:")).toHaveTextContent(
      "TES Premium",
    );
    expect(
      screen.getByRole("button", {
        name: "Fazer upgrade para Premium Plus",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fazer upgrade" })).toBeNull();
  });

  it("does not offer downgrade or upgrade to a Premium Plus therapist", () => {
    render(<TherapistPlanPage data={fixture("premium_plus")} />);

    expect(screen.getByText("Seu plano atual:")).toHaveTextContent(
      "TES Premium Plus",
    );
    expect(screen.getByText("Mais completo")).toBeInTheDocument();
    expect(screen.queryByText(/Fazer upgrade/)).toBeNull();
    expect(screen.queryByText(/Mudar para Premium/)).toBeNull();
  });
});

function fixture(effectivePlan: TherapistPlan): TherapistPlanPageData {
  return {
    catalog: [
      {
        code: "free",
        currency: "BRL",
        description: "",
        interval: null,
        name: "Free",
        unitAmountCents: 0,
      },
      {
        code: "premium",
        currency: "BRL",
        description: "",
        interval: "month",
        name: "Premium",
        unitAmountCents: 6000,
      },
      {
        code: "premium_plus",
        currency: "BRL",
        description: "",
        interval: "month",
        name: "Premium Plus",
        unitAmountCents: 12000,
      },
    ],
    effectivePlan,
    subscription:
      effectivePlan === "free"
        ? null
        : {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: "2026-09-11T03:00:00.000Z",
            plan: effectivePlan,
            scheduledChangeAt: null,
            scheduledPlan: null,
            status: "active",
          },
  };
}
