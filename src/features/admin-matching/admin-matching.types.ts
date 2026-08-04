export type AdminMatchingEvent = {
  actorProfileId: string | null;
  createdAt: string;
  eventType: string;
  id: string;
  reason: string | null;
};

export type AdminMatchingInterest = {
  createdAt: string;
  history: AdminMatchingEvent[];
  id: string;
  isActive: boolean;
  name: string;
  serviceCount: number;
  slug: string;
  sortOrder: number;
  themeId: string;
  updatedAt: string;
};

export type AdminMatchingTheme = {
  createdAt: string;
  description: string;
  history: AdminMatchingEvent[];
  id: string;
  imageUrl: string | null;
  interests: AdminMatchingInterest[];
  isActive: boolean;
  name: string;
  serviceCount: number;
  slug: string;
  sortOrder: number;
  therapyCount: number;
  updatedAt: string;
};

export type AdminMatchingContract = {
  contractVersion: 1;
  themes: AdminMatchingTheme[];
};

export type AdminMatchingThemeCommand = {
  description: string;
  imageUrl: string | null;
  name: string;
  reason: string;
  slug: string;
  sortOrder: number;
  themeId?: string;
};

export type AdminMatchingInterestCommand = {
  interestId?: string;
  name: string;
  reason: string;
  slug: string;
  sortOrder: number;
  themeId: string;
};
