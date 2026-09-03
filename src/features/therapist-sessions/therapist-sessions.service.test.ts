import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  queryTherapistPendingConfirmations,
  queryTherapistSessionDetail,
  queryTherapistSessionFeedback,
  queryTherapistSessions,
} = vi.hoisted(
  () => ({
    queryTherapistPendingConfirmations: vi.fn(),
    queryTherapistSessionDetail: vi.fn(),
    queryTherapistSessionFeedback: vi.fn(),
    queryTherapistSessions: vi.fn(),
  }),
);

vi.mock("./therapist-sessions.queries", () => ({
  queryTherapistPendingConfirmations,
  queryTherapistSessionDetail,
  queryTherapistSessionFeedback,
  queryTherapistSessions,
}));

import {
  getTherapistPendingConfirmationsSummary,
  getTherapistSessionDetail,
  getTherapistSessionFeedbackStatus,
  getTherapistSessionsPage,
} from "./therapist-sessions.service";

const therapistProfileId = "c1000000-0000-4000-8000-000000000001";

describe("therapist sessions service results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("keeps an empty result distinct from a query failure", async () => {
    queryTherapistSessions.mockResolvedValueOnce(sessionsResponse());
    const empty = await getTherapistSessionsPage({
      accessToken: "test-token",
      filters: { limit: 20 },
      profileId: therapistProfileId,
    });

    queryTherapistSessions.mockRejectedValueOnce(new Error("network"));
    const failed = await getTherapistSessionsPage({
      accessToken: "test-token",
      filters: { limit: 20 },
      profileId: therapistProfileId,
    });

    expect(empty.status).toBe("empty");
    expect(failed.status).toBe("error");
    if (failed.status === "error") {
      expect(failed.error.code).toBe("unavailable");
      expect(failed.error.correlationId).toBeTruthy();
    }
  });

  it("rejects a read model attributed to another therapist", async () => {
    queryTherapistSessions.mockResolvedValueOnce(
      sessionsResponse("c1000000-0000-4000-8000-000000000002"),
    );

    const result = await getTherapistSessionsPage({
      accessToken: "test-token",
      filters: { limit: 20 },
      profileId: therapistProfileId,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("maps a missing owned detail to empty instead of an infrastructure error", async () => {
    queryTherapistSessionDetail.mockResolvedValueOnce(null);

    const result = await getTherapistSessionDetail({
      accessToken: "test-token",
      bookingId: "f2000000-0000-4000-8000-000000000001",
      profileId: therapistProfileId,
    });

    expect(result.status).toBe("empty");
  });

  it("parses the all-plan pending confirmation summary", async () => {
    queryTherapistPendingConfirmations.mockResolvedValueOnce({
      generatedAt: "2026-09-03T12:00:00.000Z",
      pendingBookingIds: ["f2000000-0000-4000-8000-000000000001"],
      pendingCount: 1,
      therapistProfileId,
      version: 1,
    });

    await expect(
      getTherapistPendingConfirmationsSummary({
        accessToken: "test-token",
        profileId: therapistProfileId,
      }),
    ).resolves.toMatchObject({
      data: {
        pendingCount: 1,
        pendingBookingIds: ["f2000000-0000-4000-8000-000000000001"],
      },
      status: "success",
    });
  });

  it("rejects a pending confirmation summary attributed to another therapist", async () => {
    queryTherapistPendingConfirmations.mockResolvedValueOnce({
      generatedAt: "2026-09-03T12:00:00.000Z",
      pendingBookingIds: [],
      pendingCount: 0,
      therapistProfileId: "c1000000-0000-4000-8000-000000000002",
      version: 1,
    });

    const result = await getTherapistPendingConfirmationsSummary({
      accessToken: "test-token",
      profileId: therapistProfileId,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("uses the participant-scoped feedback status without exposing its payload", async () => {
    queryTherapistSessionFeedback.mockResolvedValueOnce({
      status: "eligible",
    });

    await expect(
      getTherapistSessionFeedbackStatus({
        accessToken: "test-token",
        bookingId: "f2000000-0000-4000-8000-000000000001",
      }),
    ).resolves.toBe("eligible");
  });

  it("keeps an unknown feedback state unavailable to the session detail", async () => {
    queryTherapistSessionFeedback.mockResolvedValueOnce({ status: "internal" });

    await expect(
      getTherapistSessionFeedbackStatus({
        accessToken: "test-token",
        bookingId: "f2000000-0000-4000-8000-000000000001",
      }),
    ).resolves.toBe("unavailable");
  });
});

function sessionsResponse(profileId = therapistProfileId) {
  return {
    filters: {
      bookingStatus: null,
      financialStatus: null,
      modality: null,
      patientProfileId: null,
      periodEnd: null,
      periodStart: null,
      serviceId: null,
    },
    items: [],
    summary: null,
    page: {
      hasMore: false,
      limit: 20,
      nextCursor: null,
    },
    therapistProfileId: profileId,
    timezone: "America/Sao_Paulo",
    version: 1,
  };
}
