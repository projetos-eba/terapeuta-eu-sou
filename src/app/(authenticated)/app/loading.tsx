export default function PatientHomeLoading() {
  return (
    <div
      aria-label="Carregando visão geral"
      className="mx-auto grid max-w-[1174px] gap-3 lg:grid-cols-[minmax(0,1fr)_332px]"
    >
      <div className="space-y-3">
        <div className="h-[278px] animate-pulse rounded-card bg-surface-mist" />
        <div className="h-[147px] animate-pulse rounded-card bg-surface-mist" />
        <div className="h-[390px] animate-pulse rounded-card bg-surface-mist" />
      </div>
      <div className="space-y-3">
        <div className="h-[445px] animate-pulse rounded-card bg-surface-mist" />
        <div className="h-[400px] animate-pulse rounded-card bg-surface-mist" />
      </div>
    </div>
  );
}
