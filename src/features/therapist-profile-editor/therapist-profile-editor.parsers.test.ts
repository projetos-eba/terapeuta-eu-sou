import { describe, expect, it } from "vitest";

import {
  parseEditorPayload,
  parseTherapistProfileCommand,
  TherapistProfileContractError,
} from "./therapist-profile-editor.parsers";

const requestId = "a6000000-0000-4000-8000-000000000001";

describe("therapist profile editor parsers", () => {
  it("accepts a valid draft command", () => {
    expect(
      parseTherapistProfileCommand({
        action: "save_draft",
        expectedVersion: 2,
        payload: {
          essenceBody: "Presença e cuidado online.",
          publicName: "Ana Oliveira",
          shortIntro: "Acolhimento online com clareza.",
        },
        requestId,
      }),
    ).toMatchObject({
      action: "save_draft",
      expectedVersion: 2,
      requestId,
    });
  });

  it("rejects invalid commands", () => {
    expect(() =>
      parseTherapistProfileCommand({
        action: "publish",
        expectedVersion: 0,
        requestId,
      }),
    ).toThrow(TherapistProfileContractError);
  });

  it("normalizes optional editable fields", () => {
    expect(
      parseEditorPayload({
        guideItems: [{ label: "Escuta" }],
        publicName: " Ana Oliveira ",
        shortIntro: " ",
      }),
    ).toMatchObject({
      guideItems: [{ icon: "sparkles", label: "Escuta" }],
      publicName: "Ana Oliveira",
      shortIntro: "",
      videoProvider: "external",
    });
  });

  it("rejects oversized guide item lists", () => {
    expect(() =>
      parseEditorPayload({
        guideItems: Array.from({ length: 7 }, (_, index) => ({
          label: `Item ${index}`,
        })),
        publicName: "Ana Oliveira",
      }),
    ).toThrow(TherapistProfileContractError);
  });
});
