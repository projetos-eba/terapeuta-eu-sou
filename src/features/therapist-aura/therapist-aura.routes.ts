import { routes } from "@/lib/routes";

import type { AuraActionRouteKey } from "./therapist-aura.types";

export const auraActionRoutes: Record<AuraActionRouteKey, string> = {
  agenda: routes.therapist.agenda,
  insights: routes.therapist.insights,
  profile: routes.therapist.profile,
  reviews: routes.therapist.reviews,
  services: routes.therapist.services,
  sessions: routes.therapist.sessions,
};
