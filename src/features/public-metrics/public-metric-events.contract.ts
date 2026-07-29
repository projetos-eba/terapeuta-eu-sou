export type PublicMetricEvent =
  | {
      eventId: string;
      eventType: "booking_flow_started";
      serviceId: string;
      sourceSurface: "therapist_profile" | "therapist_search";
      therapistSlug: string;
    }
  | {
      eventId: string;
      eventType: "profile_view";
      sourceSurface: "therapist_profile";
      therapistSlug: string;
    }
  | {
      eventId: string;
      eventType: "search_impression";
      resultPosition: number;
      resultSetId: string;
      sourceSurface: "therapist_search";
      therapistSlug: string;
    };

export type PublicMetricEventBatch = {
  events: PublicMetricEvent[];
  sessionId: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class PublicMetricEventContractError extends Error {}

export function parsePublicMetricEventBatch(
  input: unknown,
): PublicMetricEventBatch {
  const value = record(input);
  const sessionId = uuid(value.sessionId);

  if (!Array.isArray(value.events) || value.events.length < 1) {
    throw new PublicMetricEventContractError("Events are required.");
  }
  if (value.events.length > 20) {
    throw new PublicMetricEventContractError("Too many events.");
  }

  return {
    events: value.events.map(parseEvent),
    sessionId,
  };
}

function parseEvent(input: unknown): PublicMetricEvent {
  const value = record(input);
  const eventId = uuid(value.eventId);
  const eventType = string(value.eventType);
  const therapistSlug = slug(value.therapistSlug);

  if (eventType === "search_impression") {
    exactKeys(value, [
      "eventId",
      "eventType",
      "resultPosition",
      "resultSetId",
      "sourceSurface",
      "therapistSlug",
    ]);
    if (value.sourceSurface !== "therapist_search") invalid();
    if (
      typeof value.resultPosition !== "number" ||
      !Number.isSafeInteger(value.resultPosition) ||
      value.resultPosition < 1 ||
      value.resultPosition > 100
    ) {
      invalid();
    }

    return {
      eventId,
      eventType,
      resultPosition: value.resultPosition,
      resultSetId: uuid(value.resultSetId),
      sourceSurface: "therapist_search",
      therapistSlug,
    };
  }

  if (eventType === "profile_view") {
    exactKeys(value, [
      "eventId",
      "eventType",
      "sourceSurface",
      "therapistSlug",
    ]);
    if (value.sourceSurface !== "therapist_profile") invalid();

    return {
      eventId,
      eventType,
      sourceSurface: "therapist_profile",
      therapistSlug,
    };
  }

  if (eventType === "booking_flow_started") {
    exactKeys(value, [
      "eventId",
      "eventType",
      "serviceId",
      "sourceSurface",
      "therapistSlug",
    ]);
    if (
      value.sourceSurface !== "therapist_profile" &&
      value.sourceSurface !== "therapist_search"
    ) {
      invalid();
    }

    return {
      eventId,
      eventType,
      serviceId: uuid(value.serviceId),
      sourceSurface: value.sourceSurface,
      therapistSlug,
    };
  }

  return invalid();
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();

  if (
    actual.length !== canonical.length ||
    actual.some((key, index) => key !== canonical[index])
  ) {
    invalid();
  }
}

function invalid(): never {
  throw new PublicMetricEventContractError("Invalid metric event.");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid();
  }
  return value as Record<string, unknown>;
}

function slug(value: unknown) {
  const parsed = string(value);
  if (parsed.length > 120 || !slugPattern.test(parsed)) return invalid();
  return parsed;
}

function string(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return invalid();
  return value.trim();
}

function uuid(value: unknown) {
  const parsed = string(value);
  if (!uuidPattern.test(parsed)) return invalid();
  return parsed.toLowerCase();
}
