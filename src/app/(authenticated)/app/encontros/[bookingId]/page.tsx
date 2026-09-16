import { notFound } from "next/navigation";

import {
  BookingDetailDataError,
  getPatientSessionDetailPage,
} from "@/features/booking-detail";
import { PatientSessionDetailPage } from "@/features/patient-session-detail";
import { requirePatientSession } from "@/lib/auth/patient-session";

export default async function PatientEncounterDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams?: Promise<{ feedback?: string | string[] }>;
}) {
  const { bookingId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
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
        feedbackOpen={firstString(resolvedSearchParams.feedback) === "1"}
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

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
