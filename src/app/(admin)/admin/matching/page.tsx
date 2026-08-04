import { AdminMatchingPage } from "@/features/admin-matching/components/admin-matching-page";
import { getAdminMatchingPage } from "@/features/admin-matching/admin-matching.queries";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminMatchingRoute() {
  const session = await requireAdminSession();
  const result = await getAdminMatchingPage({
    accessToken: session.accessToken,
  });

  if (result.status === "error") {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-brand-lavender bg-white p-6 shadow-card">
        <h1 className="font-display text-4xl font-light italic text-brand-deep">
          Match
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
          {result.message}
        </p>
        {result.requestId ? (
          <p className="mt-3 text-xs font-bold text-tesText-muted">
            Request ID: {result.requestId}
          </p>
        ) : null}
      </section>
    );
  }

  return <AdminMatchingPage initialMatching={result.matching} />;
}
