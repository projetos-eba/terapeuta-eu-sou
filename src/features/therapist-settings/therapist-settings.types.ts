import type { TherapistPlan, TherapistStatus } from "@/domain/tes";

export type TherapistSettingsEditableFields = {
  displayName: string;
  phone: string;
};

export type TherapistSettingsData = {
  account: TherapistSettingsEditableFields & {
    email: string;
    userId: string;
  };
  profile: {
    isAcceptingBookings: boolean;
    isPublic: boolean;
    plan: TherapistPlan;
    profileId: string;
    publicName: string;
    publicStatus: string;
    publicUrl: string;
    status: TherapistStatus;
  };
};

export type TherapistSettingsUpdatePayload = TherapistSettingsEditableFields;

export type TherapistSettingsUpdateResult = {
  account: TherapistSettingsEditableFields;
};
