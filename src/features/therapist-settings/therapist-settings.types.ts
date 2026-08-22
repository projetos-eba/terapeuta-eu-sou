import type { TherapistPlan, TherapistStatus } from "@/domain/tes";

export type TherapistSettingsEditableFields = {
  displayName: string;
  phone: string;
  identity: TherapistPrivateIdentityFields;
};

export type TherapistPrivateIdentityDocumentType = "cpf" | "rg" | "passport";

export type TherapistPrivateIdentityFields = {
  city: string;
  complement: string;
  documentNumber: string;
  documentType: TherapistPrivateIdentityDocumentType;
  neighborhood: string;
  postalCode: string;
  state: string;
  street: string;
  streetNumber: string;
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

export type TherapistSettingsUpdatePayload = Omit<
  TherapistSettingsEditableFields,
  "identity"
> & {
  identity?: TherapistPrivateIdentityFields;
};

export type TherapistSettingsUpdateResult = {
  account: TherapistSettingsEditableFields;
};
