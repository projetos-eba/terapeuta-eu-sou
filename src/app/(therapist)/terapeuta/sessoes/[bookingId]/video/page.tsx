import { notFound } from "next/navigation";

import { formatSessionDateTime } from "@/features/bookings";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { getTherapistSessionDetail } from "@/features/therapist-sessions";
import { ZoomVideoCallPage } from "@/features/zoom/components/zoom-video-call-page";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

export default async function TherapistVideoCallRoute({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const session = await requireTherapistSession(
    therapistRoutePolicies.sessions,
  );
  const result = await getTherapistSessionDetail({
    accessToken: session.accessToken,
    bookingId,
    profileId: session.profileId,
  });

  if (result.status === "empty") notFound();
  if (result.status === "error") throw new Error("session_video_unavailable");

  const booking = result.data;

  return (
    <ZoomVideoCallPage
      access={booking.zoomAccess}
      actorRole="therapist"
      backHref={routes.therapist.sessionDetail(bookingId)}
      bookingId={bookingId}
      participantLabel={`Com ${booking.patientName}`}
      scheduleLabel={formatSessionDateTime(booking.startsAt, booking.timezone)}
      sessionTitle={booking.serviceTitle}
    />
  );
}
