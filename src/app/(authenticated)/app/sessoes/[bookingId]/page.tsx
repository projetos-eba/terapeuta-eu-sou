import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default async function LegacyPatientSessionDetailRoute({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  redirect(routes.patient.encounterDetail(bookingId));
}
