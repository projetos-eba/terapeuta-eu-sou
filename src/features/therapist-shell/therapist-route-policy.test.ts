import { describe, expect, it } from "vitest";

import { routes } from "@/lib/routes";

import { getCanonicalTherapistPath } from "./therapist-route-policy";

describe("getCanonicalTherapistPath", () => {
  it.each([
    ["/basico", routes.therapist.home],
    ["/pro/agenda", routes.therapist.agenda],
    ["/plus/sessoes/booking-1", routes.therapist.sessionDetail("booking-1")],
    ["/basico/pagamento", routes.therapist.finance],
    ["/basico/upgrade", routes.therapist.plan],
    ["/pro/metricas", routes.therapist.insights],
    ["/pro/plano", routes.therapist.plan],
  ])("maps %s to %s", (legacy, canonical) => {
    expect(getCanonicalTherapistPath(legacy)).toBe(canonical);
  });

  it("preserves query strings and fragments", () => {
    expect(
      getCanonicalTherapistPath(
        "/plus/pacientes/patient-1?tab=historico#sessao",
      ),
    ).toBe(
      `${routes.therapist.patientJourney("patient-1")}?tab=historico#sessao`,
    );
  });

  it("does not intercept public therapist routes", () => {
    expect(getCanonicalTherapistPath("/terapeutas/ana-oliveira")).toBe(
      "/terapeutas/ana-oliveira",
    );
    expect(getCanonicalTherapistPath("/terapeuta/agenda")).toBe(
      "/terapeuta/agenda",
    );
    expect(getCanonicalTherapistPath("https://example.com/plus")).toBe(
      "https://example.com/plus",
    );
  });
});
