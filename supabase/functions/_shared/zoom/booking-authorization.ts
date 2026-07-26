import { SupabaseRestClient } from "../auth/supabase-rest.ts";
import { DomainError } from "../payments/http.ts";

export type ZoomAuthorizedBooking = {
  booking: {
    ends_at: string;
    id: string;
    patient_profile_id: string;
    payment_status: string;
    starts_at: string;
    status: string;
    therapist_profile_id: string;
    timezone: string;
  };
  displayName: string;
  role: "patient" | "therapist";
};

export async function getAuthorizedZoomBooking(input: {
  bookingId: string;
  client: SupabaseRestClient;
  profileId: string;
  role: "patient" | "therapist";
}) {
  const rows = await input.client.get<Array<ZoomAuthorizedBooking["booking"]>>(
    `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,starts_at,ends_at,timezone,status,payment_status&id=eq.${encodeURIComponent(input.bookingId)}&limit=1`,
  );
  const booking = rows[0];

  if (!booking) {
    throw new DomainError("booking_not_found", 404, "Sessao nao encontrada.");
  }

  if (
    input.role === "patient" &&
    booking.patient_profile_id !== input.profileId
  ) {
    throw new DomainError("booking_forbidden", 403, "Sessao indisponivel.");
  }

  if (
    input.role === "therapist" &&
    booking.therapist_profile_id !== input.profileId
  ) {
    throw new DomainError("booking_forbidden", 403, "Sessao indisponivel.");
  }

  if (booking.payment_status !== "paid") {
    throw new DomainError(
      "booking_unpaid",
      409,
      "A sala sera liberada quando o pagamento estiver confirmado.",
    );
  }

  if (
    ["cancelled_by_patient", "cancelled_by_therapist", "refunded"].includes(
      booking.status,
    )
  ) {
    throw new DomainError(
      "booking_closed",
      409,
      "Esta sessao nao esta disponivel para acesso.",
    );
  }

  return booking;
}

export function sanitizeZoomDisplayName(value: string | null | undefined) {
  return (
    (value ?? "Participante TES")
      .replace(/[^\p{L}\p{N}\s.'-]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 64) || "Participante TES"
  );
}
