import { describe, expect, it } from "vitest";

import {
  getParticipantTemplates,
  getTemplateByKey,
  isSelectableParticipantTemplate,
} from "./message-center.templates";

describe("message center templates", () => {
  it("uses the concise delay description", () => {
    expect(
      getParticipantTemplates("therapist").find(
        (template) => template.key === "therapist_delay",
      )?.description,
    ).toBe("Comunica uma janela curta de atraso.");
  });

  it("removes the unclear templates from new selections but keeps history lookup", () => {
    expect(isSelectableParticipantTemplate("therapist_cancel_processed")).toBe(
      false,
    );
    expect(isSelectableParticipantTemplate("therapist_platform_action")).toBe(
      false,
    );
    expect(getTemplateByKey("therapist_cancel_processed")).toBeDefined();
    expect(getTemplateByKey("therapist_platform_action")).toBeDefined();
  });
});
