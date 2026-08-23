import { TherapistPlan, type TherapistCapability } from "@/domain/tes";
import { routes } from "@/lib/routes";

export type TherapistRoutePolicy = {
  capability?: TherapistCapability;
  minimumPlan?: TherapistPlan;
  requiresReceivingAccount?: boolean;
};

export const therapistRoutePolicies = {
  agenda: {
    capability: "operation_essentials",
    requiresReceivingAccount: true,
  },
  assessorIa: {
    capability: "aura_full",
  },
  finance: {
    capability: "operation_essentials",
  },
  home: {},
  insights: {
    capability: "advanced_metrics",
  },
  messages: {
    capability: "operation_essentials",
  },
  patients: {
    capability: "full_crm",
  },
  plan: {},
  profile: {
    capability: "operation_essentials",
  },
  reviews: {
    minimumPlan: TherapistPlan.Premium,
  },
  services: {
    capability: "operation_essentials",
  },
  sessions: {
    capability: "operation_essentials",
    requiresReceivingAccount: true,
  },
  settings: {
    capability: "operation_essentials",
  },
} satisfies Record<string, TherapistRoutePolicy>;

const legacySpecialCases: Record<string, string> = {
  "/basico/pagamento": routes.therapist.finance,
  "/basico/upgrade": routes.therapist.plan,
  "/plus/avaliações": routes.therapist.reviews,
  "/plus/ia": routes.therapist.assessorIa,
  "/plus/serviços": routes.therapist.services,
  "/pro/metricas": routes.therapist.insights,
  "/pro/plano": routes.therapist.plan,
};

export function getCanonicalTherapistPath(value: string) {
  const url = new URL(value, "http://tes.local");
  if (url.origin !== "http://tes.local") return value;

  const specialCase = legacySpecialCases[url.pathname];

  if (specialCase) {
    return `${specialCase}${url.search}${url.hash}`;
  }

  const match = url.pathname.match(/^\/(?:basico|pro|plus)(\/.*)?$/);
  if (!match) return value;

  return `${routes.therapist.home}${match[1] ?? ""}${url.search}${url.hash}`;
}
