import type {
  AdminOperationalStatus,
  AdminOperationalTone,
} from "@/features/admin-platform/admin-platform.types";

export type AdminSettingsSignal = {
  actionLabel?: string;
  description: string;
  href?: string;
  key: string;
  label: string;
  source: string;
  status: AdminOperationalStatus;
  tone: AdminOperationalTone;
};

export type AdminSettingsGroup = {
  description: string;
  key: string;
  items: AdminSettingsSignal[];
  title: string;
};

export type AdminReleaseCheck = {
  description: string;
  key: string;
  label: string;
  status: AdminOperationalStatus;
};

export type AdminSettingsPageData = {
  generatedAt: string;
  groups: AdminSettingsGroup[];
  releaseChecks: AdminReleaseCheck[];
  secretPolicy: string[];
};

export type AdminSettingsPageResult =
  | {
      data: AdminSettingsPageData;
      status: "success";
    }
  | {
      message: string;
      status: "error";
    };
