import "server-only";

import { cache } from "react";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

import { getPatientAddressFromMetadata } from "./patient-account.mappers";
import type {
  PatientAccountData,
  PatientAccountPayment,
} from "./patient-account.types";

type SupabaseServerConfig = {
  accessToken: string;
  apiKey: string;
  url: string;
};

type ProfileRow = {
  avatar_url: string | null;
  display_name: string | null;
  email: string | null;
  id: string;
  phone_country_code: string | null;
};

type PatientProfileRow = {
  avatar_url: string | null;
  display_name: string | null;
  id: string;
  metadata: unknown;
  phone: string | null;
  phone_country_code: string | null;
};

type PaymentRow = {
  booking_id: string;
  created_at: string;
  currency: string;
  financial_status: string;
  gross_amount_cents: number;
  id: string;
  paid_at: string | null;
};

type BookingRow = {
  id: string;
  service_title_snapshot: string | null;
  therapist_profile_id: string;
};

type TherapistRow = {
  id: string;
  public_name: string | null;
};

export class PatientAccountDataError extends Error {
  constructor() {
    super("Não foi possível carregar os dados da sua conta.");
  }
}

export const getPatientAccount = cache(async function getPatientAccount(
  profileId: string,
  accessToken: string | null = null,
): Promise<PatientAccountData> {
  const config = getSupabaseServerConfig(accessToken);

  if (!config) {
    if (process.env.NODE_ENV === "development") {
      return createDemoPatientAccount(profileId);
    }
    throw new PatientAccountDataError();
  }

  try {
    return await getSupabasePatientAccount(config, profileId);
  } catch {
    throw new PatientAccountDataError();
  }
});

async function getSupabasePatientAccount(
  config: SupabaseServerConfig,
  profileId: string,
): Promise<PatientAccountData> {
  const [profiles, patientProfiles] = await Promise.all([
    supabaseRequest<ProfileRow[]>(
      config,
      `/rest/v1/profiles?select=id,display_name,email,avatar_url,phone_country_code&id=eq.${encodeURIComponent(profileId)}&limit=1`,
    ),
    supabaseRequest<PatientProfileRow[]>(
      config,
      `/rest/v1/patient_profiles?select=id,display_name,phone,phone_country_code,avatar_url,metadata&user_id=eq.${encodeURIComponent(profileId)}&limit=1`,
    ),
  ]);

  const profile = profiles[0];
  const patientProfile = patientProfiles[0];
  if (!profile || !patientProfile) throw new PatientAccountDataError();

  const payments = await supabaseRequest<PaymentRow[]>(
    config,
    `/rest/v1/session_payments?select=id,booking_id,gross_amount_cents,currency,financial_status,paid_at,created_at&patient_profile_id=eq.${encodeURIComponent(patientProfile.id)}&order=created_at.desc&limit=3`,
  );
  const bookingIds = unique(payments.map((payment) => payment.booking_id));
  const bookings = await getRowsByIds<BookingRow>(
    config,
    "bookings",
    "id,service_title_snapshot,therapist_profile_id",
    bookingIds,
  );
  const therapistIds = unique(
    bookings.map((booking) => booking.therapist_profile_id),
  );
  const therapists = await getRowsByIds<TherapistRow>(
    config,
    "therapist_profiles",
    "id,public_name",
    therapistIds,
  );

  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
  const therapistById = new Map(
    therapists.map((therapist) => [therapist.id, therapist]),
  );
  const mappedPayments = payments.map((payment) => {
    const booking = bookingById.get(payment.booking_id);
    const therapist = booking
      ? therapistById.get(booking.therapist_profile_id)
      : undefined;
    return mapPayment(
      payment,
      booking?.service_title_snapshot,
      therapist?.public_name,
    );
  });

  return {
    account: {
      avatarUrl: patientProfile.avatar_url ?? profile.avatar_url,
      email: profile.email ?? "",
      id: profile.id,
      name: patientProfile.display_name || profile.display_name || "Paciente",
      phone: patientProfile.phone ?? "",
      phoneCountryCode:
        patientProfile.phone_country_code ?? profile.phone_country_code ?? "55",
    },
    address: getPatientAddressFromMetadata(patientProfile.metadata),
    paymentSummary: {
      count: payments.filter((payment) => isPaid(payment.financial_status))
        .length,
      totalPaidCents: payments
        .filter((payment) => isPaid(payment.financial_status))
        .reduce((total, payment) => total + payment.gross_amount_cents, 0),
    },
    payments: mappedPayments,
    source: "supabase",
  };
}

function mapPayment(
  payment: PaymentRow,
  title: string | null | undefined,
  therapistName: string | null | undefined,
): PatientAccountPayment {
  const status = paymentStatus(payment.financial_status);
  return {
    amountCents: payment.gross_amount_cents,
    currency: payment.currency,
    id: payment.id,
    paidAt: payment.paid_at ?? payment.created_at,
    status,
    statusLabel:
      status === "paid"
        ? "Pago"
        : status === "processing"
          ? "Em processamento"
          : status === "refunded"
            ? "Reembolsado"
            : "Não concluído",
    therapistName: therapistName ?? null,
    title: title || "Encontro TES",
  };
}

function paymentStatus(value: string): PatientAccountPayment["status"] {
  if (value === "paid" || value === "partially_refunded") return "paid";
  if (value === "refunded") return "refunded";
  if (value === "failed" || value === "canceled" || value === "disputed") {
    return "failed";
  }
  return "processing";
}

function isPaid(value: string) {
  return value === "paid" || value === "partially_refunded";
}

function createDemoPatientAccount(profileId: string): PatientAccountData {
  return {
    account: {
      avatarUrl: null,
      email: "",
      id: profileId,
      name: "Carlos",
      phone: "",
      phoneCountryCode: "55",
    },
    address: {
      city: "",
      complement: "",
      neighborhood: "",
      postalCode: "",
      state: "",
      street: "",
      streetNumber: "",
    },
    paymentSummary: { count: 0, totalPaidCents: 0 },
    payments: [],
    source: "demo",
  };
}

function getSupabaseServerConfig(
  accessToken: string | null,
): SupabaseServerConfig | null {
  const config = getSupabasePublicConfig();
  if (!config || !accessToken) return null;
  return { accessToken, apiKey: config.apiKey, url: config.url };
}

async function getRowsByIds<T>(
  config: SupabaseServerConfig,
  table: string,
  select: string,
  ids: string[],
) {
  if (ids.length === 0) return [] as T[];
  return supabaseRequest<T[]>(
    config,
    `/rest/v1/${table}?select=${select}&id=in.(${ids.join(",")})`,
  );
}

async function supabaseRequest<T>(config: SupabaseServerConfig, path: string) {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.accessToken}`,
    },
  });
  if (!response.ok) throw new PatientAccountDataError();
  return (await response.json()) as T;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
