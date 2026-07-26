export default function TherapistAgendaLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando agenda"
      className="mx-auto w-full max-w-[1180px] animate-pulse pb-12"
    >
      <div className="h-11 w-56 rounded-lg bg-brand-lavender" />
      <div className="mt-3 h-5 w-full max-w-md rounded bg-brand-lilac" />
      <div className="mt-8 h-12 rounded-lg bg-brand-lilac" />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_292px]">
        <div className="h-[760px] rounded-[14px] border border-brand-lavender bg-white shadow-card" />
        <div className="grid content-start gap-5">
          <div className="h-72 rounded-[14px] border border-brand-lavender bg-white shadow-card" />
          <div className="h-44 rounded-[14px] border border-brand-lavender bg-white shadow-card" />
        </div>
      </div>
    </main>
  );
}
