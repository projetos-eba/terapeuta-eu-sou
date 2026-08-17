import { AppPageContainer } from "@/components/app-page";

export default function TherapistMetricsLoading() {
  return (
    <AppPageContainer
      aria-busy="true"
      aria-label="Carregando métricas e relatórios"
      className="max-w-[1280px] gap-6 lg:gap-8"
    >
      <div className="min-h-[390px] animate-pulse rounded-panel bg-brand-lavenderSoft lg:min-h-[430px]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="min-h-[220px] animate-pulse rounded-card bg-brand-lavenderSoft"
            key={index}
          />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="min-h-[350px] animate-pulse rounded-card bg-brand-lavenderSoft"
            key={index}
          />
        ))}
      </div>
    </AppPageContainer>
  );
}
