export type MatchingInterest = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  themeId: string;
};

export type MatchingTheme = {
  description: string;
  id: string;
  imageUrl: string | null;
  interests: MatchingInterest[];
  name: string;
  slug: string;
  sortOrder: number;
};

export type MatchingConfig = {
  source: "fallback" | "supabase";
  themes: MatchingTheme[];
  versionId: string;
  version: number;
};

export type MatchingSelection = {
  interestIds: string[];
  source: "journey";
  themeIds: string[];
};

export type MatchingWeight = {
  interestId: string | null;
  isActive: boolean;
  themeId: string | null;
  therapyId: string;
  weight: number;
};

export type MatchingTherapy = {
  description: string;
  id: string;
  imageUrl: string | null;
  isVisibleInMatching: boolean;
  name: string;
  shortDescription: string;
  slug: string;
  status: "active" | "archived" | "draft" | "inactive" | "published";
  therapistCount: number;
};

export type MatchingResultItem = {
  explanation: string;
  label: string;
  matchedInterestIds: string[];
  matchedThemeIds: string[];
  scorePercent: number;
  slug: string;
  therapistCount: number;
  therapyId: string;
  title: string;
};

export type MatchingCalculationResult = {
  lowConfidence: boolean;
  results: MatchingResultItem[];
  source: "fallback" | "supabase";
  versionId: string;
};
