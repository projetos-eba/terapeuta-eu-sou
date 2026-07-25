import { describe, expect, it } from "vitest";

import { TherapistPlan } from "@/domain/tes";
import { routes } from "@/lib/routes";

import { buildTherapistNavigation } from "./therapist-navigation";

describe("buildTherapistNavigation", () => {
  it("builds the complete Premium Plus navigation", () => {
    const navigation = buildTherapistNavigation({
      plan: TherapistPlan.PremiumPlus,
      unreadMessagesCount: 4,
    });

    expect(navigation.map((item) => item.href)).toEqual([
      routes.therapist.plusHome,
      routes.therapist.plusAgenda,
      routes.therapist.plusPatients,
      routes.therapist.plusSessions,
      routes.therapist.plusMessages,
      routes.therapist.plusServices,
      routes.therapist.plusProfile,
      routes.therapist.plusReviews,
      routes.therapist.plusInsights,
      routes.therapist.plusAssessorIa,
      routes.therapist.plusFinance,
      routes.therapist.plusSettings,
      routes.therapist.plusSupport,
    ]);
    expect(navigation.every((item) => item.accessState === "enabled")).toBe(
      true,
    );
    expect(navigation.find((item) => item.label === "Mensagens")?.badge).toBe(
      4,
    );
  });

  it("locks Plus capabilities for Premium without creating alternate routes", () => {
    const navigation = buildTherapistNavigation({
      plan: TherapistPlan.Premium,
      unreadMessagesCount: 0,
    });

    expect(
      navigation.find((item) => item.label === "Aura IA")?.accessState,
    ).toBe("locked");
    expect(
      navigation.find((item) => item.label === "Histórico da Jornada")
        ?.upgradeHref,
    ).toBe(routes.therapist.proPlan);
    expect(
      navigation.find((item) => item.label === "Avaliações")?.accessState,
    ).toBe("enabled");
  });

  it("keeps essential Free features enabled", () => {
    const navigation = buildTherapistNavigation({
      plan: TherapistPlan.Free,
      unreadMessagesCount: 2,
    });

    expect(
      navigation.find((item) => item.label === "Agenda")?.accessState,
    ).toBe("enabled");
    expect(
      navigation.find((item) => item.label === "Métricas & Relatórios")
        ?.accessState,
    ).toBe("locked");
  });
});
