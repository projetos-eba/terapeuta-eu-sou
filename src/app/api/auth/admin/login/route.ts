import { NextResponse } from "next/server";

import { setAdminSessionCookies } from "@/features/admin-auth/session-cookies";
import {
  AdminAuthConfigError,
  AdminAuthEmailUnconfirmedError,
  AdminAuthRoleError,
  AdminAuthSupabaseError,
  loginAdminWithPassword,
} from "@/features/admin-auth/supabase-rest";
import { validateAdminLogin } from "@/features/admin-auth/validation";
import { routes } from "@/lib/routes";

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

  const validation = validateAdminLogin(toLoginInput(body));

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
    const session = await loginAdminWithPassword(validation.value);
    const response = NextResponse.json({
      ok: true,
      redirectTo: routes.admin.therapies,
    });

    setAdminSessionCookies(response, session);

    return response;
  } catch (error) {
    if (error instanceof AdminAuthConfigError) {
      return failure("Configuracao Supabase ausente para acesso admin.", 503);
    }

    if (error instanceof AdminAuthRoleError) {
      return failure("Use uma conta administrativa para acessar o Admin.", 403);
    }

    if (error instanceof AdminAuthEmailUnconfirmedError) {
      return failure("Confirme o e-mail administrativo antes de entrar.", 403);
    }

    if (error instanceof AdminAuthSupabaseError) {
      return failure(
        error.status === 400 || error.status === 401
          ? "E-mail ou senha invalidos."
          : "Nao foi possivel entrar agora.",
        error.status === 400 ? 401 : 400,
      );
    }

    return failure("Nao foi possivel entrar agora.", 500);
  }
}

function failure(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
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
