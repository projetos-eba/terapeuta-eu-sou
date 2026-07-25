"use client";

export default function PlusError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-[920px] rounded-panel border border-[var(--tes-color-border)] bg-white p-8 text-center shadow-card">
      <h1 className="font-display text-4xl font-light italic text-brand-deep">
        Não foi possível abrir esta área
      </h1>
      <p className="mt-4 text-sm leading-6 text-tesText-secondary">
        Nenhum detalhe interno foi exibido. Tente carregar novamente.
      </p>
      <button
        className="mt-6 min-h-11 rounded-sm bg-brand-primary px-5 text-sm font-semibold text-white outline-none hover:bg-brand-primaryHover focus-visible:ring-4 focus-visible:ring-ring/20"
        onClick={reset}
        type="button"
      >
        Tentar novamente
      </button>
    </section>
  );
}
