import {
  AdminIntegrationsPage,
  getAdminIntegrationsPage,
} from "@/features/admin-platform";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminIntegrationsRoute() {
  const session = await requireAdminSession();
  const result = await getAdminIntegrationsPage({
    accessToken: session.accessToken,
  });

  if (result.status === "error") {
    return (
      <section className="mx-auto max-w-3xl rounded-lg border border-border bg-white p-6 shadow-card">
        <p className="text-xs font-extrabold uppercase text-brand-primary">
          Administração
        </p>
        <h1 className="mt-3 text-3xl font-extrabold text-brand-deep">
          Integrações
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
          {result.message}
        </p>
      </section>
    );
  }

  return <AdminIntegrationsPage data={result.data} />;
}
