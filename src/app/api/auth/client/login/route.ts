import { NextResponse } from "next/server";

import {
  CLIENT_AUTH_CONFIG_ERROR,
  CLIENT_AUTH_GENERIC_ERROR,
  CLIENT_AUTH_ROLE_ERROR,
} from "@/features/client-auth/errors";
import {
  ClientAuthConfigError,
  ClientAuthEmailUnconfirmedError,
  ClientAuthRoleError,
  ClientAuthSupabaseError,
  loginClientWithPassword,
} from "@/features/client-auth/supabase-rest";
import { validateClientLogin } from "@/features/client-auth/validation";
import { setAuthSessionCookies } from "@/lib/auth/session-cookies";

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

  const validation = validateClientLogin(toLoginInput(body));

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
    const session = await loginClientWithPassword(validation.value);
    const response = NextResponse.json({
      ok: true,
      redirectTo:
        getSafeRedirect(toLoginInput(body).next) ?? session.redirectTo,
    });

    setAuthSessionCookies(response, "patient", session, {
      userId: session.userId,
    });

    return response;
  } catch (error) {
    if (error instanceof ClientAuthConfigError) {
      return NextResponse.json(
        {
          ok: false,
          message: CLIENT_AUTH_CONFIG_ERROR,
        },
        { status: 503 },
      );
    }

    if (error instanceof ClientAuthRoleError) {
      return NextResponse.json(
        {
          ok: false,
          message: CLIENT_AUTH_ROLE_ERROR,
        },
        { status: 403 },
      );
    }

    if (error instanceof ClientAuthEmailUnconfirmedError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Confirme seu e-mail antes de entrar.",
        },
        { status: 403 },
      );
    }

    if (error instanceof ClientAuthSupabaseError) {
      return NextResponse.json(
        {
          ok: false,
          message:
            error.status === 400 || error.status === 401
              ? "E-mail ou senha inválidos."
              : CLIENT_AUTH_GENERIC_ERROR,
        },
        { status: error.status === 400 ? 401 : 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: CLIENT_AUTH_GENERIC_ERROR,
      },
      { status: 500 },
    );
  }
}

function toLoginInput(value: unknown) {
  const record = isRecord(value) ? value : {};

  return {
    email: asString(record.email),
    next: asString(record.next),
    password: asString(record.password),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getSafeRedirect(value: string) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\r\n]/.test(value)
  ) {
    return null;
  }

  return value;
}
