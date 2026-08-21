import { AdminSupportInboxPage } from "@/features/admin-operations/components/admin-support-inbox-page";
import { getAdminSupportInbox } from "@/features/admin-operations/admin-support-inbox";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminSupportRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminSession({
    permission: "admin.support.read",
  });
  const result = await getAdminSupportInbox({
    accessToken: session.accessToken,
    searchParams: await searchParams,
  });

  if (result.status === "error") {
    return (
      <section className="mx-auto max-w-3xl rounded-lg border border-border bg-white p-6 shadow-card">
        <p className="text-xs font-extrabold uppercase text-brand-primary">
          Administração
        </p>
        <h1 className="mt-3 text-3xl font-extrabold text-brand-deep">
          Suporte indisponível
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
          {result.message}
        </p>
      </section>
    );
  }

  return <AdminSupportInboxPage data={result.data} />;
}
