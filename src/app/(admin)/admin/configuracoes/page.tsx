import {
  AdminSettingsPage,
  getAdminSettingsPage,
} from "@/features/admin-settings";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminSettingsRoute() {
  await requireAdminSession({
    permission: "admin.settings.read",
  });
  const result = await getAdminSettingsPage();

  if (result.status === "error") {
    return (
      <section className="mx-auto max-w-3xl rounded-lg border border-border bg-white p-6 shadow-card">
        <p className="text-xs font-extrabold uppercase text-brand-primary">
          Administração
        </p>
        <h1 className="mt-3 text-3xl font-extrabold text-brand-deep">
          Configurações
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
          {result.message}
        </p>
      </section>
    );
  }

  return <AdminSettingsPage data={result.data} />;
}
