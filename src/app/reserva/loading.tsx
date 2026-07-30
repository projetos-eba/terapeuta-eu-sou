export default function ReservationLoading() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#FFFFFF_0%,#FBF8FF_48%,#FFFFFF_100%)] px-5 py-8 text-brand-deep">
      <div className="mx-auto max-w-[1680px] animate-pulse space-y-8">
        <div className="h-14 w-40 rounded-2xl bg-brand-lavenderSoft" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_520px]">
          <section className="space-y-6">
            <div className="h-14 rounded-2xl bg-brand-lavenderSoft" />
            <div className="h-48 rounded-[28px] bg-white shadow-card" />
            <div className="h-72 rounded-[28px] bg-white shadow-card" />
          </section>
          <aside className="h-[520px] rounded-[28px] bg-white shadow-float" />
        </div>
      </div>
    </main>
  );
}
