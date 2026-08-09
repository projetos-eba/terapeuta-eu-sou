import { AdminTherapyCatalogPage } from "@/features/admin-therapy-catalog/components/admin-therapy-catalog-page";
import { getAdminTherapyCatalogPage } from "@/features/admin-therapy-catalog/admin-therapy-catalog.queries";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminTherapiesPage() {
  const session = await requireAdminSession({
    permission: "admin.therapies.read",
  });
  const result = await getAdminTherapyCatalogPage({
    accessToken: session.accessToken,
  });

  if (result.status === "error") {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-brand-lavender bg-white p-6 shadow-card">
        <h1 className="font-display text-4xl font-light italic text-brand-deep">
          Terapias
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
          {result.message}
        </p>
      </section>
    );
  }

  return <AdminTherapyCatalogPage initialCatalog={result.catalog} />;
}
