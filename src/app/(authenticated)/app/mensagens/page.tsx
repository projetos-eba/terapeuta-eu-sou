import { permanentRedirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function PatientMessagesPage() {
  permanentRedirect(routes.patient.support);
}
