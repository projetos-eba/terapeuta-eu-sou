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
      <section className="overflow-hidden rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid gap-6">
            <div>
              <div className="h-12 w-56 animate-pulse rounded-full bg-brand-lavenderSoft sm:h-16" />
              <div className="mt-4 h-5 w-full max-w-md animate-pulse rounded-full bg-brand-lavenderSoft" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="min-h-[184px] animate-pulse rounded-card border border-brand-lavender/70 bg-brand-lavenderSoft/60"
                  key={index}
                />
              ))}
            </div>
          </div>
          <div className="min-h-[180px] animate-pulse rounded-card bg-brand-lavenderSoft lg:min-h-[218px]" />
        </div>
      </section>

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
