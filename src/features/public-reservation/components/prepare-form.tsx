"use client";

import { useState, type FormEvent } from "react";

import { ReservationLinkButton } from "./checkout-button";

export function PrepareForm({
  canContinueToPayment,
  paymentHref,
}: {
  canContinueToPayment: boolean;
  paymentHref: string;
}) {
  const [accepted, setAccepted] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!accepted) {
      event.preventDefault();
      setError("Aceite os termos para continuar.");
      return;
    }
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
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
              checked={accepted}
              className="mt-1 size-5 rounded border-border text-brand-primary focus:ring-brand-primary"
              name="terms"
              onChange={(event) => {
                setAccepted(event.currentTarget.checked);
                setError(null);
              }}
              type="checkbox"
            />
            <span>
              Aceito os Termos de Uso e a Política de Privacidade do Terapeuta
              Eu Sou. Compreendo que cancelamentos próximos ao horário seguem as
              políticas vigentes da plataforma.
            </span>
          </label>
          <label className="flex items-start gap-4 text-sm font-semibold leading-7 text-tesText-secondary">
            <input
              className="mt-1 size-5 rounded border-border text-brand-primary focus:ring-brand-primary"
              name="marketing"
              type="checkbox"
            />
            <span>
              Desejo receber dicas de bem-estar e novidades da plataforma por
              e-mail. (Opcional)
            </span>
          </label>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-bold text-status-danger">
            {error}
          </p>
        ) : null}
      </section>

      <ReservationLinkButton
        href={paymentHref}
        disabled={!canContinueToPayment || !accepted}
      >
        Avançar para pagamento
      </ReservationLinkButton>
    </form>
  );
}
