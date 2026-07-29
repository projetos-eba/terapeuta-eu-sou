import { AppPageContainer, AppPageSection } from "@/components/app-page";

export default function TherapistFinanceLoading() {
  return (
    <AppPageContainer className="gap-5">
      <section className="rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-7 lg:p-8">
        <div className="h-12 w-72 animate-pulse rounded-full bg-brand-lavenderSoft" />
        <div className="mt-4 h-5 max-w-xl animate-pulse rounded-full bg-brand-lavenderSoft" />
        <div className="mt-8 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="h-11 w-36 animate-pulse rounded-lg bg-brand-lavenderSoft"
              key={index}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <AppPageSection className="grid gap-4" key={index}>
            <div className="size-12 animate-pulse rounded-full bg-brand-lavenderSoft" />
            <div className="h-5 w-36 animate-pulse rounded-full bg-brand-lavenderSoft" />
            <div className="h-8 w-48 animate-pulse rounded-full bg-brand-lavenderSoft" />
            <div className="h-4 w-full animate-pulse rounded-full bg-brand-lavenderSoft" />
          </AppPageSection>
        ))}
      </section>
    </AppPageContainer>
  );
}
