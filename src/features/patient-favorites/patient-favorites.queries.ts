import "server-only";

import { cache } from "react";

import {
  getRowsByIds,
  getSupabaseServerRestConfig,
  supabaseServerRestRequest,
} from "@/lib/supabase/server-rest";
import { getTherapistAvatarUrl } from "@/lib/therapist-avatars";
import { routes } from "@/lib/routes";

import type {
  PatientFavoriteTherapist,
  PatientFavoriteTherapistsPageData,
} from "./patient-favorites.types";

const DEMO_PATIENT_PROFILE_ID = "91000000-0000-4000-8000-000000000001";

type ProfileRow = {
  display_name: string | null;
  id: string;
};

type PatientProfileRow = {
  id: string;
};

type FavoriteTherapistRow = {
  created_at: string;
  therapist_profile_id: string;
};

type TherapistRow = {
  headline: string | null;
  id: string;
  is_accepting_bookings: boolean;
  photo_url: string | null;
  public_name: string;
  slug: string;
};

export class PatientFavoritesDataError extends Error {
  constructor() {
    super("Não foi possível carregar seus favoritos.");
  }
}

export const getPatientFavoriteTherapistsPage = cache(
  async function getPatientFavoriteTherapistsPage(
    profileId: string,
    accessToken: string | null = null,
  ): Promise<PatientFavoriteTherapistsPageData> {
    const config = getSupabaseServerRestConfig(accessToken);

    if (!config) {
      if (process.env.NODE_ENV === "development") {
        return createDemoFavoriteTherapists(profileId);
      }

      throw new PatientFavoritesDataError();
    }

    try {
      const [profiles, patientProfiles] = await Promise.all([
        supabaseServerRestRequest<ProfileRow[]>(
          config,
          `/rest/v1/profiles?select=id,display_name&id=eq.${encodeURIComponent(profileId)}&limit=1`,
        ),
        supabaseServerRestRequest<PatientProfileRow[]>(
          config,
          `/rest/v1/patient_profiles?select=id&user_id=eq.${encodeURIComponent(profileId)}&limit=1`,
        ),
      ]);
      const profile = profiles[0];
      const patientProfile = patientProfiles[0];

      if (!profile || !patientProfile) {
        throw new PatientFavoritesDataError();
      }

      const favorites = await supabaseServerRestRequest<FavoriteTherapistRow[]>(
        config,
        `/rest/v1/favorite_therapists?select=therapist_profile_id,created_at&patient_profile_id=eq.${patientProfile.id}&order=created_at.desc`,
      );
      const therapists = await getRowsByIds<TherapistRow>(
        config,
        "therapist_profiles",
        "id,slug,public_name,headline,photo_url,is_accepting_bookings",
        favorites.map((favorite) => favorite.therapist_profile_id),
      );
      const therapistById = new Map(
        therapists.map((therapist) => [therapist.id, therapist]),
      );

      return {
        items: favorites.flatMap((favorite) => {
          const therapist = therapistById.get(favorite.therapist_profile_id);
          return therapist ? [mapFavoriteTherapist(favorite, therapist)] : [];
        }),
        patient: {
          id: profile.id,
          name: profile.display_name ?? "Paciente",
          patientProfileId: patientProfile.id,
        },
        source: "supabase",
      };
    } catch {
      throw new PatientFavoritesDataError();
    }
  },
);

function mapFavoriteTherapist(
  favorite: FavoriteTherapistRow,
  therapist: TherapistRow,
): PatientFavoriteTherapist {
  return {
    avatarUrl: getTherapistAvatarUrl(therapist.photo_url, {
      name: therapist.public_name,
      slug: therapist.slug,
    }),
    favoriteCreatedAt: favorite.created_at,
    headline: therapist.headline,
    id: therapist.id,
    isAcceptingBookings: therapist.is_accepting_bookings,
    name: therapist.public_name,
    profileHref: routes.public.therapistProfile(therapist.slug),
    reservationHref: `${routes.public.therapists}?therapist=${therapist.slug}`,
  };
}

function createDemoFavoriteTherapists(
  profileId: string,
): PatientFavoriteTherapistsPageData {
  return {
    items: [
      {
        avatarUrl: "/therapists/ana-oliveira.png",
        favoriteCreatedAt: new Date().toISOString(),
        headline: "Terapeuta integrativa",
        id: "92000000-0000-4000-8000-000000000011",
        isAcceptingBookings: true,
        name: "Ana Oliveira",
        profileHref: routes.public.therapistProfile("ana-oliveira"),
        reservationHref: `${routes.public.therapists}?therapist=ana-oliveira`,
      },
    ],
    patient: {
      id: profileId,
      name: "Carlos",
      patientProfileId: DEMO_PATIENT_PROFILE_ID,
    },
    source: "demo",
  };
}
