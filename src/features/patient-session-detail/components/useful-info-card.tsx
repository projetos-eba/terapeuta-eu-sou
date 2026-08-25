"use client";

import { useEffect, useRef, useState } from "react";

import { TESDialog } from "@/components/tes/tes-dialog";

const usefulLinks = [
  {
    label: "Como funciona o encontro online?",
    answer:
      "A sala segura fica disponível quando o pagamento estiver confirmado e a janela de entrada for liberada. Você pode entrar por esta página, testar seus dispositivos antes do horário e contar com o suporte se algo não funcionar como esperado.",
  },
  {
    label: "O que fazer se tiver problemas técnicos?",
    answer:
      "Teste câmera, microfone e conexão antes do encontro. Se o problema continuar, confira as permissões do navegador e fale com o suporte pelo canal oficial para receber orientação sobre o caso.",
  },
  {
    label: "Como reagendar meu encontro?",
    answer:
      "O reagendamento pode ser solicitado até 24 horas antes do horário e depende da disponibilidade do terapeuta. Imprevistos nas 24 horas anteriores devem ser comunicados ao TES pelo suporte; o pedido será analisado individualmente e não garante reagendamento ou reembolso.",
  },
];

export function UsefulInfoCard({ compact = false }: { compact?: boolean }) {
  const [selectedQuestion, setSelectedQuestion] = useState<
    (typeof usefulLinks)[number] | null
  >(null);
  const selectedQuestionButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (selectedQuestion !== null) return;
    selectedQuestionButtonRef.current?.focus();
  }, [selectedQuestion]);

  return (
    <>
      <section
        className={
          compact
            ? "rounded-[28px] border border-border bg-white/80 p-5 sm:p-6"
            : "grid gap-3 border-t border-border pt-8"
        }
      >
        <h2 className="font-display text-[1.75rem] font-light italic leading-none text-brand-deep">
          Informações úteis
        </h2>
        <div
          aria-label="Informações úteis do encontro"
          className="mt-3 divide-y divide-border"
          role="list"
        >
          {usefulLinks.map((link) => (
            <button
              aria-haspopup="dialog"
              className="flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left text-sm font-semibold leading-6 text-tesText-secondary transition hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              key={link.label}
              onClick={(event) => {
                selectedQuestionButtonRef.current = event.currentTarget;
                setSelectedQuestion(link);
              }}
              type="button"
            >
              <span>{link.label}</span>
              <span
                aria-hidden="true"
                className="text-xl font-extrabold text-brand-primary"
              >
                ›
              </span>
            </button>
          ))}
        </div>
      </section>

      {selectedQuestion ? (
        <TESDialog
          description="Orientação rápida para este encontro."
          onClose={() => setSelectedQuestion(null)}
          title={selectedQuestion.label}
        >
          <p className="text-base font-semibold leading-7 text-tesText-secondary">
            {selectedQuestion.answer}
          </p>
        </TESDialog>
      ) : null}
    </>
  );
}
