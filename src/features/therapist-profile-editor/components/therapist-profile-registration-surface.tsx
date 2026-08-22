"use client";

import { useMemo } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  CircleAlert,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
} from "@/components/app-page";
import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

import type {
  TherapistProfileEditorData,
  TherapistProfileVerificationStatus,
} from "../therapist-profile-editor.types";
import { ProfileSection } from "./profile-section";

export function TherapistProfileRegistrationSurface({
  editor,
}: {
  editor: TherapistProfileEditorData;
}) {
  const verificationStatus =
    editor.verificationSummary?.status ?? editor.derived.verificationStatus;

  const fields = editor.draft?.fields ?? editor.published.fields;
  const profileStepComplete = Boolean(
    fields.publicName.trim() &&
    (fields.shortIntro.trim() || fields.essenceBody.trim()),
  );
  const servicesStepComplete = editor.derived.activeServiceCount > 0;
  const availabilityStepComplete = editor.derived.availabilityRuleCount > 0;
  const documentsByKind = useMemo(
    () => new Map(editor.privateDocuments.map((item) => [item.kind, item])),
    [editor.privateDocuments],
  );
  const documentsStepComplete = ["identity_document", "address_proof"].every(
    (kind) => {
      const document = documentsByKind.get(
        kind as "identity_document" | "address_proof",
      );
      return Boolean(document && document.status !== "rejected");
    },
  );
  const reviewStepState = reviewState(verificationStatus);

  const steps = [
    {
      description: "Preencha como você quer ser apresentado.",
      href: routes.therapist.profileEdit,
      key: "profile",
      label: "Perfil profissional",
      state: profileStepComplete ? "complete" : "pending",
    },
    {
      description: "Adicione pelo menos uma terapia online.",
      href: routes.therapist.services,
      key: "services",
      label: "Terapias ativas",
      state: servicesStepComplete ? "complete" : "pending",
    },
    {
      description: "Informe quando você pode atender.",
      href: routes.therapist.agenda,
      key: "availability",
      label: "Disponibilidade",
      state: availabilityStepComplete ? "complete" : "pending",
    },
    {
      description: "Preencha seus dados e envie os documentos obrigatórios.",
      href: routes.therapist.settings,
      key: "documents",
      label: "Dados e documentos",
      state: documentsStepComplete
        ? verificationStatus === "changes_requested"
          ? "attention"
          : "current"
        : "pending",
    },
    {
      description: reviewDescription(verificationStatus),
      href: routes.therapist.profile,
      key: "review",
      label: "Revisão e envio",
      state: reviewStepState,
    },
  ] as const;

  const completedStepCount = steps.filter(
    (step) => step.state === "complete",
  ).length;
  const progressPercent = Math.round((completedStepCount / steps.length) * 100);
  const pageMode = registrationMode({
    documentsComplete: documentsStepComplete,
    verificationStatus,
  });

  return (
    <AppPageContainer className="gap-5">
      <AppPageHeader title={pageMode.title}>{pageMode.subtitle}</AppPageHeader>

      {pageMode.banner ? (
        <section className="rounded-card border border-status-success/35 bg-status-successBg p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-status-success">
              <Check aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-base font-extrabold leading-6 text-brand-deep">
                {pageMode.banner.title}
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                {pageMode.banner.description}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <AppPageGrid className="gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <AppPageMain className="space-y-6">
          <ProfileSection>
            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-[24px] border border-border bg-surface-soft p-5">
                <p className="text-sm font-extrabold text-brand-deep">
                  Seu progresso de cadastro
                </p>
                <div className="mt-5 flex items-center justify-center">
                  <ProgressRing value={progressPercent} />
                </div>
                <p className="mt-4 text-center text-sm font-semibold leading-6 text-tesText-secondary">
                  {progressSummaryCopy({
                    documentsComplete: documentsStepComplete,
                    verificationStatus,
                  })}
                </p>
              </div>

              <div>
                <p className="text-sm font-extrabold text-brand-deep">
                  Etapas do cadastro
                </p>
                <ul className="mt-4 grid gap-3">
                  {steps.map((step) => (
                    <li
                      className="flex items-start justify-between gap-4 rounded-[22px] border border-border bg-white px-4 py-3"
                      key={step.key}
                    >
                      <div className="flex min-w-0 gap-3">
                        <StepBullet state={step.state} />
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold leading-6 text-brand-deep">
                            {step.label}
                          </p>
                          <p className="text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
                            {step.description}
                          </p>
                        </div>
                      </div>
                      <a
                        className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-extrabold text-brand-primary"
                        href={step.href}
                      >
                        {statusLabel(step.state)}
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ProfileSection>

          <ProfileSection
            description="O preenchimento dos seus dados e o envio dos documentos obrigatórios acontecem em Configurações. Eles são necessários para aprovar e publicar seu perfil."
            title="Dados e documentos"
          >
            <div className="rounded-[22px] border border-brand-lavender bg-surface-soft p-4 sm:p-5">
              <p className="text-sm font-extrabold leading-6 text-brand-deep">
                {documentsStepComplete
                  ? "Seus documentos foram recebidos."
                  : "Ainda falta enviar documentos obrigatórios."}
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                Em Configurações, confirme também seus dados: só o conjunto de
                informações e documentos permite concluir a aprovação do
                cadastro.
              </p>
              <TESButton
                className="mt-4 min-h-11 rounded-lg"
                href={routes.therapist.settings}
                variant="secondary"
              >
                Abrir Configurações
                <ChevronRight aria-hidden="true" className="size-4" />
              </TESButton>
            </div>
          </ProfileSection>

          <ProfileSection title="Resumo do seu perfil">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryDatum
                label="Nome público"
                value={fields.publicName || "Nome ainda não informado"}
              />
              <SummaryDatum
                label="Cidade / Estado"
                value={
                  [fields.city, fields.state].filter(Boolean).join(" / ") ||
                  "Localização ainda não informada"
                }
              />
              <SummaryDatum
                label="Terapias ativas"
                value={`${editor.derived.activeServiceCount} ativa(s)`}
              />
              <SummaryDatum
                label="Disponibilidade"
                value={`${editor.derived.availabilityRuleCount} período(s)`}
              />
            </div>
          </ProfileSection>
        </AppPageMain>

        <AppPageAside className="space-y-6">
          <ProfileSection title={pageMode.asideTitle}>
            <div className="space-y-4">
              {pageMode.checklist.map((item) => (
                <div className="flex items-start gap-3" key={item}>
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-status-successBg text-status-success">
                    <Check aria-hidden="true" className="size-4" />
                  </span>
                  <p className="text-sm font-semibold leading-6 text-tesText-secondary">
                    {item}
                  </p>
                </div>
              ))}
            </div>
            {pageMode.supportCta ? (
              <TESButton
                className="mt-5 min-h-11 w-full rounded-lg"
                href={`${routes.therapist.messages}?context=suporte`}
                variant="secondary"
              >
                Falar com o suporte
              </TESButton>
            ) : null}
          </ProfileSection>

          <ProfileSection title="Como funciona">
            <ol className="grid gap-4">
              {flowItems(pageMode.mode).map((item, index) => (
                <li className="flex items-start gap-3" key={item.title}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-sm font-extrabold text-brand-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-brand-deep">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </ProfileSection>

          <ProfileSection title="Ajuda rápida">
            <div className="rounded-[22px] bg-surface-soft p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-brand-primary">
                  <ShieldCheck aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-brand-deep">
                    Seus documentos são privados
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                    Eles são usados apenas para a análise da equipe TES e não
                    aparecem no seu perfil público.
                  </p>
                </div>
              </div>
            </div>
          </ProfileSection>
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}

function StepBullet({
  state,
}: {
  state: "attention" | "complete" | "current" | "pending";
}) {
  if (state === "complete") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-status-successBg text-status-success">
        <Check aria-hidden="true" className="size-4" />
      </span>
    );
  }

  if (state === "current") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-primary text-white">
        <Loader2 aria-hidden="true" className="size-4" />
      </span>
    );
  }

  if (state === "attention") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-status-warningBg text-status-warning">
        <AlertCircle aria-hidden="true" className="size-4" />
      </span>
    );
  }

  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-soft text-brand-primary">
      <CircleAlert aria-hidden="true" className="size-4" />
    </span>
  );
}

function SummaryDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-surface-soft p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-tesText-secondary sm:text-xs">
        {label}
      </p>
      <p className="mt-2 text-sm font-extrabold text-brand-deep">{value}</p>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative size-[220px]">
      <svg className="size-full -rotate-90" viewBox="0 0 220 220">
        <circle
          className="fill-none stroke-brand-lavenderSoft"
          cx="110"
          cy="110"
          r={radius}
          strokeWidth="12"
        />
        <circle
          className="fill-none stroke-brand-primary transition-[stroke-dashoffset]"
          cx="110"
          cy="110"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="12"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[3rem] font-extrabold leading-none text-brand-deep">
            {value}%
          </p>
          <p className="mt-2 text-sm font-semibold text-tesText-secondary">
            concluído
          </p>
        </div>
      </div>
    </div>
  );
}

function registrationMode({
  documentsComplete,
  verificationStatus,
}: {
  documentsComplete: boolean;
  verificationStatus: TherapistProfileVerificationStatus;
}) {
  if (
    verificationStatus === "submitted" ||
    verificationStatus === "in_review"
  ) {
    return {
      asideTitle: "O que acontece agora",
      banner: {
        description: "Nenhuma ação adicional é necessária neste momento.",
        title: "Cadastro enviado com sucesso",
      },
      checklist: [
        "A equipe TES confere seus dados e os documentos enviados.",
        "Se algum ajuste for necessário, vamos explicar o que precisa ser feito por e-mail e nesta área.",
        "Depois da aprovação, seu perfil poderá ser publicado e receber novas sessões.",
      ],
      mode: "in_review" as const,
      subtitle:
        "Recebemos suas informações e documentos. Nossa equipe está avaliando seu perfil profissional.",
      supportCta: true,
      title: "Cadastro em análise",
    };
  }

  if (verificationStatus === "changes_requested") {
    return {
      asideTitle: "Pendências do cadastro",
      banner: null,
      checklist: [
        "Revise o que precisa ser ajustado no seu perfil público.",
        "Reenvie os documentos solicitados quando necessário.",
        "Depois disso, seu cadastro volta para análise.",
      ],
      mode: "attention" as const,
      subtitle:
        "Seu cadastro precisa de alguns ajustes antes de podermos aprová-lo.",
      supportCta: true,
      title: "Revise seu cadastro",
    };
  }

  return {
    asideTitle: documentsComplete
      ? "Cadastro pronto"
      : "Cadastro ainda incompleto",
    banner: null,
    checklist: documentsComplete
      ? [
          "Perfil, terapias e disponibilidade já foram informados.",
          "Os documentos privados foram recebidos com sucesso.",
          "O cadastro está pronto para ser enviado. Publique seu perfil para iniciar a análise.",
        ]
      : [
          "Complete os dados principais do seu perfil.",
          "Cadastre ao menos uma terapia ativa e sua disponibilidade.",
          "Preencha seus dados e envie os documentos obrigatórios em Configurações.",
        ],
    mode: "pending" as const,
    subtitle:
      "Finalize as informações e envie os documentos obrigatórios em Configurações para iniciarmos a análise.",
    supportCta: true,
    title: "Complete seu cadastro",
  };
}

function progressSummaryCopy({
  documentsComplete,
  verificationStatus,
}: {
  documentsComplete: boolean;
  verificationStatus: TherapistProfileVerificationStatus;
}) {
  if (
    verificationStatus === "submitted" ||
    verificationStatus === "in_review"
  ) {
    return "Seu cadastro já entrou em análise. A equipe TES vai avisar você sobre o próximo passo.";
  }

  if (verificationStatus === "changes_requested") {
    return "Há ajustes pendentes antes de concluir a revisão do cadastro.";
  }

  if (documentsComplete) {
    return "Os documentos foram recebidos. Confirme também seus dados em Configurações para concluirmos a análise.";
  }

  return "Envie os documentos obrigatórios para concluir seu cadastro.";
}

function reviewState(status: TherapistProfileVerificationStatus) {
  if (status === "approved") return "complete" as const;
  if (status === "submitted" || status === "in_review")
    return "current" as const;
  if (status === "changes_requested" || status === "rejected") {
    return "attention" as const;
  }
  return "pending" as const;
}

function reviewDescription(status: TherapistProfileVerificationStatus) {
  if (status === "approved") return "Cadastro aprovado pela equipe TES.";
  if (status === "submitted" || status === "in_review") {
    return "Cadastro recebido e em análise.";
  }
  if (status === "changes_requested") {
    return "A equipe TES pediu alguns ajustes antes da aprovação.";
  }
  if (status === "rejected") {
    return "O cadastro não foi aprovado. Fale com o suporte para entender o próximo passo.";
  }
  return "A análise começa depois que o perfil estiver completo e os dados e documentos forem enviados.";
}

function statusLabel(state: "attention" | "complete" | "current" | "pending") {
  if (state === "complete") return "Concluído";
  if (state === "current") return "Em andamento";
  if (state === "attention") return "Ajustar";
  return "Pendente";
}

function flowItems(mode: "attention" | "in_review" | "pending") {
  if (mode === "in_review") {
    return [
      {
        description:
          "A equipe TES confere se os dados e documentos estão corretos e legíveis.",
        title: "Conferência",
      },
      {
        description:
          "A equipe verifica se seu cadastro está pronto para aprovação.",
        title: "Aprovação do cadastro",
      },
      {
        description:
          "Se algo precisar de correção, você receberá uma orientação clara.",
        title: "Próximo passo",
      },
    ];
  }

  if (mode === "attention") {
    return [
      {
        description:
          "Revise as informações do perfil, das terapias e da disponibilidade.",
        title: "Atualize seus dados",
      },
      {
        description:
          "Substitua os documentos quando a equipe indicar uma correção específica.",
        title: "Reenvie os documentos",
      },
      {
        description: "Depois do novo envio, o cadastro retorna para análise.",
        title: "Volte para análise",
      },
    ];
  }

  return [
    {
      description: "Complete os dados principais do seu perfil público.",
      title: "Perfil profissional",
    },
    {
      description: "Cadastre terapias ativas e defina sua disponibilidade.",
      title: "Operação do perfil",
    },
    {
      description:
        "Preencha seus dados e envie os documentos obrigatórios em Configurações.",
      title: "Dados e documentos",
    },
  ];
}
