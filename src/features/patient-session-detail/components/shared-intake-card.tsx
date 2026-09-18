import Image from "next/image";
import { Heart } from "lucide-react";

type IntakeVisibility = "patient_therapist" | "private_patient" | "support";

export function SharedIntakeCard({
  perspective = "patient",
  sharedNote,
  visibility = "patient_therapist",
}: {
  perspective?: "patient" | "therapist";
  sharedNote: string | null;
  visibility?: IntakeVisibility;
}) {
  const note = sharedNote?.trim();
  if (!note) return null;

  const visibilityCopy = getVisibilityCopy({ perspective, visibility });

  return (
    <section className="relative overflow-hidden rounded-card border border-border bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-status-dangerBg text-status-danger">
          <Heart aria-hidden="true" size={20} />
        </span>
        <h2 className="font-display text-[1.85rem] font-light italic leading-none text-brand-deep sm:text-[2.1rem]">
          {perspective === "patient"
            ? "O que você compartilhou ao agendar"
            : "Informações compartilhadas no agendamento"}
        </h2>
      </div>

      <div className="relative z-10 mt-6 max-w-[min(100%,42rem)] rounded-[24px] bg-surface-soft p-5 sm:p-6">
        <p className="text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          {visibilityCopy.intro}
        </p>
        <blockquote className="mt-5 border-l-2 border-brand-lavender pl-4 font-display text-[1.55rem] font-light italic leading-8 text-brand-primary sm:pl-5 sm:text-[1.95rem] sm:leading-9">
          “{note}”
        </blockquote>
        <p className="mt-5 text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
          {visibilityCopy.footnote}
        </p>
      </div>
      <Image
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -right-16 hidden w-60 opacity-70 sm:block"
        height={1254}
        src="/patient/encounters/lotus-detail.png"
        width={1254}
      />
    </section>
  );
}

function getVisibilityCopy(
  input: {
    perspective: "patient" | "therapist";
    visibility: IntakeVisibility;
  },
) {
  if (input.perspective === "therapist") {
    return {
      footnote: "Esse contexto pode apoiar a preparação da sessão.",
      intro:
        "No agendamento, a pessoa compartilhou que gostaria de olhar com cuidado para:",
    };
  }

  const { visibility } = input;
  if (visibility === "private_patient") {
    return {
      footnote:
        "Essas anotações ficam disponíveis para você revisar quando quiser.",
      intro:
        "No agendamento, você registrou esta anotação para retomar seu contexto:",
    };
  }

  if (visibility === "support") {
    return {
      footnote:
        "Se algo mudou desde o agendamento, use o suporte para atualizar o contexto com segurança.",
      intro:
        "Este contexto foi salvo no agendamento para apoiar a condução do seu atendimento:",
    };
  }

  return {
    footnote:
      "Esse contexto ajuda a conduzir o encontro com mais continuidade.",
    intro:
      "No agendamento, você compartilhou que gostaria de olhar com cuidado para:",
  };
}
