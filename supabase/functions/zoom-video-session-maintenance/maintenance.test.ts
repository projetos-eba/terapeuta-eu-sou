import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const serveDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve")!;
Object.defineProperty(Deno, "serve", {
  configurable: true,
  value: () => undefined,
});
const { processJob } = await import("./index.ts");
Object.defineProperty(Deno, "serve", serveDescriptor);

const startsAt = "2026-09-18T23:00:00.000Z";
const job = {
  attempts: 1,
  booking_id: "booking",
  id: "job",
  max_attempts: 5,
  operation: "end_attendance_no_show" as const,
  provider_session_id: "exact-provider-id",
  video_session_id: "room",
};

async function exercise(
  options: {
    missing?: boolean;
    version?: number;
    startsAt?: string;
    providerFails?: boolean;
  } = {},
) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const ended: string[] = [];
  const paths: string[] = [];
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return Promise.resolve(null);
    },
    get(path: string) {
      paths.push(path);
      if (path.startsWith("/rest/v1/video_session_control_jobs?")) {
        return Promise.resolve(
          options.missing
            ? []
            : [
                {
                  metadata: {
                    bookingVersion: options.version ?? 3,
                    scheduledStartsAt: options.startsAt ?? startsAt,
                  },
                },
              ],
        );
      }
      if (path.startsWith("/rest/v1/bookings?"))
        return Promise.resolve([
          { status: "no_show_patient", version: 4, starts_at: startsAt },
        ]);
      return Promise.resolve([
        {
          scheduled_starts_at: startsAt,
          termination_reason: "attendance_no_show",
          termination_requested_at: startsAt,
        },
      ]);
    },
  };
  const zoom = {
    endSession(id: string) {
      ended.push(id);
      if (options.providerFails) throw new Error("provider unavailable");
      return Promise.resolve();
    },
  };
  const result = await processJob({
    client,
    zoom,
    job,
  } as unknown as Parameters<typeof processJob>[0]);
  return { result, calls, ended, paths };
}

Deno.test(
  "reserved RPC payload without metadata closes the exact provider session using persisted fences",
  async () => {
    const result = await exercise();
    assertEquals(result.ended, ["exact-provider-id"]);
    assertEquals(result.result, { ok: true, operation: job.operation });
    assertEquals(
      result.paths[0],
      "/rest/v1/video_session_control_jobs?select=metadata&id=eq.job&booking_id=eq.booking&video_session_id=eq.room&status=eq.processing&limit=1",
    );
    assertEquals(
      result.calls.some(
        (call) => call.name === "mark_video_session_termination_confirmed_v1",
      ),
      true,
    );
    assertEquals(result.calls.at(-1)?.args.p_success, true);
  },
);

for (const options of [{ version: 2 }, { startsAt: "2026-09-19T23:00:00Z" }]) {
  Deno.test(
    `stale persisted fence is superseded: ${JSON.stringify(options)}`,
    async () => {
      const result = await exercise(options);
      assertEquals(result.ended, []);
      assertEquals(result.result, {
        ok: true,
        operation: job.operation,
        superseded: true,
      });
    },
  );
}

for (const options of [{ missing: true }, { providerFails: true }]) {
  Deno.test(
    `missing fence or provider failure retains retry: ${JSON.stringify(options)}`,
    async () => {
      const result = await exercise(options);
      assertEquals(result.result.ok, false);
      assertEquals(result.calls.at(-1)?.args.p_success, false);
      assertEquals(
        result.calls.some(
          (call) => call.name === "mark_video_session_termination_confirmed_v1",
        ),
        false,
      );
    },
  );
}
