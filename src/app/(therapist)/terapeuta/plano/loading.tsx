import { AppPageContainer, AppPageSection } from "@/components/app-page";

export default function TherapistPlanLoading() {
  return (
    <AppPageContainer
      className="max-w-[1280px] gap-6 lg:gap-8"
      aria-busy="true"
    >
      <div className="h-[270px] animate-pulse rounded-panel bg-brand-lavenderSoft lg:h-[320px]" />
      <AppPageSection className="h-[520px] animate-pulse sm:h-[420px]" />
      <AppPageSection className="h-[720px] animate-pulse" />
      <AppPageSection className="h-32 animate-pulse" />
      <span className="sr-only">Carregando planos e assinatura</span>
    </AppPageContainer>
  );
}
