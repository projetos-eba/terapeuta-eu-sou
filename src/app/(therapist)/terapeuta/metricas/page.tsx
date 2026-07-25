import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function TherapistMetricsAliasPage() {
  redirect(routes.therapist.insights);
}
