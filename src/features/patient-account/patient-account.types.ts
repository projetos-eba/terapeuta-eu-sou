export type PatientAddress = {
  city: string;
  complement: string;
  neighborhood: string;
  postalCode: string;
  state: string;
  street: string;
  streetNumber: string;
};

export type PatientAccountPaymentStatus =
  | "failed"
  | "paid"
  | "processing"
  | "refunded";

export type PatientAccountPayment = {
  amountCents: number;
  currency: string;
  id: string;
  paidAt: string | null;
  status: PatientAccountPaymentStatus;
  statusLabel: string;
  therapistName: string | null;
  title: string;
};

export type PatientAccountData = {
  account: {
    avatarUrl: string | null;
    email: string;
    id: string;
    name: string;
    phone: string;
  };
  address: PatientAddress;
  paymentSummary: {
    count: number;
    totalPaidCents: number;
  };
  payments: PatientAccountPayment[];
  source: "demo" | "supabase";
};

export type PatientAccountEditableFields = {
  address: PatientAddress;
  name: string;
  phone: string;
};

export const emptyPatientAddress: PatientAddress = {
  city: "",
  complement: "",
  neighborhood: "",
  postalCode: "",
  state: "",
  street: "",
  streetNumber: "",
};
