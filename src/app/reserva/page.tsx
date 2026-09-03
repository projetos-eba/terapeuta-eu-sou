import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getClientSessionSummary } from "@/features/client-auth/session-summary";
import {
  formatAvailabilityDateKey,
  getPublicServiceAvailability,
  getPublicServiceAvailabilityForWindow,
  isDateKey,
} from "@/features/availability/queries/public-service-availability";
import {
  applyPatientScheduleConflicts,
  getReservationScheduleWindow,
  mergeReservationContextWithPublicProfile,
  reconcileReservationContextWithAvailability,
  ReservationPage,
  resolveReservationContext,
} from "@/features/public-reservation";
import { getPatientScheduleIntervals } from "@/features/public-reservation/queries/patient-schedule";
import { getReservationRetrySnapshot } from "@/features/public-reservation/queries/reservation-retry-context";
import { getPublicTherapistProfileResult } from "@/features/therapist-profile/queries/public-profile";
import type { AvailabilityDay } from "@/features/therapist-profile/types";

export const metadata: Metadata = {
  description:
    "Finalize sua reserva online no Terapeuta Eu Sou com acesso de cliente, políticas claras e pagamento seguro.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Reserva online | Terapeuta Eu Sou",
};

export const dynamic = "force-dynamic";

export default async function PublicReservationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tes_patient_access_token")?.value;
  const patient = await getClientSessionSummary(accessToken);
  const requestedBooking =
    typeof params?.booking === "string" ? params.booking : null;
  const retrySnapshot =
    accessToken && requestedBooking
      ? await getReservationRetrySnapshot({
          accessToken,
          bookingId: requestedBooking,
        })
      : null;
  const trustedParams = retrySnapshot
    ? {
        ...params,
        booking: retrySnapshot.bookingId,
        duration: String(retrySnapshot.durationMinutes),
        etapa: "pagamento",
        price: String(retrySnapshot.priceCents),
        service: retrySnapshot.serviceId,
        serviceName: retrySnapshot.serviceLabel,
        slot: retrySnapshot.startsAt,
        therapist: retrySnapshot.therapist.slug,
      }
    : requestedBooking
      ? { ...params, booking: undefined }
      : params;
  let context = resolveReservationContext({
    isPatientAuthenticated: Boolean(patient),
    patient,
    searchParams: trustedParams,
    timezone: retrySnapshot?.timezone,
  });
  if (retrySnapshot) {
    context = {
      ...context,
      canPrepareEncounter: true,
      therapist: retrySnapshot.therapist,
    };
  }
  let availabilityDays: AvailabilityDay[] = [];

  if (context.therapist.slug && !retrySnapshot) {
    const profileResult = await getPublicTherapistProfileResult(
      context.therapist.slug,
    );

    if (profileResult.status === "success" || profileResult.status === "demo") {
      const { profile } = profileResult.data;
      const selectedService =
        profile.services.find((service) => service.id === context.serviceId) ??
        profile.services.find(
          (service) => service.therapySlug === context.therapySlug,
        ) ??
        profile.services[0];

      const serviceTimezone =
        selectedService?.availabilityTimezone ?? context.timezone;
      const requestedDate =
        typeof trustedParams?.date === "string" && isDateKey(trustedParams.date)
          ? trustedParams.date
          : null;
      let anchorDate = context.selectedSlot
        ? formatAvailabilityDateKey(
            new Date(context.selectedSlot),
            serviceTimezone,
          )
        : requestedDate;
      let discoveryResult = null;

      if (selectedService && !anchorDate) {
        const knownFirstDate = selectedService.availability
          .filter((day) => day.slots.length > 0)
          .map((day) => day.date)
          .sort()[0];
        anchorDate = knownFirstDate ?? null;

        if (!anchorDate) {
          const rangeStart = new Date();
          const rangeEnd = new Date(rangeStart);
          rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 91);
          discoveryResult = await getPublicServiceAvailability(
            selectedService.id,
            { end: rangeEnd, start: rangeStart },
          );
          anchorDate =
            discoveryResult.status === "success"
              ? (discoveryResult.data.days[0]?.date ?? null)
              : null;
        }
      }

      anchorDate ??= formatAvailabilityDateKey(new Date(), serviceTimezone);
      const availabilityResult = selectedService
        ? await getPublicServiceAvailabilityForWindow(
            selectedService.id,
            anchorDate,
            serviceTimezone,
          )
        : null;
      availabilityDays =
        availabilityResult?.status === "success"
          ? availabilityResult.data.days
          : [];
      context = mergeReservationContextWithPublicProfile(context, {
        avatarUrl: profile.heroImage,
        headline: profile.headline,
        isVerified: profile.isVerified,
        name: profile.name,
        service: selectedService
          ? {
              durationMinutes: selectedService.durationMinutes,
              priceCents: selectedService.priceCents,
              priceLabel: selectedService.priceLabel,
              therapySlug: selectedService.therapySlug,
              title: selectedService.title,
            }
          : undefined,
        slug: profile.slug,
        timezone:
          availabilityResult?.status === "success"
            ? availabilityResult.data.timezone
            : discoveryResult?.status === "success"
              ? discoveryResult.data.timezone
              : undefined,
      });
      const scheduleWindow = getReservationScheduleWindow(
        availabilityDays,
        context,
      );
      if (accessToken && patient && scheduleWindow) {
        const patientSchedule = await getPatientScheduleIntervals({
          accessToken,
          ...scheduleWindow,
        });
        if (patientSchedule.status === "success") {
          const filtered = applyPatientScheduleConflicts({
            availabilityDays,
            context,
            intervals: patientSchedule.intervals,
          });
          availabilityDays = filtered.availabilityDays;
          context = filtered.context;
        } else {
          context = {
            ...context,
            patientScheduleCheckStatus: "unavailable",
          };
        }
      }
      context = reconcileReservationContextWithAvailability(
        context,
        availabilityDays,
      );
    } else {
      context = reconcileReservationContextWithAvailability(context, []);
    }
  }

  return (
    <ReservationPage availabilityDays={availabilityDays} context={context} />
  );
}
