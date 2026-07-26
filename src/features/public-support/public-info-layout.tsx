import { PublicFooter, PublicHeader } from "@/components/tes";

export function PublicInfoLayout({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-surface-page text-tesText-primary">
      <PublicHeader />
      <main className="mx-auto max-w-[1100px] px-5 pb-16 pt-8 sm:px-8 lg:px-12">
        <section className="mb-8">
          <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-primary">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-5xl font-light italic text-brand-deep">
            {title}
          </h1>
        </section>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
