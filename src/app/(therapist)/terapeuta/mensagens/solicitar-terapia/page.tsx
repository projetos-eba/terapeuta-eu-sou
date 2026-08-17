import { notFound } from "next/navigation";

import {
  TherapyCatalogRequestPage,
  type TherapyRequestCategory,
  type TherapyRequestSummary,
} from "@/features/therapy-catalog-requests/therapy-catalog-request-page";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

type PageProps = {
  searchParams: Promise<{ request?: string }>;
};

export default async function TherapistTherapyCatalogRequestPage({
  searchParams,
}: PageProps) {
  const [session, params] = await Promise.all([
    requireTherapistSession(therapistRoutePolicies.messages),
    searchParams,
  ]);
  const config = getSupabasePublicConfig();

  if (!config) notFound();

  const [categoriesResult, requestsResult] = await Promise.all([
    callRequestCommand<{ categories: TherapyRequestCategory[] }>(config.url, session.accessToken, {
      action: "categories",
    }),
    callRequestCommand<{ requests: TherapyRequestSummary[] }>(config.url, session.accessToken, {
      action: "list",
    }),
  ]);

  if (!categoriesResult.ok || !requestsResult.ok) {
    return (
      <main className="mx-auto w-full max-w-3xl pb-10">
        <section className="rounded-panel border border-state-danger/30 bg-white p-6 shadow-card">
          <h1 className="font-display text-4xl text-brand-deep">Não foi possível abrir a solicitação</h1>
          <p className="mt-3 text-sm leading-6 text-tesText-secondary">Tente novamente em instantes. Se o problema continuar, use a Central de Mensagens para falar com o suporte.</p>
        </section>
      </main>
    );
  }

  return (
    <TherapyCatalogRequestPage
      categories={categoriesResult.data.categories}
      initialRequestId={typeof params.request === "string" ? params.request : null}
      requests={requestsResult.data.requests}
    />
  );
}

async function callRequestCommand<T>(
  baseUrl: string,
  accessToken: string,
  payload: unknown,
): Promise<{ data: T; ok: true } | { ok: false }> {
  try {
    const response = await fetch(
      `${baseUrl}/functions/v1/therapy-catalog-request-command`,
      {
        body: JSON.stringify(payload),
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        method: "POST",
      },
    );
    const body = (await response.json().catch(() => null)) as { data?: T; ok?: boolean } | null;
    if (!response.ok || !body?.ok || !body.data) return { ok: false };
    return { data: body.data, ok: true };
  } catch {
    return { ok: false };
  }
}
