import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function TherapistOwnServicesPage() {
  redirect(routes.therapist.services);
}
