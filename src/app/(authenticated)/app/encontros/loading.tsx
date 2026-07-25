export default function PatientEncountersLoading() {
  return (
    <main className="space-y-6 pb-10" aria-label="Carregando encontros">
      <div className="h-[270px] animate-pulse rounded-card border border-brand-lavender bg-white shadow-card" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-[190px] animate-pulse rounded-card border border-brand-lavender bg-white shadow-card"
            key={index}
          />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-card border border-brand-lavender bg-white shadow-card" />
    </main>
  );
}
