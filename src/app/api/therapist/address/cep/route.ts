import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const viaCepTimeoutMs = 5000;

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const accessToken =
    cookieStore.get("tes_therapist_access_token")?.value ??
    cookieStore.get("tes_patient_access_token")?.value;
  const config = getSupabasePublicConfig();

  if (!config || !accessToken || !(await isAuthenticated(config, accessToken))) {
    return failure("Entre na sua conta para consultar o CEP.", 401);
  }

  const cep = new URL(request.url).searchParams.get("cep") ?? "";
  const digits = cep.replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) {
    return failure("Informe um CEP válido.", 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), viaCepTimeoutMs);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return failure("Não foi possível consultar este CEP agora.", 502);
    }

    const payload = (await response.json().catch(() => null)) as {
      bairro?: unknown;
      cep?: unknown;
      erro?: unknown;
      estado?: unknown;
      localidade?: unknown;
      logradouro?: unknown;
      uf?: unknown;
    } | null;

    if (payload?.erro === true) {
      return failure("CEP não encontrado. Você pode preencher o endereço manualmente.", 404);
    }

    const street = stringValue(payload?.logradouro);
    const neighborhood = stringValue(payload?.bairro);
    const city = stringValue(payload?.localidade);
    const state = stringValue(payload?.uf).toUpperCase();
    if (!street && !neighborhood && !city && !state) {
      return failure("Não foi possível localizar este CEP. Preencha o endereço manualmente.", 404);
    }

    return NextResponse.json(
      {
        data: {
          city,
          neighborhood,
          postalCode: formatPostalCode(digits),
          state,
          street,
        },
        ok: true,
      },
      { headers: noStoreHeaders },
    );
  } catch {
    return failure("Não foi possível consultar este CEP agora. Preencha o endereço manualmente.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatPostalCode(value: string) {
  return `${value.slice(0, 5)}-${value.slice(5)}`;
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: { message }, ok: false },
    { headers: noStoreHeaders, status },
  );
}

async function isAuthenticated(
  config: { apiKey: string; url: string },
  accessToken: string,
) {
  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      cache: "no-store",
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
