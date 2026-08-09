import {
  AdminFinancePage,
  getAdminFinancePage,
  type AdminFinanceModuleKey,
} from "@/features/admin-finance";
import type { AdminPermission } from "@/lib/auth/admin-permissions";
import { requireAdminSession } from "@/lib/auth/admin-session";

const financeModulePermissions = {
  payments: "admin.payments.read",
  reports: "admin.reports.read",
  subscriptions: "admin.subscriptions.read",
} satisfies Record<AdminFinanceModuleKey, AdminPermission>;

export async function AdminFinanceRoute({
  module,
}: {
  module: AdminFinanceModuleKey;
}) {
  const session = await requireAdminSession({
    permission: financeModulePermissions[module],
  });
  const result = await getAdminFinancePage({
    accessToken: session.accessToken,
    module,
  });

  if (result.status === "error") {
    return (
      <section className="mx-auto max-w-3xl rounded-lg border border-border bg-white p-6 shadow-card">
        <p className="text-xs font-extrabold uppercase text-brand-primary">
          Administração
        </p>
        <h1 className="mt-3 text-3xl font-extrabold text-brand-deep">
          Módulo indisponível
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
          {result.message}
        </p>
      </section>
    );
  }

  return <AdminFinancePage data={result.data} />;
}
