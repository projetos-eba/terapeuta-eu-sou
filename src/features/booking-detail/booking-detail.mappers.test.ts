import { SessionFinancialStatus } from "@/domain/tes";
import { describe, expect, it } from "vitest";

import {
  mapBookingDetail,
  type MapBookingDetailInput,
} from "./booking-detail.mappers";

describe("mapBookingDetail", () => {
  it("presents a future V10 reservation without a provisioned provider as Zoom", () => {
    const result = mapBookingDetail(createInput());

    expect(result.booking).toMatchObject({
      canJoin: false,
      statusLabel: "Reservado",
    });
    expect(result.onlineSession.provider).toBe("zoom");
    expect(result.encounterState.waitingRoom).toEqual({
      kind: "payment_required",
      message: "A sala será liberada quando o pagamento for confirmado.",
      title: "Pagamento necessário",
    });
  });

  it("preserves an explicit external provider for a future V10 reservation", () => {
    const input = createInput();
    const result = mapBookingDetail({
      ...input,
      booking: { ...input.booking, meeting_provider: "external" },
    });

    expect(result.onlineSession.provider).toBe("external");
    expect(result.encounterState.waitingRoom.kind).toBe(
      "operational_unavailable",
    );
    expect(result.encounterState.waitingRoom.message).not.toContain("Zoom");
  });

  it("keeps a server-authorized V10 retry attached to the platform room", () => {
    const input = createInput();
    const result = mapBookingDetail({
      ...input,
      booking: {
        ...input.booking,
        status: "cancelled_by_payment",
      },
      paymentRetryAvailable: true,
      sessionPayment: {
        ...input.sessionPayment!,
        financial_status: SessionFinancialStatus.Canceled,
      },
    });

    expect(result.onlineSession.provider).toBe("zoom");
    expect(result.encounterState.waitingRoom).toEqual({
      kind: "payment_required",
      message: "A sala será liberada quando o pagamento for confirmado.",
      title: "Pagamento necessário",
    });
    expect(result.actionPolicy.cancellation).toMatchObject({
      allowed: false,
      disabledReason: "Conclua o pagamento para confirmar este horário.",
    });
    expect(result.actionPolicy.reschedule).toMatchObject({
      allowed: false,
      disabledReason: "Conclua o pagamento para confirmar este horário.",
    });
  });
});

function createInput(): MapBookingDetailInput {
  return {
    booking: {
      completed_at: null,
      currency_snapshot: "BRL",
      ends_at: "2099-09-21T11:20:00.000Z",
      id: "73000000-0000-4000-8000-000000000001",
      meeting_provider: null,
      patient_profile_id: "71000000-0000-4000-8000-000000000001",
      service_duration_minutes_snapshot: 20,
      service_id: "74000000-0000-4000-8000-000000000001",
      service_price_cents_snapshot: 12300,
      service_title_snapshot: "Constelação Familiar",
      starts_at: "2099-09-21T11:00:00.000Z",
      status: "confirmed",
      therapist_profile_id: "72000000-0000-4000-8000-000000000001",
      timezone: "America/Sao_Paulo",
      version: 1,
    },
    cancellationDecision: null,
    completedBookings: [],
    intake: null,
    patient: {
      avatar_url: null,
      display_name: "Cliente Teste",
      id: "70000000-0000-4000-8000-000000000001",
    },
    patientHasJoined: false,
    patientProfile: {
      avatar_url: null,
      display_name: "Cliente Teste",
      id: "71000000-0000-4000-8000-000000000001",
    },
    perspective: "patient",
    policy: null,
    receipt: null,
    reschedule: null,
    reviews: [],
    service: {
      currency: "BRL",
      description: null,
      duration_minutes: 20,
      id: "74000000-0000-4000-8000-000000000001",
      price_cents: 12300,
      therapy_id: "75000000-0000-4000-8000-000000000001",
      title: "Constelação Familiar",
    },
    sessionPayment: {
      financial_status: SessionFinancialStatus.Pending,
      id: "76000000-0000-4000-8000-000000000001",
      payment_flow_version: "v10",
      refund_pending: false,
    },
    summaries: [],
    therapist: {
      headline: "Terapeuta",
      id: "72000000-0000-4000-8000-000000000001",
      is_accepting_bookings: true,
      photo_url: null,
      public_name: "Terapeuta Teste",
      slug: "terapeuta-teste",
    },
    therapy: {
      id: "75000000-0000-4000-8000-000000000001",
      name: "Constelação Familiar",
      slug: "constelacao-familiar",
    },
  };
}
