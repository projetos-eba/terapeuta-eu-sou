import { NextResponse } from "next/server";

import {
  loginTherapistWithPassword,
  TherapistAuthConfigError,
  TherapistAuthRoleError,
  TherapistAuthSupabaseError,
} from "@/features/therapist-auth/supabase-rest";
import {
  THERAPIST_AUTH_CONFIG_ERROR,
  THERAPIST_AUTH_GENERIC_ERROR,
  THERAPIST_AUTH_ROLE_ERROR,
} from "@/features/therapist-auth/errors";
import { validateTherapistLogin } from "@/features/therapist-auth/validation";

const SECURE_COOKIE = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Envie os dados de login em formato valido.",
      },
      { status: 400 },
    );
  }

  const validation = validateTherapistLogin(toLoginInput(body));

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
    const session = await loginTherapistWithPassword(validation.value);
    const response = NextResponse.json({
      ok: true,
      redirectTo: session.redirectTo,
    });

    response.cookies.set("tes_therapist_access_token", session.accessToken, {
      httpOnly: true,
      maxAge: session.expiresIn,
      path: "/",
      sameSite: "lax",
      secure: SECURE_COOKIE,
    });
    response.cookies.set("tes_therapist_refresh_token", session.refreshToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: SECURE_COOKIE,
    });
    response.cookies.set("tes_therapist_plan", session.plan, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: SECURE_COOKIE,
    });

    return response;
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

    if (error instanceof TherapistAuthRoleError) {
      return NextResponse.json(
        {
          ok: false,
          message: THERAPIST_AUTH_ROLE_ERROR,
        },
        { status: 403 },
      );
    }

    if (error instanceof TherapistAuthSupabaseError) {
      return NextResponse.json(
        {
          ok: false,
          message:
            error.status === 400 || error.status === 401
              ? "E-mail ou senha invalidos."
              : THERAPIST_AUTH_GENERIC_ERROR,
        },
        { status: error.status === 400 ? 401 : 400 },
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

function toLoginInput(value: unknown) {
  const record = isRecord(value) ? value : {};

  return {
    email: asString(record.email),
    password: asString(record.password),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}
