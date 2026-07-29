import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";

export default function TherapistMetricsLoading() {
  return (
    <AppPageContainer
      aria-busy="true"
      aria-label="Carregando métricas e relatórios"
    >
      <div className="min-h-[330px] animate-pulse rounded-card bg-brand-lavenderSoft" />
      <div className="min-h-24 animate-pulse rounded-card bg-brand-lavenderSoft" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="min-h-[228px] animate-pulse rounded-card bg-brand-lavenderSoft"
            key={index}
          />
        ))}
      </div>
      <AppPageGrid>
        <AppPageMain>
          <div className="min-h-[350px] animate-pulse rounded-card bg-brand-lavenderSoft" />
          <div className="min-h-[300px] animate-pulse rounded-card bg-brand-lavenderSoft" />
        </AppPageMain>
        <AppPageAside>
          {Array.from({ length: 3 }, (_, index) => (
            <div
              className="min-h-48 animate-pulse rounded-card bg-brand-lavenderSoft"
              key={index}
            />
          ))}
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}
