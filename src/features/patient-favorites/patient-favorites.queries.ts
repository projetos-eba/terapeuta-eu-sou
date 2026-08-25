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

type PublicTherapistDetailsRow = {
  average_rating: number | null;
  id: string;
  published_headline: string | null;
  review_count: number | null;
  short_intro: string | null;
  tags: string[] | null;
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
      const favoriteTherapistIds = favorites.map(
        (favorite) => favorite.therapist_profile_id,
      );
      const [therapists, publicDetails] = await Promise.all([
        getRowsByIds<TherapistRow>(
          config,
          "therapist_profiles",
          "id,slug,public_name,headline,photo_url,is_accepting_bookings",
          favoriteTherapistIds,
        ),
        getRowsByIds<PublicTherapistDetailsRow>(
          config,
          "public_therapist_profiles_v",
          "id,short_intro,published_headline,tags,average_rating,review_count",
          favoriteTherapistIds,
        ),
      ]);
      const therapistById = new Map(
        therapists.map((therapist) => [therapist.id, therapist]),
      );
      const publicDetailsById = new Map(
        publicDetails.map((details) => [details.id, details]),
      );

      return {
        items: favorites.flatMap((favorite) => {
          const therapist = therapistById.get(favorite.therapist_profile_id);
          return therapist
            ? [
                mapFavoriteTherapist(
                  favorite,
                  therapist,
                  publicDetailsById.get(therapist.id),
                ),
              ]
            : [];
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
  details?: PublicTherapistDetailsRow,
): PatientFavoriteTherapist {
  return {
    averageRating: details?.average_rating ?? null,
    avatarUrl: getTherapistAvatarUrl(therapist.photo_url, {
      name: therapist.public_name,
      slug: therapist.slug,
    }),
    favoriteCreatedAt: favorite.created_at,
    headline:
      details?.published_headline ?? details?.short_intro ?? therapist.headline,
    id: therapist.id,
    isAcceptingBookings: therapist.is_accepting_bookings,
    name: therapist.public_name,
    profileHref: routes.public.therapistProfile(therapist.slug),
    reservationHref: `${routes.public.therapists}?therapist=${therapist.slug}`,
    reviewCount: details?.review_count ?? 0,
    summary: details?.short_intro ?? null,
    techniques: details?.tags?.filter(Boolean).slice(0, 5) ?? [],
  };
}

function createDemoFavoriteTherapists(
  profileId: string,
): PatientFavoriteTherapistsPageData {
  return {
    items: [
      {
        averageRating: 4.9,
        avatarUrl: "/therapists/ana-oliveira.png",
        favoriteCreatedAt: new Date().toISOString(),
        headline: "Terapeuta integrativa",
        id: "92000000-0000-4000-8000-000000000011",
        isAcceptingBookings: true,
        name: "Ana Oliveira",
        profileHref: routes.public.therapistProfile("ana-oliveira"),
        reservationHref: `${routes.public.therapists}?therapist=ana-oliveira`,
        reviewCount: 38,
        summary:
          "Acompanho processos de reconexão e autocuidado com escuta acolhedora.",
        techniques: ["Reiki", "Meditação", "Aromaterapia"],
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
