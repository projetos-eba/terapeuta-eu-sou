import { notFound } from "next/navigation";

import {
  BookingDetailDataError,
  getPatientSessionDetailPage,
} from "@/features/booking-detail";
import { PatientSessionDetailPage } from "@/features/patient-session-detail";
import { requirePatientSession } from "@/lib/auth/patient-session";

export default async function PatientEncounterDetailRoute({
  params,
}: {
  params: { bookingId: string };
}) {
  const session = await requirePatientSession();

  try {
    const data = await getPatientSessionDetailPage({
      bookingId: params.bookingId,
      profileId: session.profileId,
    });

    return <PatientSessionDetailPage data={data} />;
  } catch (error) {
    if (
      error instanceof BookingDetailDataError &&
      error.code === "not_found"
    ) {
      notFound();
    }

    throw error;
  }
}
