export default function AdminProfessionalsLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="min-h-screen bg-background px-1 py-7 sm:px-2 lg:py-9"
      role="status"
    >
      <div className="mx-auto w-full max-w-[1280px] space-y-6">
        <div className="max-w-2xl">
          <div className="h-3 w-16 rounded-full bg-brand-lavenderSoft motion-safe:animate-pulse" />
          <div className="mt-3 h-11 w-64 rounded-md bg-brand-lavenderSoft motion-safe:animate-pulse" />
          <div className="mt-4 h-5 w-full max-w-xl rounded-md bg-surface-muted motion-safe:animate-pulse" />
        </div>

        <div className="hidden grid-cols-4 border-y border-border py-4 sm:grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="border-l border-border px-5 first:border-l-0 first:pl-0 last:pr-0"
              key={index}
            >
              <div className="h-3 w-24 rounded-full bg-surface-muted motion-safe:animate-pulse" />
              <div className="mt-3 h-8 w-14 rounded-md bg-brand-lavenderSoft motion-safe:animate-pulse" />
              <div className="mt-3 h-4 w-32 rounded-md bg-surface-muted motion-safe:animate-pulse" />
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-card border border-border bg-white">
          <div className="px-4 py-5 sm:px-5 lg:px-6">
            <div className="h-7 w-56 rounded-md bg-brand-lavenderSoft motion-safe:animate-pulse" />
            <div className="mt-3 h-4 w-full max-w-lg rounded-md bg-surface-muted motion-safe:animate-pulse" />
            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_82px]">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="h-11 rounded-md bg-surface-muted motion-safe:animate-pulse"
                  key={index}
                />
              ))}
            </div>
          </div>
          <div className="divide-y divide-border border-t border-border">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="h-20 px-5 py-4" key={index}>
                <div className="h-full rounded-md bg-surface-muted motion-safe:animate-pulse" />
              </div>
            ))}
          </div>
        </section>

        <span className="sr-only">Carregando profissionais...</span>
      </div>
    </div>
  );
}
