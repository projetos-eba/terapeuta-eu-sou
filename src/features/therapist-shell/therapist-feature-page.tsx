import { requireTherapistSession } from "@/lib/auth/therapist-session";

import { TherapistConstructionPage } from "./therapist-construction-page";
import type { TherapistRoutePolicy } from "./therapist-route-policy";

export async function TherapistFeaturePage({
  policy,
  title,
}: {
  policy: TherapistRoutePolicy;
  title: string;
}) {
  await requireTherapistSession(policy);

  return <TherapistConstructionPage title={title} />;
}
