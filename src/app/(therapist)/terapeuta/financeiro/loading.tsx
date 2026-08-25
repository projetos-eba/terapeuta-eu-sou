import { AppPageContainer } from "@/components/app-page";

export default function TherapistFinanceLoading() {
  return (
    <AppPageContainer
      aria-busy="true"
      aria-label="Carregando informações financeiras"
      className="gap-6"
    >
      <header className="grid gap-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="h-12 w-72 animate-pulse rounded-full bg-brand-lavenderSoft sm:h-14" />
            <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded-full bg-brand-lavenderSoft" />
          </div>
          <div className="flex gap-2">
            <div className="h-11 w-48 animate-pulse rounded-lg bg-brand-lavenderSoft" />
            <div className="h-11 w-24 animate-pulse rounded-lg bg-brand-lavenderSoft" />
          </div>
        </div>
        <div className="flex gap-5 border-b border-brand-lavender pb-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <span
              className="h-5 w-28 animate-pulse rounded-full bg-brand-lavenderSoft"
              key={index}
            />
          ))}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="grid min-h-[188px] gap-5 rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6"
            key={index}
          >
            <div className="size-11 animate-pulse rounded-full bg-brand-lavenderSoft" />
            <div className="grid content-end gap-3">
              <div className="h-8 w-32 animate-pulse rounded-full bg-brand-lavenderSoft" />
              <div className="h-4 w-36 animate-pulse rounded-full bg-brand-lavenderSoft" />
            </div>
            <div className="h-4 w-full animate-pulse rounded-full bg-brand-lavenderSoft" />
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            className="grid min-h-[390px] gap-5 rounded-panel border border-brand-lavender bg-white p-5 shadow-card sm:p-6"
            key={index}
          >
            <div className="h-6 w-52 animate-pulse rounded-full bg-brand-lavenderSoft" />
            <div className="grid gap-4">
              <div className="h-14 animate-pulse rounded-lg bg-brand-lavenderSoft" />
              <div className="h-14 animate-pulse rounded-lg bg-brand-lavenderSoft" />
              <div className="h-14 animate-pulse rounded-lg bg-brand-lavenderSoft" />
            </div>
            <div className="h-24 animate-pulse rounded-xl bg-surface-soft" />
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            className="grid min-h-[280px] gap-5 rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6"
            key={index}
          >
            <div className="h-6 w-48 animate-pulse rounded-full bg-brand-lavenderSoft" />
            <div className="h-20 animate-pulse rounded-xl bg-surface-soft" />
            <div className="h-11 w-40 animate-pulse rounded-lg bg-brand-lavenderSoft" />
          </div>
        ))}
      </section>

      <div className="h-[360px] animate-pulse rounded-panel border border-brand-lavender bg-white p-5 shadow-card sm:p-6" />
    </AppPageContainer>
  );
}
