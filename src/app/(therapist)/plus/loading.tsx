export default function PlusLoading() {
  return (
    <div
      aria-label="Carregando painel"
      className="mx-auto max-w-[1360px] space-y-6"
    >
      <div className="h-[302px] animate-pulse rounded-panel bg-brand-lavenderSoft" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_306px]">
        <div className="h-[313px] animate-pulse rounded-panel bg-surface-mist" />
        <div className="h-[313px] animate-pulse rounded-panel bg-surface-mist" />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-[278px] animate-pulse rounded-panel bg-surface-mist"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}
