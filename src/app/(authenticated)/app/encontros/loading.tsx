export default function PatientEncountersLoading() {
  return (
    <main
      aria-label="Carregando encontros"
      className="mx-auto grid w-full max-w-[1080px] gap-9 pb-12 sm:gap-11"
    >
      <header className="grid animate-pulse gap-3 pt-2 sm:pt-4">
        <div className="h-3 w-24 rounded-full bg-brand-lavenderSoft" />
        <div className="h-11 w-72 max-w-full rounded-full bg-brand-lavenderSoft sm:w-96" />
        <div className="h-5 w-full max-w-[680px] rounded-full bg-brand-lavenderSoft" />
      </header>

      <section className="animate-pulse rounded-card bg-brand-lavenderSoft px-5 py-6 sm:px-8 sm:py-8">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <div>
            <div className="h-3 w-28 rounded-full bg-white/70" />
            <div className="mt-4 h-11 w-40 rounded-full bg-white/70" />
            <div className="mt-3 h-6 w-56 rounded-full bg-white/70" />
            <div className="mt-6 flex items-center gap-4 border-t border-border pt-5">
              <div className="size-16 rounded-full bg-white/70" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-48 rounded-full bg-white/70" />
                <div className="h-4 w-36 rounded-full bg-white/70" />
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <div className="h-8 w-32 rounded-full bg-white/70" />
            <div className="mt-4 h-5 w-full rounded-full bg-white/70" />
            <div className="mt-5 h-11 w-full rounded-full bg-white/70" />
          </div>
        </div>
      </section>

      <section className="animate-pulse">
        <div className="h-9 w-64 rounded-full bg-brand-lavenderSoft" />
        <div className="mt-3 h-5 w-full max-w-[560px] rounded-full bg-brand-lavenderSoft" />
        <div className="mt-5 divide-y divide-border border-y border-border">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="grid gap-5 py-6 md:grid-cols-4" key={index}>
              <div className="h-14 rounded-full bg-brand-lavenderSoft" />
              <div className="h-14 rounded-md bg-brand-lavenderSoft" />
              <div className="h-14 rounded-md bg-brand-lavenderSoft" />
              <div className="h-11 rounded-full bg-brand-lavenderSoft" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
