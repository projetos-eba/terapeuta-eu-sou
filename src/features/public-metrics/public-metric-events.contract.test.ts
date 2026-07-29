import { describe, expect, it } from "vitest";

import {
  parsePublicMetricEventBatch,
  PublicMetricEventContractError,
} from "./public-metric-events.contract";

const sessionId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";

describe("public metric event contract", () => {
  it("accepts the objective browser event shapes", () => {
    expect(
      parsePublicMetricEventBatch({
        events: [
          {
            eventId,
            eventType: "search_impression",
            resultPosition: 2,
            resultSetId: "30000000-0000-4000-8000-000000000001",
            sourceSurface: "therapist_search",
            therapistSlug: "ana-oliveira",
          },
          {
            eventId: "20000000-0000-4000-8000-000000000002",
            eventType: "profile_view",
            sourceSurface: "therapist_profile",
            therapistSlug: "ana-oliveira",
          },
          {
            eventId: "20000000-0000-4000-8000-000000000003",
            eventType: "booking_flow_started",
            serviceId: "d1000000-0000-4000-8000-000000000001",
            sourceSurface: "therapist_profile",
            therapistSlug: "ana-oliveira",
          },
          {
            eventId: "20000000-0000-4000-8000-000000000004",
            eventType: "booking_flow_started",
            serviceId: "d1000000-0000-4000-8000-000000000001",
            sourceSurface: "therapist_search",
            therapistSlug: "ana-oliveira",
          },
        ],
        sessionId,
      }).events,
    ).toHaveLength(4);
  });

  it("rejects free text, unknown fields and unsupported event types", () => {
    expect(() =>
      parsePublicMetricEventBatch({
        events: [
          {
            eventId,
            eventType: "profile_view",
            message: "sensitive text",
            sourceSurface: "therapist_profile",
            therapistSlug: "ana-oliveira",
          },
        ],
        sessionId,
      }),
    ).toThrow(PublicMetricEventContractError);

    expect(() =>
      parsePublicMetricEventBatch({
        events: [
          {
            eventId,
            eventType: "portal_demand",
            sourceSurface: "therapist_profile",
            therapistSlug: "ana-oliveira",
          },
        ],
        sessionId,
      }),
    ).toThrow(PublicMetricEventContractError);
  });

  it("limits each ingestion request to twenty events", () => {
    expect(() =>
      parsePublicMetricEventBatch({
        events: Array.from({ length: 21 }, (_, index) => ({
          eventId: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          eventType: "profile_view",
          sourceSurface: "therapist_profile",
          therapistSlug: "ana-oliveira",
        })),
        sessionId,
      }),
    ).toThrow(PublicMetricEventContractError);
  });
});
