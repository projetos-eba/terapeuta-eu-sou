import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TherapistPlan } from "@/domain/tes";

import type { TherapistPlanPageData } from "../therapist-plan.types";
import { TherapistPlanPage } from "./therapist-plan-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("TherapistPlanPage", () => {
  afterEach(cleanup);

  it("offers both monthly paid plans to a Free therapist using real catalog prices", () => {
    render(<TherapistPlanPage data={fixture("free")} />);

    expect(
      screen.getByRole("heading", { name: "Meu plano" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Resumo do plano atual")).getByText("Free"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("R$ 79,90").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 129,90").length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("link", { name: /Assinar/ })
        .map((link) => link.getAttribute("href")),
    ).toEqual(
      expect.arrayContaining([
        "/terapeuta/checkout?plan=premium",
        "/terapeuta/checkout?plan=premium_plus",
      ]),
    );
  });

  it("offers only Premium Plus to a Premium therapist", () => {
    render(<TherapistPlanPage data={fixture("premium")} />);

    expect(
      within(screen.getByLabelText("Resumo do plano atual")).getByText(
        "Premium",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Escolher Premium Plus",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Escolher plano" })).toBeNull();
  });

  it("does not offer downgrade or upgrade to a Premium Plus therapist", () => {
    render(<TherapistPlanPage data={fixture("premium_plus")} />);

    expect(
      within(screen.getByLabelText("Resumo do plano atual")).getByText(
        "Premium Plus",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Seu plano mais completo")).toBeInTheDocument();
    expect(screen.queryByText(/Escolher plano/)).toBeNull();
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
        unitAmountCents: 7990,
      },
      {
        code: "premium_plus",
        currency: "BRL",
        description: "",
        interval: "month",
        name: "Premium Plus",
        unitAmountCents: 12990,
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
