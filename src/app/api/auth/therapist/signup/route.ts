import { NextResponse } from "next/server";

import { routes } from "@/lib/routes";
import {
  createTherapistAccount,
  TherapistAuthConfigError,
  TherapistAuthSupabaseError,
} from "@/features/therapist-auth/supabase-rest";
import {
  getSafeSignupError,
  THERAPIST_AUTH_CONFIG_ERROR,
  THERAPIST_AUTH_GENERIC_ERROR,
} from "@/features/therapist-auth/errors";
import { validateTherapistSignup } from "@/features/therapist-auth/validation";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Envie os dados do cadastro em formato valido.",
      },
      { status: 400 },
    );
  }

  const validation = validateTherapistSignup(toSignupInput(body));

  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        fieldErrors: validation.fieldErrors,
        message: "Revise os campos destacados.",
      },
      { status: 422 },
    );
  }

  try {
    const signup = await createTherapistAccount(validation.value);

    return NextResponse.json({
      ok: true,
      redirectTo:
        signup.mode === "automatically_confirmed"
          ? (signup.redirectTo ??
            `${routes.public.therapistSignIn}?verified=1&automatic=1`)
          : `${routes.public.confirmEmail}?statusToken=${encodeURIComponent(
              signup.statusToken ?? "",
            )}`,
    });
  } catch (error) {
    if (error instanceof TherapistAuthConfigError) {
      return NextResponse.json(
        {
          ok: false,
          message: THERAPIST_AUTH_CONFIG_ERROR,
        },
        { status: 503 },
      );
    }

    if (error instanceof TherapistAuthSupabaseError) {
      return NextResponse.json(
        {
          ok: false,
          message: getSafeSignupError(error.status),
        },
        { status: error.status === 409 ? 409 : 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: THERAPIST_AUTH_GENERIC_ERROR,
      },
      { status: 500 },
    );
  }
}

function toSignupInput(value: unknown) {
  const record = isRecord(value) ? value : {};

  return {
    birthDate: asString(record.birthDate),
    confirmPassword: asString(record.confirmPassword),
    email: asString(record.email),
    fullName: asString(record.fullName),
    password: asString(record.password),
    phone: asString(record.phone),
    plan: typeof record.plan === "string" ? record.plan : null,
    termsAccepted: record.termsAccepted === true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}
