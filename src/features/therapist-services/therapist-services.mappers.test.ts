import { describe, expect, it } from "vitest";

import {
  mapTherapistServicesContract,
  mapTherapyCatalogContract,
} from "./therapist-services.mappers";

describe("therapist service mappers", () => {
  it("maps the allowed canonical therapy catalog", () => {
    expect(
      mapTherapyCatalogContract({
        contractVersion: 1,
        items: [
          {
            category: {
              id: "11111111-1111-4111-8111-111111111117",
              name: "Energia e protecao",
              slug: "energia-protecao",
            },
            isAvailableForServices: true,
            isPubliclyVisible: true,
            isVisibleInMatching: false,
            imageUrl: "https://cdn.example.test/reiki.jpg",
            name: "Reiki",
            shortDescription: "Pratica complementar.",
            slug: "reiki",
            status: "published",
            therapyId: "22222222-2222-4222-8222-222222222225",
          },
        ],
        plan: "premium",
        serviceLimit: 6,
        therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      }),
    ).toMatchObject({
      items: [
        {
          imageUrl: "https://cdn.example.test/reiki.jpg",
          name: "Reiki",
          status: "published",
        },
      ],
      serviceLimit: 6,
    });
  });

  it("keeps percentage deltas nullable instead of inventing metrics", () => {
    const result = mapTherapistServicesContract({
      contractVersion: 1,
      items: [
        {
          archivedAt: null,
          blockingReason: null,
          category: {
            id: "11111111-1111-4111-8111-111111111117",
            name: "Energia e protecao",
            slug: "energia-protecao",
          },
          createdAt: "2026-07-28T10:00:00.000Z",
          currency: "BRL",
          deliveryFormat: "online",
          description: null,
          durationMinutes: 60,
          isBookable: true,
          isReservable: true,
          metrics: {
            bookingCount: 3,
            bookingCountDeltaPercent: null,
            bookingsLast30Days: 2,
          },
          onlineOnly: true,
          position: 10,
          priceCents: 12000,
          serviceId: "d1000000-0000-4000-8000-000000000001",
          status: "active",
          therapy: {
            id: "22222222-2222-4222-8222-222222222225",
            imageUrl: "https://cdn.example.test/reiki-service.jpg",
            isAvailableForServices: true,
            isPubliclyVisible: true,
            name: "Reiki",
            slug: "reiki",
            status: "published",
          },
          therapyId: "22222222-2222-4222-8222-222222222225",
          title: "Reiki online",
          updatedAt: "2026-07-28T10:00:00.000Z",
          version: 2,
        },
      ],
      plan: "premium_plus",
      serviceLimit: null,
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    });

    expect(result.items[0].metrics.bookingCountDeltaPercent).toBeNull();
    expect(result.items[0].therapy.imageUrl).toBe(
      "https://cdn.example.test/reiki-service.jpg",
    );
  });

  it("removes performance metrics from the Free contract", () => {
    const result = mapTherapistServicesContract({
      contractVersion: 1,
      items: [
        {
          archivedAt: null,
          blockingReason: null,
          category: {
            id: "11111111-1111-4111-8111-111111111117",
            name: "Energia e protecao",
            slug: "energia-protecao",
          },
          createdAt: "2026-07-28T10:00:00.000Z",
          currency: "BRL",
          deliveryFormat: "online",
          description: null,
          durationMinutes: 60,
          isBookable: true,
          isReservable: true,
          metrics: {
            bookingCount: 27,
            bookingCountDeltaPercent: 18,
            bookingsLast30Days: 9,
          },
          onlineOnly: true,
          position: 10,
          priceCents: 12000,
          serviceId: "d1000000-0000-4000-8000-000000000001",
          status: "active",
          therapy: {
            id: "22222222-2222-4222-8222-222222222225",
            isAvailableForServices: true,
            isPubliclyVisible: true,
            name: "Reiki",
            slug: "reiki",
            status: "published",
          },
          therapyId: "22222222-2222-4222-8222-222222222225",
          title: "Reiki online",
          updatedAt: "2026-07-28T10:00:00.000Z",
          version: 2,
        },
      ],
      plan: "free",
      serviceLimit: 1,
      therapistProfileId: "c1000000-0000-4000-8000-000000000001",
    });

    expect(result.items[0].metrics).toEqual({
      bookingCount: 0,
      bookingCountDeltaPercent: null,
      bookingsLast30Days: 0,
    });
  });

  it("rejects legacy non-online service formats", () => {
    expect(() =>
      mapTherapistServicesContract({
        contractVersion: 1,
        items: [
          {
            archivedAt: null,
            blockingReason: null,
            category: {
              id: "11111111-1111-4111-8111-111111111117",
              name: "Energia e protecao",
              slug: "energia-protecao",
            },
            createdAt: "2026-07-28T10:00:00.000Z",
            currency: "BRL",
            deliveryFormat: "hybrid",
            description: null,
            durationMinutes: 60,
            isBookable: true,
            isReservable: true,
            metrics: {
              bookingCount: 0,
              bookingCountDeltaPercent: null,
              bookingsLast30Days: 0,
            },
            onlineOnly: true,
            position: 10,
            priceCents: 12000,
            serviceId: "d1000000-0000-4000-8000-000000000001",
            status: "active",
            therapy: {
              id: "22222222-2222-4222-8222-222222222225",
              isAvailableForServices: true,
              isPubliclyVisible: true,
              name: "Reiki",
              slug: "reiki",
              status: "published",
            },
            therapyId: "22222222-2222-4222-8222-222222222225",
            title: "Reiki online",
            updatedAt: "2026-07-28T10:00:00.000Z",
            version: 2,
          },
        ],
        plan: "premium_plus",
        serviceLimit: null,
        therapistProfileId: "c1000000-0000-4000-8000-000000000001",
      }),
    ).toThrow("Invalid delivery format.");
  });
});
