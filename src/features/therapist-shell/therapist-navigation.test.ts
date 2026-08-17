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

    expect(
      navigation
        .filter((item) => item.accessState !== "hidden")
        .map((item) => item.href),
    ).toEqual([
      routes.therapist.home,
      routes.therapist.agenda,
      routes.therapist.patients,
      routes.therapist.sessions,
      routes.therapist.messages,
      routes.therapist.services,
      routes.therapist.profile,
      routes.therapist.reviews,
      routes.therapist.insights,
      routes.therapist.assessorIa,
      routes.therapist.finance,
      routes.therapist.settings,
    ]);
    expect(navigation.every((item) => item.accessState === "enabled")).toBe(
      false,
    );
    expect(
      navigation.find((item) => item.label === "Upgrade")?.accessState,
    ).toBe("hidden");
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
    ).toBe(routes.therapist.plan);
    expect(
      navigation.find((item) => item.label === "Avaliações")?.accessState,
    ).toBe("enabled");
    expect(navigation.find((item) => item.label === "Upgrade")).toMatchObject({
      accessState: "enabled",
      href: routes.therapist.plan,
      tone: "upgrade",
    });
    expect(navigation.find((item) => item.label === "Ajuda")).toBeUndefined();
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
    expect(navigation.every((item) => item.href.startsWith("/terapeuta"))).toBe(
      true,
    );
    expect(
      navigation.find((item) => item.label === "Upgrade")?.accessState,
    ).toBe("enabled");
  });
});
