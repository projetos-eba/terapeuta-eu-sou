export const platformAssets = {
  patientEncountersHero: {
    src: "/assets/plataforma/patient-encounters-hero.png",
  },
  patientFavoritesHero: {
    src: "/assets/plataforma/patient-favorites-hero.png",
  },
  patientMessagesHero: {
    src: "/assets/plataforma/patient-messages-hero.png",
  },
  patientOverviewHero: {
    src: "/assets/plataforma/patient-overview-hero.png",
  },
  publicJourneyCta: {
    src: "/assets/plataforma/public-journey-cta.png",
  },
  publicJourneyPathsCard: {
    src: "/assets/plataforma/public-journey-paths-card.png",
  },
  publicTherapiesCard: {
    src: "/assets/plataforma/public-therapies-card.png",
  },
  publicTherapiesHero: {
    src: "/assets/plataforma/public-therapies-hero.png",
  },
  publicTherapistsHero: {
    src: "/assets/plataforma/public-therapists-hero.png",
  },
  publicTherapistsLowerBanner: {
    src: "/assets/plataforma/public-therapists-lower-banner.png",
  },
  therapistDashboardHero: {
    src: "/assets/plataforma/therapist-dashboard-hero.png",
  },
  therapistAuraCharacter: {
    src: "/therapist/dashboard/aura.png",
  },
  therapistFinanceHero: {
    src: "/assets/plataforma/therapist-finance-hero.png",
  },
  therapistLoginIcon: {
    src: "/assets/plataforma/therapist-login-icon.png",
  },
  therapistMessagesHero: {
    src: "/assets/plataforma/therapist-messages-hero.png",
  },
  therapistMetricsHero: {
    src: "/assets/plataforma/therapist-metrics-hero.png",
  },
  therapistReviewsHero: {
    src: "/assets/plataforma/therapist-reviews-hero.png",
  },
  therapistServicesHero: {
    src: "/assets/plataforma/therapist-services-hero.png",
  },
} as const;

export type PlatformAssetKey = keyof typeof platformAssets;
