import {
  AdminOperationPage,
  getAdminOperationPage,
  type AdminOperationModuleKey,
} from "@/features/admin-operations";
import type { AdminPermission } from "@/lib/auth/admin-permissions";
import { requireAdminSession } from "@/lib/auth/admin-session";

const operationModulePermissions = {
  patients: "admin.patients.read",
  professionals: "admin.professionals.read",
  reviews: "admin.reviews.read",
  sessions: "admin.sessions.read",
  support: "admin.support.read",
  verifications: "admin.professionals.verify",
} satisfies Record<AdminOperationModuleKey, AdminPermission>;

export async function AdminOperationRoute({
  module,
}: {
  module: AdminOperationModuleKey;
}) {
  const session = await requireAdminSession({
    permission: operationModulePermissions[module],
  });
  const result = await getAdminOperationPage({
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

  return <AdminOperationPage data={result.data} />;
}
