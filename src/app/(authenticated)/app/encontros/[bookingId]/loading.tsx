import { AppPageContainer } from "@/components/app-page";

export default function PatientEncounterDetailLoading() {
  return (
    <AppPageContainer
      aria-busy="true"
      aria-label="Carregando detalhes do encontro"
      className="max-w-[1146px] gap-5 pb-14 sm:gap-6"
    >
      <div className="h-11 w-72 animate-pulse rounded-md bg-surface-mist" />
      <div className="grid gap-5 rounded-card border border-border bg-white p-5 shadow-card sm:p-7">
        <div className="h-28 animate-pulse rounded-panel bg-surface-mist" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-20 animate-pulse rounded-panel bg-surface-mist" />
          <div className="h-20 animate-pulse rounded-panel bg-surface-mist" />
          <div className="h-20 animate-pulse rounded-panel bg-surface-mist" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_296px]">
        <div className="grid gap-5">
          <div className="h-64 animate-pulse rounded-card bg-surface-mist" />
          <div className="h-52 animate-pulse rounded-card bg-surface-mist" />
          <div className="h-72 animate-pulse rounded-card bg-surface-mist" />
        </div>
        <div className="hidden gap-5 lg:grid">
          <div className="h-44 animate-pulse rounded-card bg-surface-mist" />
          <div className="h-56 animate-pulse rounded-card bg-surface-mist" />
        </div>
      </div>
    </AppPageContainer>
  );
}
