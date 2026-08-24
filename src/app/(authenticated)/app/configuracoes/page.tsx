import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function PatientSettingsRedirectPage() {
  redirect(routes.patient.profileSettings);
}
