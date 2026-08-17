export type JourneyHistorySource = "demo" | "supabase";

export type JourneyClientStatus = "active" | "paused" | "stale";

export type JourneyHistoryMetric = {
  description: string;
  id: string;
  label: string;
  tone: "brand" | "danger" | "success" | "warning";
  trendLabel?: string;
  value: number;
};

export type JourneyHistoryClient = {
  avatarUrl: string | null;
  emailLabel: string;
  firstSessionAt: string | null;
  id: string;
  lastSessionAt: string | null;
  lastSessionServiceTitle: string | null;
  name: string;
  nextSessionAt: string | null;
  nextSessionServiceTitle: string | null;
  sessionsHref: string;
  status: JourneyClientStatus;
  therapyLabels: string[];
  timelineHref: string;
  totalEncounters: number;
  topicLabels: string[];
};

export type JourneyHistorySegment = {
  count: number;
  id: string;
  label: string;
  tone: "brand" | "danger" | "info" | "success" | "warning";
};

export type JourneyHistoryReminder = {
  count: number;
  description: string;
  href: string;
  id: string;
  label: string;
  tone: "brand" | "danger" | "warning";
};

export type JourneyHistorySummary = {
  active: number;
  paused: number;
  stale: number;
  total: number;
};

export type JourneyHistoryPageData = {
  clients: JourneyHistoryClient[];
  metrics: JourneyHistoryMetric[];
  reminders: JourneyHistoryReminder[];
  segments: JourneyHistorySegment[];
  source: JourneyHistorySource;
  summary: JourneyHistorySummary;
  therapistProfileId: string;
};

export type JourneyHistoryDetailData = {
  client: JourneyHistoryClient;
  source: JourneyHistorySource;
  therapistProfileId: string;
  timeline: Array<{
    bookingId: string;
    date: string;
    description: string;
    href: string;
    id: string;
    status: string;
    serviceTitle: string;
    title: string;
    topicLabels: string[];
  }>;
};

export type JourneyHistoryFilters = {
  q: string;
  segment: string;
  sort: "last_session" | "name" | "next_session" | "sessions";
  status: "all" | JourneyClientStatus;
};
