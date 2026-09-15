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
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const session = await requirePatientSession();

  try {
    const data = await getPatientSessionDetailPage({
      accessToken: session.accessToken,
      bookingId,
      profileId: session.profileId,
    });

    return (
      <PatientSessionDetailPage
        data={data}
        stripePublishableKey={
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ""
        }
      />
    );
  } catch (error) {
    if (error instanceof BookingDetailDataError && error.code === "not_found") {
      notFound();
    }

    throw error;
  }
}
