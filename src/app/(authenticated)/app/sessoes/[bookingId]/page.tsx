import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function LegacyPatientSessionDetailRoute({
  params,
}: {
  params: { bookingId: string };
}) {
  redirect(routes.patient.encounterDetail(params.bookingId));
}
