import { NextResponse } from "next/server";

import {
  CLIENT_AUTH_CONFIG_ERROR,
  CLIENT_AUTH_GENERIC_ERROR,
  getSafeClientSignupError,
} from "@/features/client-auth/errors";
import {
  ClientAuthConfigError,
  ClientAuthSupabaseError,
  createClientAccount,
} from "@/features/client-auth/supabase-rest";
import { validateClientSignup } from "@/features/client-auth/validation";
import { routes } from "@/lib/routes";

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

  const input = toSignupInput(body);
  const validation = validateClientSignup(input);

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
    const signup = await createClientAccount(validation.value);

    return NextResponse.json({
      ok: true,
      redirectTo:
        signup.mode === "automatically_confirmed"
          ? (signup.redirectTo ??
            buildClientLoginRedirect(input.next, {
              automatic: "1",
              verified: "1",
            }))
          : `${routes.public.confirmEmail}?statusToken=${encodeURIComponent(
              signup.statusToken ?? "",
            )}`,
    });
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

    if (error instanceof ClientAuthSupabaseError) {
      return NextResponse.json(
        {
          ok: false,
          message: getSafeClientSignupError(error.status),
        },
        { status: error.status === 409 ? 409 : 400 },
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

function toSignupInput(value: unknown) {
  const record = isRecord(value) ? value : {};

  return {
    birthDate: asString(record.birthDate),
    confirmPassword: asString(record.confirmPassword),
    email: asString(record.email),
    name: asString(record.name),
    next: asString(record.next),
    password: asString(record.password),
    phone: asString(record.phone),
    termsAccepted: record.termsAccepted === true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function buildClientLoginRedirect(
  next: string | undefined,
  extras: Record<string, string>,
) {
  const params = new URLSearchParams(extras);
  if (next && next.startsWith("/") && !next.startsWith("//") && !/[\r\n]/.test(next)) {
    params.set("next", next);
  }

  return `${routes.public.clientSignIn}?${params.toString()}`;
}
