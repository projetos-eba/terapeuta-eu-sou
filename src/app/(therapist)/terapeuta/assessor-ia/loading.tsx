import { AppPageContainer, AppPageSection } from "@/components/app-page";

export default function TherapistAuraLoading() {
  return (
    <AppPageContainer
      aria-busy="true"
      aria-label="Carregando a Assessora Aura"
      className="gap-5"
    >
      <section className="grid min-h-[296px] overflow-hidden rounded-panel border border-brand-lavender bg-brand-lavenderSoft shadow-card sm:min-h-[320px] lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)]">
        <div className="grid content-center gap-4 p-6 sm:p-9 lg:p-11">
          <div className="h-12 w-52 animate-pulse rounded-full bg-white/80" />
          <div className="h-5 max-w-xl animate-pulse rounded-full bg-white/80" />
          <div className="h-5 max-w-lg animate-pulse rounded-full bg-white/80" />
          <div className="mt-3 h-10 w-60 animate-pulse rounded-full bg-white/80" />
        </div>
        <div className="hidden animate-pulse bg-brand-lavender lg:block" />
      </section>

      <AppPageSection className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="min-h-[174px] animate-pulse rounded-card bg-brand-lavenderSoft"
            key={index}
          />
        ))}
      </AppPageSection>

      <section className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <AppPageSection
            className="min-h-[224px] animate-pulse bg-brand-lavenderSoft"
            key={index}
          />
        ))}
      </section>
    </AppPageContainer>
  );
}
