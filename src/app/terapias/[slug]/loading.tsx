import { PublicFooter, PublicHeader } from "@/components/tes";

export default function TherapyDetailLoading() {
  return (
    <main className="min-h-screen bg-[#fbf8ff] text-brand-deep">
      <PublicHeader />
      <section className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-12 pt-8 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-12 lg:pt-12">
        <div>
          <div className="h-11 w-56 animate-pulse rounded-full bg-brand-lavenderSoft" />
          <div className="mt-6 h-24 w-64 animate-pulse rounded-3xl bg-brand-lavenderSoft sm:h-32 sm:w-80" />
          <div className="mt-6 h-20 max-w-lg animate-pulse rounded-3xl bg-brand-lavenderSoft" />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-full bg-brand-lavenderSoft"
              />
            ))}
          </div>
          <div className="mt-9 h-[60px] w-full animate-pulse rounded-[10px] bg-brand-lavenderSoft sm:w-80" />
        </div>
        <div className="min-h-[285px] animate-pulse rounded-[34px] bg-brand-lavenderSoft sm:min-h-[420px] lg:min-h-[520px] lg:rounded-l-[330px] lg:rounded-r-none" />
      </section>
      <section className="mx-auto grid max-w-[1288px] gap-5 px-5 py-5 sm:px-8 lg:grid-cols-[0.55fr_1fr] lg:px-12">
        <div className="h-80 animate-pulse rounded-[14px] bg-white" />
        <div className="h-80 animate-pulse rounded-[14px] bg-white" />
      </section>
      <PublicFooter />
    </main>
  );
}
