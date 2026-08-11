import { notFound } from "next/navigation";

import {
  AdminOperationDetailPage,
  getAdminOperationDetailPage,
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function AdminOperationDetailRoute({
  id,
  module,
}: {
  id: string;
  module: AdminOperationModuleKey;
}) {
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const session = await requireAdminSession({
    permission: operationModulePermissions[module],
  });
  const result = await getAdminOperationDetailPage({
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
          Detalhe indisponível
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
          Não foi possível carregar este detalhe agora. Tente novamente mais
          tarde.
        </p>
      </section>
    );
  }

  return <AdminOperationDetailPage data={result.data} />;
}
