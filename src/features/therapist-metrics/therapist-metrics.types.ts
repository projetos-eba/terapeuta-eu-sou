export type TherapistMetricDirection = "down" | "stable" | "up";

export type TherapistMetricState = "empty" | "ready";

export type TherapistMetricName =
  | "booking_flow_starts"
  | "operational_presence"
  | "people_served"
  | "people_returned"
  | "profile_favorites"
  | "profile_to_booking"
  | "profile_views"
  | "reserved_duration_average"
  | "return_rate"
  | "search_impressions"
  | "search_to_profile"
  | "service_minutes"
  | "sessions_cancelled"
  | "sessions_completed"
  | "sessions_per_person"
  | "sessions_rescheduled"
  | "therapy_bookings";

export type TherapistMetricDirectionCopyKey =
  `therapist_metrics.${TherapistMetricName}.${TherapistMetricDirection}`;

export type TherapistMetricCounter<
  TUnit extends "events" | "minutes" | "people" | "sessions",
> = {
  direction: TherapistMetricDirection;
  directionCopyKey: TherapistMetricDirectionCopyKey;
  previousValue: number;
  status: TherapistMetricState;
  unit: TUnit;
  value: number;
};

export type TherapistMetricSampledValue<
  TUnit extends "favorites" | "people" | "percent" | "ratio",
> =
  | {
      direction: TherapistMetricDirection;
      directionCopyKey: TherapistMetricDirectionCopyKey;
      minimumSample: number;
      observedSample: number;
      previousValue: number | null;
      status: "ready";
      unit: TUnit;
      value: number;
    }
  | {
      direction: null;
      directionCopyKey: null;
      minimumSample: number;
      observedSample: number;
      previousValue: null;
      status: "insufficient_sample";
      unit: TUnit;
      value: null;
    };

export type TherapistMetricActivityPoint = {
  date: string;
  sessionsCompleted: number;
};

export type TherapistMetricDataStatus =
  | "empty"
  | "processing"
  | "ready"
  | "unavailable";

export type TherapistMetricsOverview = {
  activity: {
    freshThrough: string;
    points: TherapistMetricActivityPoint[];
    status: "empty" | "ready";
  };
  contractVersion: 1;
  counters: TherapistMetricsFoundation["counters"];
  discovery: {
    freshThrough: string | null;
    funnel: {
      profileToBooking: TherapistMetricSampledValue<"percent">;
      searchToProfile: TherapistMetricSampledValue<"percent">;
    };
    reason: "privacy_activation_pending" | null;
    stages: {
      bookingFlowStarts: TherapistMetricCounter<"events">;
      profileViews: TherapistMetricCounter<"events">;
      searchImpressions: TherapistMetricCounter<"events">;
    };
    status: TherapistMetricDataStatus;
  };
  meta: Omit<TherapistMetricsFoundation["meta"], "periodDays"> & {
    periodDays: 30 | 90;
  };
  metricDefinitionVersion: 1;
  occupancy: {
    reason: "historical_availability_not_versioned";
    status: "unavailable";
  };
  profileFavorites: TherapistMetricSampledValue<"favorites">;
  therapist: TherapistMetricsFoundation["therapist"];
  therapyRanking: {
    items: Array<{
      counter: TherapistMetricCounter<"sessions">;
      therapyId: string;
      therapyName: string;
    }>;
    minimumSample: 10;
    observedSample: number;
    status: "empty" | "insufficient_sample" | "ready";
  };
};

export type TherapistMetricsFoundation = {
  contractVersion: 1;
  counters: {
    peopleServed: TherapistMetricCounter<"people">;
    serviceMinutes: TherapistMetricCounter<"minutes">;
    sessionsCompleted: TherapistMetricCounter<"sessions">;
  };
  meta: {
    computedAt: string;
    freshThrough: string;
    periodDays: 30;
    periodEnd: string;
    periodStart: string;
    previousPeriodEnd: string;
    previousPeriodStart: string;
    timezone: string;
  };
  metricDefinitionVersion: 1;
  therapist: {
    plan: "premium" | "premium_plus";
    profileId: string;
  };
};

export type TherapistMetricKey = keyof TherapistMetricsFoundation["counters"];

export type TherapistMetricsPeriodDays =
  TherapistMetricsOverview["meta"]["periodDays"];

export type TherapistMetricsTab = "interest" | "overview" | "sessions";

export type TherapistMetricsCommonMeta = TherapistMetricsOverview["meta"];

export type TherapistMetricProtectedCollection<TItem> = {
  items: TItem[];
  minimumSample: 10;
  observedSample: number;
  status: "empty" | "insufficient_sample" | "ready";
};

export type TherapistSessionEvolutionPoint = {
  date: string;
  noShows: number;
  sessionsCancelled: number;
  sessionsCompleted: number;
  sessionsRescheduled: number;
};

export type TherapistSessionOutcomeKey =
  | "cancelled_by_patient"
  | "cancelled_by_therapist"
  | "completed"
  | "no_show_patient"
  | "no_show_therapist";

export type TherapistSessionMetrics = {
  cancellationReasons: {
    reason: "cancellation_taxonomy_not_versioned";
    status: "unavailable";
  };
  contractVersion: 1;
  evolution: {
    points: TherapistSessionEvolutionPoint[];
    status: "empty" | "ready";
  };
  heatmap: TherapistMetricProtectedCollection<{
    dayOfWeek: number;
    hourBucketStart: number;
    sessions: number;
  }>;
  meta: TherapistMetricsCommonMeta;
  metricDefinitionVersion: 1;
  outcomeDistribution: TherapistMetricProtectedCollection<{
    key: TherapistSessionOutcomeKey;
    label: string;
    percentage: number;
    value: number;
  }>;
  presenceByDay: TherapistMetricProtectedCollection<{
    dayOfWeek: number;
    percentage: number;
    sample: number;
  }>;
  presenceByHour: TherapistMetricProtectedCollection<{
    hourBucketStart: number;
    percentage: number;
    sample: number;
  }>;
  summary: {
    operationalPresence: TherapistMetricSampledValue<"percent">;
    reservedDurationAverage: TherapistMetricCounter<"minutes">;
    sessionsCancelled: TherapistMetricCounter<"sessions">;
    sessionsCompleted: TherapistMetricCounter<"sessions">;
    sessionsRescheduled: TherapistMetricCounter<"sessions">;
  };
  therapist: TherapistMetricsFoundation["therapist"];
  therapyDistribution: TherapistMetricProtectedCollection<{
    percentage: number;
    sessions: number;
    therapyId: string;
    therapyName: string;
  }>;
};

export type TherapistInterestSegmentKey =
  | "active"
  | "inactive"
  | "new"
  | "paused"
  | "recurring";

type TherapistInterestMetricsBase = {
  contractVersion: 1;
  meta: TherapistMetricsCommonMeta;
  metricDefinitionVersion: 1;
  therapist: TherapistMetricsFoundation["therapist"];
};

export type TherapistInterestMetrics =
  | (TherapistInterestMetricsBase & {
      access: {
        requiredPlan: "premium_plus";
        status: "capability_locked";
      };
    })
  | (TherapistInterestMetricsBase & {
      access: {
        requiredPlan: "premium_plus";
        status: "ready";
      };
      availabilityGap: {
        reason: "availability_gap_event_not_implemented";
        status: "unavailable";
      };
      baseEvolution: TherapistMetricProtectedCollection<{
        date: string;
        newPeople: number;
        totalPeople: number;
      }>;
      cohorts: TherapistMetricProtectedCollection<{
        cohortMonth: string;
        cohortSize: number;
        retention: Array<{
          monthOffset: number;
          percentage: number;
        }>;
      }>;
      exitReasons: {
        reason: "relationship_exit_taxonomy_not_versioned";
        status: "unavailable";
      };
      favoriteConversion: {
        reason: "favorite_conversion_linkage_not_available";
        status: "unavailable";
      };
      journeyThemes: {
        reason: "free_text_analysis_prohibited";
        status: "unavailable";
      };
      segments: TherapistMetricProtectedCollection<{
        key: TherapistInterestSegmentKey;
        percentage: number;
        value: number;
      }> & {
        definitionVersion: 1;
      };
      sentiment: {
        reason: "sentiment_schema_and_consent_not_implemented";
        status: "unavailable";
      };
      summary: {
        peopleReturned: TherapistMetricSampledValue<"people">;
        profileFavorites: TherapistMetricSampledValue<"favorites">;
        returnRate: TherapistMetricSampledValue<"percent">;
        sessionsPerPerson: TherapistMetricSampledValue<"ratio">;
      };
      therapyReturn: TherapistMetricProtectedCollection<{
        people: number;
        returnedPeople: number;
        returnRate: number;
        therapyId: string;
        therapyName: string;
      }>;
    });

export type TherapistInterestMetricsReady = Extract<
  TherapistInterestMetrics,
  { access: { status: "ready" } }
>;

export type TherapistOccupancyPoint = {
  date: string;
  occupiedMinutes: number;
  offeredMinutes: number;
  percentage: number | null;
};

export type TherapistOccupancyHeatmapPoint = {
  dayOfWeek: number;
  occupiedMinutes: number;
  offeredMinutes: number;
  hourBucketStart: number;
  percentage: number | null;
};

export type TherapistMetricsOccupancy =
  | {
      coverageDays: number;
      coverageStart: string | null;
      reason: "history_in_formation";
      requiredCoverageDays: 30 | 90;
      status: "forming";
    }
  | {
      coverageDays: number;
      coverageStart: string;
      current: {
        occupiedMinutes: number;
        offeredMinutes: number;
        percentage: number | null;
      };
      heatmap: TherapistOccupancyHeatmapPoint[];
      previous: {
        occupiedMinutes: number;
        offeredMinutes: number;
        percentage: number | null;
      };
      requiredCoverageDays: 30 | 90;
      series: TherapistOccupancyPoint[];
      status: "empty" | "ready";
    };

export type TherapistMetricsDashboard = {
  contractVersion: 2;
  interest: TherapistInterestMetrics;
  meta: TherapistMetricsCommonMeta;
  metricDefinitionVersion: 2;
  occupancy: TherapistMetricsOccupancy;
  overview: TherapistMetricsOverview;
  sessions: TherapistSessionMetrics;
  therapist: TherapistMetricsFoundation["therapist"];
};
