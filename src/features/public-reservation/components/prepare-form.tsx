"use client";

import Link from "next/link";

export function PrepareForm({
  acceptedTerms,
  canContinueToPayment,
  marketingConsent,
  onAdvanceToPayment,
  onMarketingConsentChange,
  onTermsChange,
}: {
  acceptedTerms: boolean;
  canContinueToPayment: boolean;
  marketingConsent: boolean;
  onAdvanceToPayment: () => void;
  onMarketingConsentChange: (accepted: boolean) => void;
  onTermsChange: (accepted: boolean) => void;
}) {
  const canAdvance = canContinueToPayment && acceptedTerms;

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (canAdvance) onAdvanceToPayment();
      }}
    >
      <div>
        <label
          htmlFor="session-intention"
          className="mb-3 block text-sm font-extrabold text-brand-deep"
        >
          O que você gostaria de compartilhar?
        </label>
        <textarea
          id="session-intention"
          name="intention"
          className="min-h-[188px] w-full resize-y rounded-[18px] border border-border bg-white px-5 py-4 text-base font-semibold leading-7 text-brand-deep shadow-card outline-none transition placeholder:text-tesText-muted focus:ring-4 focus:ring-ring/20"
          maxLength={600}
          placeholder="Ex.: quero chegar com mais calma, falar sobre meu momento atual... (opcional)"
        />
        <p className="mt-2 text-sm font-semibold text-tesText-muted">
          Esse texto não substitui atendimento de saúde e será usado apenas para
          preparar melhor o encontro.
        </p>
      </div>

      <section className="rounded-[24px] border-2 border-brand-primary bg-white p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-4">
          <span className="text-3xl" aria-hidden="true">
            ☕
          </span>
          <h2 className="text-2xl font-extrabold text-brand-deep sm:text-3xl">
            Preparando para o encontro
          </h2>
        </div>
        <ul className="mt-6 grid gap-4 text-sm font-bold text-tesText-secondary sm:grid-cols-2">
          {[
            "Escolha um lugar tranquilo e confortável",
            "Use fone de ouvido, se possível",
            "Tenha água por perto",
            "Esteja presente para você",
          ].map((item) => (
            <li className="flex items-center gap-3" key={item}>
              <span className="grid size-6 place-items-center rounded-full border-2 border-brand-primary text-brand-primary">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-extrabold text-brand-deep">
          Termos e condições
        </h2>
        <div className="mt-5 space-y-5">
          <label className="flex items-start gap-4 text-sm font-semibold leading-7 text-tesText-secondary">
            <input
              aria-describedby="reservation-terms-description"
              checked={acceptedTerms}
              className="mt-1 size-5 rounded border-border text-brand-primary focus:ring-brand-primary"
              name="terms"
              onChange={(event) => onTermsChange(event.currentTarget.checked)}
              type="checkbox"
            />
            <span id="reservation-terms-description">
              Aceito os{" "}
              <Link
                className="font-extrabold text-brand-primary underline-offset-4 hover:underline"
                href="/termos"
                target="_blank"
              >
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link
                className="font-extrabold text-brand-primary underline-offset-4 hover:underline"
                href="/privacidade"
                target="_blank"
              >
                Política de Privacidade
              </Link>{" "}
              do Terapeuta Eu Sou. Compreendo que cancelamentos próximos ao
              horário seguem as políticas vigentes da plataforma.
            </span>
          </label>
          <label className="flex items-start gap-4 text-sm font-semibold leading-7 text-tesText-secondary">
            <input
              checked={marketingConsent}
              className="mt-1 size-5 rounded border-border text-brand-primary focus:ring-brand-primary"
              name="marketing"
              onChange={(event) =>
                onMarketingConsentChange(event.currentTarget.checked)
              }
              type="checkbox"
            />
            <span>
              Desejo receber dicas de bem-estar e novidades da plataforma por
              e-mail. (Opcional)
            </span>
          </label>
        </div>
        {!acceptedTerms ? (
          <p
            role="alert"
            className="mt-3 text-sm font-bold text-status-danger"
          >
            Aceite os termos para continuar para o pagamento.
          </p>
        ) : null}
      </section>

      <button
        className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-brand-primary px-7 py-3 text-base font-extrabold text-white shadow-soft transition hover:bg-brand-primaryHover focus:outline-none focus:ring-4 focus:ring-ring/20 disabled:pointer-events-none disabled:opacity-50"
        disabled={!canAdvance}
        type="submit"
      >
        Avançar para pagamento
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
