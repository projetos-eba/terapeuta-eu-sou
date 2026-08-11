import { assertEquals } from "jsr:@std/assert";

import { ensureVideoSessionForPaidSessionPayment } from "./session-payment-side-effects.ts";

type StubResponse = Array<Record<string, unknown>>;

class StubPaymentsClient {
  readonly getCalls: string[] = [];
  readonly rpcCalls: Array<{ body: unknown; name: string }> = [];

  constructor(private readonly responses: StubResponse[]) {}

  async get<T>(path: string): Promise<T> {
    this.getCalls.push(path);

    const response = this.responses.shift();
    if (!response) {
      throw new Error(`unexpected_get:${path}`);
    }

    return response as T;
  }

  async rpc<T>(name: string, body: unknown): Promise<T> {
    this.rpcCalls.push({ body, name });
    return [] as unknown as T;
  }
}

Deno.test(
  "skips duplicate paid replay video-session provisioning when a local session already exists",
  async () => {
    const client = new StubPaymentsClient([
      [{ booking_id: "booking-1" }],
      [{ id: "video-session-1" }],
    ]);

    const result = await ensureVideoSessionForPaidSessionPayment(client, {
      sessionPaymentId: "payment-1",
      source: "stripe-billing-webhook",
      zoomEnvironment: "production",
    });

    assertEquals(result, {
      created: false,
      reason: "video_session_exists",
    });
    assertEquals(client.rpcCalls, []);
  },
);

Deno.test(
  "retries paid replay video-session provisioning when the local session is still missing",
  async () => {
    const client = new StubPaymentsClient([[{ booking_id: "booking-1" }], []]);

    const result = await ensureVideoSessionForPaidSessionPayment(client, {
      sessionPaymentId: "payment-1",
      source: "stripe-billing-webhook",
      zoomEnvironment: "development",
    });

    assertEquals(result, { created: true });
    assertEquals(client.rpcCalls, [
      {
        body: {
          p_booking_id: "booking-1",
          p_environment: "development",
          p_source: "stripe-billing-webhook",
        },
        name: "ensure_video_session_for_paid_booking_v1",
      },
    ]);
  },
);
