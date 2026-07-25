import { Hammer } from "lucide-react";

export function TherapistConstructionPage({ title }: { title: string }) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-170px)] max-w-[820px] items-center justify-center">
      <div className="w-full rounded-panel border border-[var(--tes-color-border)] bg-white px-6 py-14 text-center shadow-card sm:px-10">
        <span className="mx-auto grid size-14 place-items-center rounded-md bg-brand-lavenderSoft text-brand-primary">
          <Hammer aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-4xl font-light italic text-brand-deep">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-tesText-secondary">
          Esta área está em construção e será conectada aos dados reais da
          plataforma em uma próxima etapa.
        </p>
      </div>
    </section>
  );
}
