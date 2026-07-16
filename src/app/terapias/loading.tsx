import { PublicFooter, PublicHeader } from "@/components/tes";

export default function TherapiesLoading() {
  return (
    <main className="min-h-screen bg-[#fbf8ff]">
      <PublicHeader />
      <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8">
        <div className="h-[260px] animate-pulse rounded-[36px] bg-brand-lavenderSoft" />
        <div className="mt-10 grid gap-7 lg:grid-cols-[285px_1fr]">
          <div className="h-[520px] animate-pulse rounded-[28px] bg-white shadow-card" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-[420px] animate-pulse rounded-[28px] bg-white shadow-card"
              />
            ))}
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
