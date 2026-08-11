import {
  AdminFinancePage,
  AdminPaymentsPage,
  AdminSubscriptionsPage,
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
  searchParams,
}: {
  module: AdminFinanceModuleKey;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAdminSession({
    permission: financeModulePermissions[module],
  });
  const result = await getAdminFinancePage({
    accessToken: session.accessToken,
    module,
    searchParams,
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
          Não foi possível carregar este conteúdo agora. Tente novamente em
          alguns instantes.
        </p>
      </section>
    );
  }

  if (module === "payments") {
    return <AdminPaymentsPage data={result.data} />;
  }

  if (module === "subscriptions") {
    return <AdminSubscriptionsPage data={result.data} />;
  }

  return <AdminFinancePage data={result.data} />;
}
