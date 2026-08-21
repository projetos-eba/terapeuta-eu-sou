import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getClientSessionSummary } from "@/features/client-auth/session-summary";
import { getPublicServiceAvailability } from "@/features/availability/queries/public-service-availability";
import {
  mergeReservationContextWithPublicProfile,
  reconcileReservationContextWithAvailability,
  ReservationPage,
  resolveReservationContext,
} from "@/features/public-reservation";
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
  let context = resolveReservationContext({
    isPatientAuthenticated: Boolean(patient),
    patient,
    searchParams: params,
  });
  let availabilityDays: AvailabilityDay[] = [];

  if (context.therapist.slug) {
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

      const availabilityResult = selectedService
        ? await getPublicServiceAvailability(selectedService.id)
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
            : undefined,
      });
      context = reconcileReservationContextWithAvailability(
        context,
        availabilityDays,
      );
    } else {
      context = reconcileReservationContextWithAvailability(context, []);
    }
  }

  return <ReservationPage availabilityDays={availabilityDays} context={context} />;
}
