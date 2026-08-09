import { notFound } from "next/navigation";

import {
  AdminFinanceDetailPage,
  getAdminFinanceDetailPage,
  type AdminFinanceModuleKey,
} from "@/features/admin-finance";
import type { AdminPermission } from "@/lib/auth/admin-permissions";
import { requireAdminSession } from "@/lib/auth/admin-session";

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
          {result.message}
        </p>
      </section>
    );
  }

  return <AdminFinanceDetailPage data={result.data} />;
}
