import { AppPageContainer, AppPageSection } from "@/components/app-page";

export default function TherapistPlanLoading() {
  return (
    <AppPageContainer className="max-w-[1240px] gap-6" aria-busy="true">
      <div className="h-28 animate-pulse rounded-card bg-brand-lavenderSoft" />
      <div className="h-24 animate-pulse rounded-card bg-brand-lavenderSoft" />
      <div className="grid gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <AppPageSection className="h-[510px] animate-pulse" key={item} />
        ))}
      </div>
      <AppPageSection className="h-80 animate-pulse" />
      <span className="sr-only">Carregando planos e assinatura</span>
    </AppPageContainer>
  );
}
