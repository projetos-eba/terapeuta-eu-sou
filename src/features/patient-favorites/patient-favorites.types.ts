export type PatientFavoriteTherapist = {
  avatarUrl: string | null;
  favoriteCreatedAt: string;
  headline: string | null;
  id: string;
  isAcceptingBookings: boolean;
  name: string;
  profileHref: string;
  reservationHref: string;
};

export type PatientFavoriteTherapistsPageData = {
  items: PatientFavoriteTherapist[];
  patient: {
    id: string;
    name: string;
    patientProfileId: string;
  };
  source: "demo" | "supabase";
};
