import { describe, expect, it } from "vitest";

import {
  AdminMatchingContractError,
  parseAdminMatchingContract,
} from "./admin-matching.parsers";

describe("admin matching parsers", () => {
  it("parses themes, interests, impact counters and audit history", () => {
    const parsed = parseAdminMatchingContract({
      contractVersion: 1,
      themes: [
        {
          createdAt: "2026-08-04T00:00:00Z",
          description: "Tema usado para recomendar terapias.",
          history: [
            {
              actorProfileId: "admin-1",
              createdAt: "2026-08-04T00:00:00Z",
              eventType: "matching_theme_updated",
              id: "event-1",
              reason: "Ajuste operacional",
            },
          ],
          id: "theme-1",
          imageUrl: null,
          interests: [
            {
              createdAt: "2026-08-04T00:00:00Z",
              history: [],
              id: "interest-1",
              isActive: true,
              name: "Ansiedade leve",
              serviceCount: 7,
              slug: "ansiedade-leve",
              sortOrder: 1,
              themeId: "theme-1",
              updatedAt: "2026-08-04T00:00:00Z",
            },
          ],
          isActive: true,
          name: "Equilíbrio emocional",
          serviceCount: 12,
          slug: "equilibrio-emocional",
          sortOrder: 1,
          therapyCount: 3,
          updatedAt: "2026-08-04T00:00:00Z",
        },
      ],
    });

    expect(parsed.themes[0]?.therapyCount).toBe(3);
    expect(parsed.themes[0]?.interests[0]?.serviceCount).toBe(7);
    expect(parsed.themes[0]?.history[0]?.eventType).toBe(
      "matching_theme_updated",
    );
  });

  it("rejects unsupported contract versions", () => {
    expect(() =>
      parseAdminMatchingContract({
        contractVersion: 2,
        themes: [],
      }),
    ).toThrow(AdminMatchingContractError);
  });
});
