import { describe, expect, it } from "vitest";

import {
  assertZoomExecutedResult,
  assertZoomJoinResult,
  assertZoomVideoStartResult,
  normalizeConnectionChange,
  normalizeZoomFailure,
  ZoomOperationError,
} from "./zoom-video-recovery";

describe("zoom video recovery contract", () => {
  it("keeps generic executed results strict", () => {
    expect(() => assertZoomExecutedResult("", "join")).not.toThrow();
    expect(() => assertZoomExecutedResult(undefined, "join")).toThrow(
      ZoomOperationError,
    );
  });

  it("accepts void only for camera capture success, not arbitrary payloads", () => {
    for (const result of [undefined, ""]) {
      expect(() => assertZoomVideoStartResult(result)).not.toThrow();
    }
    for (const result of [
      null,
      {},
      { userId: 7 },
      false,
      {
        errorCode: 2,
        reason: "failed",
        type: "INTERNAL_ERROR",
      },
    ]) {
      expect(() => assertZoomVideoStartResult(result)).toThrow(
        ZoomOperationError,
      );
    }
    expect(() => assertZoomExecutedResult(undefined, "audio")).toThrow(
      ZoomOperationError,
    );
    expect(() => assertZoomExecutedResult(undefined, "init")).toThrow(
      ZoomOperationError,
    );
  });

  it("accepts the installed SDK participant result only for join, never masking failures", () => {
    expect(
      assertZoomJoinResult({
        userId: 7,
        userKey: "tes-v1-p-local-participant",
      }),
    ).toEqual({ userId: 7, userKey: "tes-v1-p-local-participant" });
    expect(assertZoomJoinResult("")).toBeNull();
    for (const result of [
      null,
      undefined,
      {},
      { userId: 0 },
      { userId: 7, errorCode: 2, reason: "failed", type: "INTERNAL_ERROR" },
    ]) {
      expect(() => assertZoomJoinResult(result)).toThrow(ZoomOperationError);
    }
    expect(() => assertZoomExecutedResult({ userId: 7 }, "audio")).toThrow(
      ZoomOperationError,
    );
  });

  it("turns a resolved SDK failure into a classified exception", () => {
    expect(() =>
      assertZoomExecutedResult(
        {
          errorCode: 5012,
          reason: "participant already exists",
          type: "INVALID_OPERATION",
        },
        "join",
      ),
    ).toThrow(ZoomOperationError);

    try {
      assertZoomExecutedResult(
        {
          errorCode: 5012,
          reason: "participant already exists",
          type: "INVALID_OPERATION",
        },
        "join",
      );
    } catch (error) {
      expect((error as ZoomOperationError).failure).toMatchObject({
        category: "transient",
        code: 5012,
        retryable: true,
        shouldReload: true,
      });
    }
  });

  it.each([
    [103, "permission", false, false],
    [203, "permission", false, false],
    [104, "reload_media", false, true],
    [205, "reload_media", false, true],
    [3009, "ended", false, false],
    [4004, "ended", false, false],
    [5003, "transient", true, true],
    [5012, "transient", true, true],
    [5013, "permanent", false, false],
  ])("classifies Zoom code %s", (code, category, retryable, shouldReload) => {
    expect(
      normalizeZoomFailure(
        { errorCode: code, reason: "provider reason", type: "SDK_ERROR" },
        "connection",
      ),
    ).toMatchObject({ category, code, retryable, shouldReload });
  });

  it("reads the connection error code used to correlate a failed rejoin", () => {
    expect(
      normalizeConnectionChange({
        errorCode: 5012,
        reason: "duplicated operation",
        state: "Fail",
      }),
    ).toEqual({
      errorCode: 5012,
      reason: "duplicated operation",
      state: "Fail",
    });
  });

  it("uses active media code instead of exposing its raw message", () => {
    const failure = normalizeZoomFailure(
      { code: 104, message: "raw provider internals", type: "audio" },
      "audio",
    );

    expect(failure.category).toBe("reload_media");
    expect(failure.userMessage).not.toContain("raw provider internals");
  });

  it("maps the receiving-account gate without exposing the backend message", () => {
    const failure = normalizeZoomFailure(
      {
        errorCode: 5013,
        reason: "therapist_receiving_account_required",
        type: "INTERNAL_ERROR",
      },
      "access",
    );

    expect(failure).toMatchObject({
      category: "permanent",
      retryable: false,
      shouldReload: false,
      userMessage:
        "Conclua o cadastro da sua conta de recebimento antes de iniciar o atendimento.",
    });
  });
});
