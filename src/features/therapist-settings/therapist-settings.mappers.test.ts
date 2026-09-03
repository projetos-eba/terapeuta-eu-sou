import { describe, expect, it } from "vitest";

import {
  mapTherapistSettingsData,
  mapTherapistSettingsUpdateResult,
} from "./therapist-settings.mappers";

const userId = "c1000000-0000-4000-8000-000000000001";
const profileId = "d1000000-0000-4000-8000-000000000001";

describe("therapist settings mappers", () => {
  it("maps the Supabase settings contract with an embedded profile object", () => {
    expect(
      mapTherapistSettingsData({
        displayName: "Ana Oliveira",
        email: "ana@example.test",
        id: userId,
        phone: "+55 11 99999-9999",
        therapistProfile: {
          id: profileId,
          isAcceptingBookings: true,
          isPublic: true,
          plan: "premium_plus",
          publicName: "Ana Oliveira",
          publicStatus: "published",
          slug: "ana-oliveira",
          status: "approved",
        },
      }),
    ).toMatchObject({
      account: {
        displayName: "Ana Oliveira",
        email: "ana@example.test",
        phone: "+55 11 99999-9999",
        userId,
      },
      profile: {
        isAcceptingBookings: true,
        isPublic: true,
        plan: "premium_plus",
        profileId,
        publicUrl: "/terapeutas/ana-oliveira",
        status: "approved",
      },
    });
  });

  it("accepts Supabase embeds returned as arrays", () => {
    expect(
      mapTherapistSettingsData({
        displayName: "Ana Oliveira",
        email: "ana@example.test",
        id: userId,
        phone: null,
        therapistProfile: [
          {
            id: profileId,
            plan: "premium",
            publicName: "Ana Oliveira",
            slug: "",
            status: "submitted",
          },
        ],
      }).profile,
    ).toMatchObject({
      plan: "premium",
      publicUrl: "/terapeuta/perfil",
      status: "submitted",
    });
  });

  it("maps update results without leaking internal fields", () => {
    expect(
      mapTherapistSettingsUpdateResult({
        display_name: "Ana",
        email: "ana@example.test",
        phone: null,
        phone_country_code: "351",
        role: "therapist",
      }),
    ).toEqual({
      account: {
        displayName: "Ana",
        phone: "",
        phoneCountryCode: "351",
        identity: {
          city: "",
          complement: "",
          documentNumber: "",
          documentType: "cpf",
          neighborhood: "",
          postalCode: "",
          state: "",
          street: "",
          streetNumber: "",
        },
      },
    });
  });
});
