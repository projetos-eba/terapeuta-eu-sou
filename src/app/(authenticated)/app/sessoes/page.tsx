import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function LegacyPatientSessionsRoute() {
  redirect(routes.patient.encounters);
}
