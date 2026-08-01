import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function PatientFavoritesHubRoute() {
  redirect(routes.patient.favoriteTherapists);
}
