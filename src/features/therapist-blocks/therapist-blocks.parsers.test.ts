import { describe, expect, it } from "vitest";

import {
  parseCreateTherapistBlockInput,
  parseTherapistBlockCommandResult,
  parseTherapistBlocksReadModel,
} from "./therapist-blocks.parsers";

const block = {
  allDay: true,
  createdAt: "2026-07-27T12:00:00Z",
  endsAt: "2026-07-29T03:00:00Z",
  id: "a4100000-0000-4000-8000-000000000001",
  impactedBookings: [
    {
      bookingId: "f2000000-0000-4000-8000-000000000004",
      impactId: "a4200000-0000-4000-8000-000000000001",
      patientName: "Marina Souza",
      resolution: null,
      serviceTitle: "Reiki",
      startsAt: "2026-07-28T12:00:00Z",
      status: "pending",
    },
  ],
  reason: "Compromisso pessoal",
  reasonCode: "personal",
  recurrenceEndsOn: "2026-07-28",
  recurrenceFrequency: "none",
  seriesId: "a4000000-0000-4000-8000-000000000001",
  serviceId: null,
  serviceTitle: null,
  startsAt: "2026-07-28T03:00:00Z",
  status: "active",
  timezone: "America/Sao_Paulo",
  version: 1,
};

describe("therapist block contracts", () => {
  it("parses the canonical read model and impact authority", () => {
    const parsed = parseTherapistBlocksReadModel({
      blocks: [block],
      contractVersion: 1,
      nextCursor: null,
      scheduleVersion: 2,
      summary: {
        activeBlocks: 1,
        pendingImpacts: 1,
        recurringSeries: 0,
      },
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      timezone: "America/Sao_Paulo",
    });

    expect(parsed.blocks[0].impactedBookings[0].status).toBe("pending");
    expect(parsed.summary.pendingImpacts).toBe(1);
  });

  it("rejects unknown contract versions", () => {
    expect(() =>
      parseTherapistBlocksReadModel({
        blocks: [],
        contractVersion: 2,
        nextCursor: null,
        scheduleVersion: 1,
        summary: {
          activeBlocks: 0,
          pendingImpacts: 0,
          recurringSeries: 0,
        },
        therapistProfileId: "c1000000-0000-4000-8000-000000000001",
        timezone: "America/Sao_Paulo",
      }),
    ).toThrow();
  });

  it("validates a partial recurring create command", () => {
    const parsed = parseCreateTherapistBlockInput({
      action: "create",
      allDay: false,
      endTime: "18:00",
      reason: "Formação profissional",
      reasonCode: "training",
      recurrenceEndsOn: "2026-08-27",
      recurrenceFrequency: "weekly",
      requestId: "a4000000-0000-4000-8000-000000000009",
      serviceId: null,
      startTime: "14:00",
      startsOn: "2026-07-30",
      timezone: "America/Sao_Paulo",
    });

    expect(parsed.recurrenceFrequency).toBe("weekly");
    expect(parsed.startTime).toBe("14:00");
  });

  it("rejects all-day commands carrying clock values", () => {
    expect(() =>
      parseCreateTherapistBlockInput({
        action: "create",
        allDay: true,
        endTime: "18:00",
        reason: null,
        reasonCode: "personal",
        recurrenceEndsOn: "2026-07-30",
        recurrenceFrequency: "none",
        requestId: "a4000000-0000-4000-8000-000000000009",
        serviceId: null,
        startTime: "09:00",
        startsOn: "2026-07-30",
        timezone: "America/Sao_Paulo",
      }),
    ).toThrow();
  });

  it("parses confirmed and paid booking details returned by the create command", () => {
    const result = parseTherapistBlockCommandResult({
      idempotentReplay: false,
      paidImpactedBookings: [
        {
          bookingId: "f2000000-0000-4000-8000-000000000004",
          endsAt: "2026-07-28T15:00:00Z",
          patientName: "Marina Souza",
          serviceTitle: "Reiki",
          startsAt: "2026-07-28T14:00:00Z",
          timezone: "America/Sao_Paulo",
        },
      ],
    });

    expect(result.paidImpactedBookings).toEqual([
      expect.objectContaining({ patientName: "Marina Souza" }),
    ]);
  });
});
