export function TherapistServicesSkeleton() {
  return (
    <main className="mx-auto grid w-full max-w-[1210px] gap-5 pb-10">
      <div className="h-[280px] animate-pulse rounded-card bg-brand-lavenderSoft" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-card border border-brand-lavender bg-white p-5 shadow-card">
          <div className="h-8 w-48 animate-pulse rounded bg-brand-lavenderSoft" />
          <div className="mt-8 grid gap-4">
            {[0, 1, 2].map((item) => (
              <div
                className="h-[230px] animate-pulse rounded-[14px] bg-brand-lavenderSoft/70"
                key={item}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <div className="h-64 animate-pulse rounded-card bg-brand-lavenderSoft" />
          <div className="h-64 animate-pulse rounded-card bg-brand-lavenderSoft" />
        </div>
      </div>
    </main>
  );
}
