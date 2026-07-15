import { routes } from "@/lib/routes";

export type PublicBookingSnapshot = {
  durationMinutes: number;
  priceCents: number;
  serviceId: string;
  slotStartsAt?: string;
  therapistSlug: string;
};

export function buildPublicReservationUrl(snapshot: PublicBookingSnapshot) {
  const params = new URLSearchParams({
    duration: String(snapshot.durationMinutes),
    price: String(snapshot.priceCents),
    service: snapshot.serviceId,
    therapist: snapshot.therapistSlug,
  });

  if (snapshot.slotStartsAt) {
    params.set("slot", snapshot.slotStartsAt);
  }

  return `${routes.public.reservation}?${params.toString()}`;
}

export function canStartPublicReservation(slotStartsAt: string | undefined) {
  if (!slotStartsAt) return false;

  return new Date(slotStartsAt).getTime() > Date.now();
}
