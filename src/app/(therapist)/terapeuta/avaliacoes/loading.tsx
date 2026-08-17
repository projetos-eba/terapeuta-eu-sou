import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";

export default function TherapistReviewsLoading() {
  return (
    <AppPageContainer className="gap-5">
      <section className="overflow-hidden rounded-card border border-brand-lavender bg-white">
        <div className="grid min-h-[236px] lg:grid-cols-[minmax(0,1fr)_minmax(360px,44%)]">
          <div className="flex items-center px-5 py-8 sm:px-8 lg:px-10">
            <div className="w-full max-w-xl">
              <div className="h-4 w-44 animate-pulse rounded-full bg-brand-lavenderSoft" />
              <div className="mt-4 h-12 w-56 animate-pulse rounded-full bg-brand-lavenderSoft sm:h-16" />
              <div className="mt-5 h-5 w-full animate-pulse rounded-full bg-brand-lavenderSoft" />
              <div className="mt-2 h-5 w-4/5 animate-pulse rounded-full bg-brand-lavenderSoft" />
            </div>
          </div>
          <div className="min-h-[180px] animate-pulse bg-brand-lavenderSoft sm:min-h-[220px]" />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="min-h-[204px] animate-pulse rounded-card border border-brand-lavender/70 bg-brand-lavenderSoft/60"
            key={index}
          />
        ))}
      </div>

      <AppPageGrid>
        <AppPageMain>
          <AppPageSection className="grid gap-5">
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="h-11 w-32 animate-pulse rounded-lg bg-brand-lavenderSoft"
                  key={index}
                />
              ))}
            </div>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                className="h-52 animate-pulse rounded-card border border-brand-lavender/70 bg-brand-lavenderSoft/60"
                key={index}
              />
            ))}
          </AppPageSection>
        </AppPageMain>
        <AppPageAside>
          <AppPageSection className="h-80 animate-pulse bg-brand-lavenderSoft/60" />
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}
