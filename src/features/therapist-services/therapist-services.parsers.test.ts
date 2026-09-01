import { describe, expect, it } from "vitest";

import {
  parseTherapistServicesCommand,
  TherapistServicesContractError,
} from "./therapist-services.parsers";

const requestId = "a6000000-0000-4000-8000-000000000001";
const therapyId = "22222222-2222-4222-8222-222222222225";
const serviceId = "d1000000-0000-4000-8000-000000000001";
const themeId = "71000000-0000-4000-8000-000000000001";
const interestId = "72000000-0000-4000-8000-000000000001";

describe("parseTherapistServicesCommand", () => {
  it("accepts create commands only with a canonical therapyId", () => {
    expect(
      parseTherapistServicesCommand({
        action: "create",
        description: "Sessao complementar por video.",
        durationMinutes: 60,
        priceCents: 12000,
        requestId,
        interestIds: [interestId],
        themeIds: [themeId],
        therapyId,
        title: "Reiki online",
      }),
    ).toMatchObject({
      action: "create",
      therapyId,
    });
  });

  it("rejects free-text therapy creation", () => {
    expect(() =>
      parseTherapistServicesCommand({
        action: "create",
        durationMinutes: 60,
        priceCents: 12000,
        requestId,
        therapyName: "Nova terapia",
        title: "Servico livre",
      }),
    ).toThrow(TherapistServicesContractError);
  });

  it("rejects non-online delivery formats", () => {
    expect(() =>
      parseTherapistServicesCommand({
        action: "create",
        deliveryFormat: "hybrid",
        description: "Sessao complementar por video.",
        durationMinutes: 60,
        priceCents: 12000,
        requestId,
        interestIds: [],
        themeIds: [themeId],
        therapyId,
        title: "Reiki online",
      }),
    ).toThrow(TherapistServicesContractError);
  });

  it("requires optimistic version for updates", () => {
    expect(
      parseTherapistServicesCommand({
        action: "update",
        expectedVersion: 4,
        isBookable: false,
        requestId,
        serviceId,
      }),
    ).toMatchObject({
      action: "update",
      expectedVersion: 4,
      isBookable: false,
    });
  });

  it("rejects duplicated reorder ids", () => {
    expect(() =>
      parseTherapistServicesCommand({
        action: "reorder",
        requestId,
        serviceIds: [serviceId, serviceId],
      }),
    ).toThrow(TherapistServicesContractError);
  });

  it.each([
    [19, false],
    [20, true],
    [120, true],
    [121, false],
    [20.5, false],
  ])("validates service duration %s", (durationMinutes, isValid) => {
    const command = {
      action: "create" as const,
      description: "Sessao complementar por video.",
      durationMinutes,
      interestIds: [],
      priceCents: 12000,
      requestId,
      themeIds: [themeId],
      therapyId,
      title: "Reiki online",
    };

    if (isValid) {
      expect(parseTherapistServicesCommand(command)).toMatchObject({
        durationMinutes,
      });
      return;
    }

    expect(() => parseTherapistServicesCommand(command)).toThrow(
      TherapistServicesContractError,
    );
  });

  it.each([
    [180, true],
    [181, false],
  ])("validates service description length %s", (length, isValid) => {
    const command = {
      action: "create" as const,
      description: "x".repeat(length),
      durationMinutes: 60,
      interestIds: [],
      priceCents: 12000,
      requestId,
      themeIds: [themeId],
      therapyId,
      title: "Reiki online",
    };

    if (isValid) {
      expect(parseTherapistServicesCommand(command)).toMatchObject({
        description: command.description,
      });
      return;
    }

    expect(() => parseTherapistServicesCommand(command)).toThrow(
      TherapistServicesContractError,
    );
  });
});
