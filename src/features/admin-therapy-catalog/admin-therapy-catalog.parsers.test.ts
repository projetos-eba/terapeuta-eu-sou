import { describe, expect, it } from "vitest";

import {
  AdminTherapyCatalogContractError,
  parseAdminTherapyCatalogContract,
} from "./admin-therapy-catalog.parsers";

describe("admin therapy catalog parsers", () => {
  it("parses a complete admin catalog contract", () => {
    const parsed = parseAdminTherapyCatalogContract({
      categories: [
        {
          id: "cat-1",
          isActive: true,
          name: "Energia",
          slug: "energia",
          sortOrder: 1,
        },
      ],
      contractVersion: 1,
      matchingThemes: [
        {
          id: "theme-1",
          imageUrl: "/journey/emocoes-bem-estar.png",
          name: "Emoções e Bem-Estar",
          slug: "emocoes-bem-estar",
          sortOrder: 1,
        },
      ],
      items: [
        {
          aliases: ["energia"],
          archivedAt: null,
          calendarColorKey: "purple",
          categoryId: "cat-1",
          categoryIsActive: true,
          categoryName: "Energia",
          categorySlug: "energia",
          deprecatedAt: null,
          description: "Descrição segura.",
          hasPublishedMatchWeights: true,
          history: [],
          id: "therapy-1",
          imageUrl: "/therapies/reiki.png",
          impact: {
            activeServiceCount: 1,
            futureBookingCount: 0,
            isAvailableForServices: true,
            isPubliclyVisible: true,
            isVisibleInMatching: true,
            publicProfileCount: 1,
            serviceCount: 2,
            therapistCount: 1,
          },
          isAvailableForServices: true,
          isFeatured: false,
          isPubliclyVisible: true,
          isVisibleInMatching: true,
          name: "Reiki",
          publicContent: {
            approachIconKey: "sparkles",
            approachLabel: "Energia",
            benefits: [],
            complementaryDescription: null,
            faqs: [],
            heroFocalPoint: "center",
            heroImageUrl: null,
            highlights: [],
            introduction: "Introdução segura.",
            safetyNote: null,
            seoDescription: null,
            seoTitle: null,
            subtitle: null,
            visualThemeKey: "energy",
          },
          publishedAt: null,
          replacementTherapyId: null,
          shortDescription: "Resumo seguro.",
          slug: "reiki",
          status: "published",
          updatedAt: "2026-07-28T00:00:00Z",
        },
      ],
      requests: [],
    });

    expect(parsed.items[0]?.name).toBe("Reiki");
    expect(parsed.items[0]?.impact.activeServiceCount).toBe(1);
    expect(parsed.matchingThemes[0]?.imageUrl).toBe(
      "/journey/emocoes-bem-estar.png",
    );
  });

  it("rejects unknown status values", () => {
    expect(() =>
      parseAdminTherapyCatalogContract({
        categories: [],
        contractVersion: 1,
        items: [
          {
            aliases: [],
            archivedAt: null,
            calendarColorKey: "neutral",
            categoryId: "cat",
            categoryIsActive: true,
            categoryName: "Categoria",
            categorySlug: "categoria",
            deprecatedAt: null,
            description: null,
            hasPublishedMatchWeights: false,
            history: [],
            id: "therapy",
            imageUrl: null,
            impact: {},
            isAvailableForServices: false,
            isFeatured: false,
            isPubliclyVisible: false,
            isVisibleInMatching: false,
            name: "Teste",
            publicContent: {},
            publishedAt: null,
            replacementTherapyId: null,
            shortDescription: "Resumo",
            slug: "teste",
            status: "deleted",
            updatedAt: "2026-07-28T00:00:00Z",
          },
        ],
        matchingThemes: [],
        requests: [],
      }),
    ).toThrow(AdminTherapyCatalogContractError);
  });
});
