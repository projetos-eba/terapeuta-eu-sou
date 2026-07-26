import { canJoinBooking } from "@/features/bookings/booking-status";

import type { BookingDetailStatus } from "./booking-detail.types";

export function getBookingDetailStatus(input: {
  endsAt: string;
  meetingUrl: string | null;
  startsAt: string;
  status: string;
}): BookingDetailStatus {
  if (
    canJoinBooking({
      endsAt: input.endsAt,
      meetingUrl: input.meetingUrl,
      startsAt: input.startsAt,
      status: input.status,
    })
  ) {
    return "live";
  }

  return input.status as BookingDetailStatus;
}

export function getBookingDetailStatusLabel(status: BookingDetailStatus) {
  const labels: Record<string, string> = {
    cancelled_by_patient: "Cancelada",
    cancelled_by_therapist: "Cancelada",
    completed: "Realizada",
    confirmed: "Confirmada",
    draft: "Rascunho",
    live: "Ao vivo agora",
    no_show_patient: "Não comparecimento",
    no_show_therapist: "Não realizada",
    pending_payment: "Pagamento pendente",
    refunded: "Reembolsada",
  };

  return labels[status] ?? "Em análise";
}

export function canExposeMeetingUrl(input: {
  meetingUrl: string | null;
  paymentStatus: string | null;
  status: string;
}) {
  if (!input.meetingUrl || input.paymentStatus !== "paid") return false;

  return ![
    "cancelled_by_patient",
    "cancelled_by_therapist",
    "no_show_patient",
    "no_show_therapist",
    "refunded",
  ].includes(input.status);
}
