import { notFound } from "next/navigation";

import {
  AdminFinanceDetailPage,
  getAdminFinanceDetailPage,
  type AdminFinanceModuleKey,
} from "@/features/admin-finance";
import type { AdminPermission } from "@/lib/auth/admin-permissions";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

type AdminFinanceDetailModuleKey = Extract<
  AdminFinanceModuleKey,
  "payments" | "subscriptions"
>;

const financeModulePermissions = {
  payments: "admin.payments.read",
  subscriptions: "admin.subscriptions.read",
} satisfies Record<AdminFinanceDetailModuleKey, AdminPermission>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function AdminFinanceDetailRoute({
  id,
  module,
}: {
  id: string;
  module: AdminFinanceDetailModuleKey;
}) {
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const session = await requireAdminSession({
    permission: financeModulePermissions[module],
  });
  const result = await getAdminFinanceDetailPage({
    accessToken: session.accessToken,
    id,
    module,
  });

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <section className="mx-auto max-w-3xl rounded-lg border border-border bg-white p-6 shadow-card">
        <p className="text-xs font-extrabold uppercase text-brand-primary">
          Administração
        </p>
        <h1 className="mt-3 text-3xl font-extrabold text-brand-deep">
          Detalhe financeiro indisponível
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
          Não foi possível carregar este detalhe agora. Tente novamente mais
          tarde.
        </p>
      </section>
    );
  }

  if (module === "payments") {
    const config = getSupabasePublicConfig();
    if (config) {
      try {
        const response = await fetch(
          `${config.url}/rest/v1/rpc/admin_get_full_session_refund_status_v11`,
          { method: "POST", cache: "no-store", headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          }, body: JSON.stringify({ p_session_payment_id: id }) },
        );
        if (response.ok) {
          const status = await response.json() as { available?: boolean; state?: string };
          result.data.fullRefundStatus = {
            available: status.available === true,
            state: status.state ?? "unavailable",
          };
          if (status.state === "in_review") {
            const followupResponse = await fetch(
              `${config.url}/rest/v1/rpc/admin_get_full_session_refund_followup_v10`,
              { method: "POST", cache: "no-store", headers: {
                apikey: config.apiKey,
                Authorization: `Bearer ${session.accessToken}`,
                "Content-Type": "application/json",
              }, body: JSON.stringify({ p_session_payment_id: id }) },
            );
            if (followupResponse.ok) {
              const followup = await followupResponse.json() as {
                found?: boolean; requestId?: string; reason?: string;
              };
              if (followup.found && followup.requestId && followup.reason) {
                result.data.fullRefundStatus.followup = {
                  requestId: followup.requestId, reason: followup.reason,
                };
              }
            }
          }
        }
      } catch {
        // The detail remains read-only if the protected status cannot load.
      }
    }
  }
  return <AdminFinanceDetailPage data={result.data} />;
}
