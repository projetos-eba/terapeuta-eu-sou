import { notFound } from "next/navigation";

import {
  BookingDetailDataError,
  getPatientSessionDetailPage,
} from "@/features/booking-detail";
import { ZoomVideoCallPage } from "@/features/zoom/components/zoom-video-call-page";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { routes } from "@/lib/routes";

export default async function PatientVideoCallRoute({
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

    if (data.onlineSession.provider !== "zoom") notFound();

    return (
      <ZoomVideoCallPage
        access={null}
        actorRole="patient"
        backHref={routes.patient.encounterDetail(bookingId)}
        bookingId={bookingId}
        participantLabel={`Com ${data.therapist.name}`}
        scheduleLabel={`${data.booking.dateLabel}, ${data.booking.timeRangeLabel}`}
        sessionTitle={data.service.title}
      />
    );
  } catch (error) {
    if (error instanceof BookingDetailDataError && error.code === "not_found") {
      notFound();
    }

    throw error;
  }
}
