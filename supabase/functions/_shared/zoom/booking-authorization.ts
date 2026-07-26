import { SupabaseRestClient } from "../auth/supabase-rest.ts";
import { DomainError } from "../payments/http.ts";

type ZoomBookingRow = {
  ends_at: string;
  id: string;
  patient_profile_id: string;
  starts_at: string;
  status: string;
  therapist_profile_id: string;
  timezone: string;
};

export type ZoomAuthorizedBooking = ZoomBookingRow & {
  financial_status: string | null;
};

export async function getAuthorizedZoomBooking(input: {
  bookingId: string;
  client: SupabaseRestClient;
  profileId: string;
  role: "patient" | "therapist";
}) {
  const rows = await input.client.get<ZoomBookingRow[]>(
    `/rest/v1/bookings?select=id,patient_profile_id,therapist_profile_id,starts_at,ends_at,timezone,status&id=eq.${encodeURIComponent(input.bookingId)}&limit=1`,
  );
  const bookingRow = rows[0];

  if (!bookingRow) {
    throw new DomainError("booking_not_found", 404, "Sessao nao encontrada.");
  }

  if (
    input.role === "patient" &&
    bookingRow.patient_profile_id !== input.profileId
  ) {
    throw new DomainError("booking_forbidden", 403, "Sessao indisponivel.");
  }

  if (
    input.role === "therapist" &&
    bookingRow.therapist_profile_id !== input.profileId
  ) {
    throw new DomainError("booking_forbidden", 403, "Sessao indisponivel.");
  }

  const [payment] = await input.client.get<
    Array<{ financial_status: string }>
  >(
    `/rest/v1/session_payments?select=financial_status&booking_id=eq.${encodeURIComponent(input.bookingId)}&limit=1`,
  );

  return {
    ...bookingRow,
    financial_status: payment?.financial_status ?? null,
  };
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
