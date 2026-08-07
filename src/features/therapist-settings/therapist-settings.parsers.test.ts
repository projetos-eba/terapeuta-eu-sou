import { describe, expect, it } from "vitest";

import {
  parseTherapistSettingsUpdatePayload,
  TherapistSettingsContractError,
} from "./therapist-settings.parsers";

describe("therapist settings parsers", () => {
  it("normalizes editable account settings", () => {
    expect(
      parseTherapistSettingsUpdatePayload({
        displayName: "  Ana Oliveira  ",
        phone: "  +55 11 99999-9999  ",
      }),
    ).toEqual({
      displayName: "Ana Oliveira",
      phone: "+55 11 99999-9999",
    });
  });

  it("accepts an empty phone", () => {
    expect(
      parseTherapistSettingsUpdatePayload({
        displayName: "Ana Oliveira",
        phone: " ",
      }),
    ).toMatchObject({ phone: "" });
  });

  it("rejects invalid display names and phone numbers", () => {
    expect(() =>
      parseTherapistSettingsUpdatePayload({
        displayName: "A",
        phone: "+55 11 99999-9999",
      }),
    ).toThrow(TherapistSettingsContractError);

    expect(() =>
      parseTherapistSettingsUpdatePayload({
        displayName: "Ana Oliveira",
        phone: "telefone<script>",
      }),
    ).toThrow(TherapistSettingsContractError);
  });
});
