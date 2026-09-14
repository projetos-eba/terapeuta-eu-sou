import { assertEquals } from "jsr:@std/assert@1";

import { cancelV10BeforeCharge } from "./v10-precharge-cancellation.ts";

Deno.test("V10 pre-charge cancellation delegates only the authenticated patient binding", async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const result = await cancelV10BeforeCharge(
    {
      rpc: (name: string, params: Record<string, unknown>) => {
        calls.push({ name, params });
        return Promise.resolve({ applied: true, canceled: true });
      },
    } as never,
    {
      bookingId: "booking-1",
      patientUserId: "patient-1",
      reason: "Não poderei comparecer",
      requestId: "request-1",
    },
  );

  assertEquals(result, { applied: true, canceled: true });
  assertEquals(calls, [{
    name: "cancel_uncharged_session_v10",
    params: {
      p_booking_id: "booking-1",
      p_patient_user_id: "patient-1",
      p_reason: "Não poderei comparecer",
      p_request_id: "request-1",
    },
  }]);
});
