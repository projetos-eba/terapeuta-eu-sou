"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  CircleAlert,
  FileBadge2,
  FileText,
  Loader2,
  MapPin,
  ShieldCheck,
  Upload,
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

import {
  uploadTherapistPrivateDocument,
  type TherapistPrivateDocumentKind,
} from "../therapist-profile-editor.commands";
import type {
  TherapistPrivateDocumentSummary,
  TherapistProfileEditorData,
  TherapistProfileVerificationStatus,
} from "../therapist-profile-editor.types";
import { ProfileSection } from "./profile-section";

const requiredDocuments: Array<{
  description: string;
  formats: string[];
  helper: string;
  kind: TherapistPrivateDocumentKind;
  title: string;
}> = [
  {
    description: "Envie um documento oficial com foto.",
    formats: ["PDF", "JPG", "PNG"],
    helper: "RG, CNH ou passaporte com foto",
    kind: "identity_document",
    title: "Documento de identidade",
  },
  {
    description: "Envie um comprovante recente.",
    formats: ["PDF", "JPG", "PNG"],
    helper: "Documento emitido nos últimos 90 dias",
    kind: "address_proof",
    title: "Comprovante de endereço",
  },
];

export function TherapistProfileRegistrationSurface({
  editor,
}: {
  editor: TherapistProfileEditorData;
}) {
  const [documents, setDocuments] = useState(editor.privateDocuments);
  const [verificationStatus, setVerificationStatus] = useState(
    editor.verificationSummary?.status ?? editor.derived.verificationStatus,
  );
  const [uploadingKind, setUploadingKind] =
    useState<TherapistPrivateDocumentKind | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const fields = editor.draft?.fields ?? editor.published.fields;
  const profileStepComplete = Boolean(
    fields.publicName.trim() &&
    (fields.shortIntro.trim() || fields.essenceBody.trim()),
  );
  const servicesStepComplete = editor.derived.activeServiceCount > 0;
  const availabilityStepComplete = editor.derived.availabilityRuleCount > 0;
  const documentsByKind = new Map(documents.map((item) => [item.kind, item]));
  const documentsStepComplete = requiredDocuments.every((item) => {
    const document = documentsByKind.get(item.kind);
    return Boolean(document && document.status !== "rejected");
  });
  const reviewStepState = reviewState(verificationStatus);

  const steps = [
    {
      description: "Informações básicas e apresentação.",
      href: routes.therapist.profileEdit,
      key: "profile",
      label: "Perfil profissional",
      state: profileStepComplete ? "complete" : "pending",
    },
    {
      description: "Terapias ativas para reserva online.",
      href: routes.therapist.services,
      key: "services",
      label: "Serviços e terapias",
      state: servicesStepComplete ? "complete" : "pending",
    },
    {
      description: "Horários e dias de atendimento.",
      href: routes.therapist.agenda,
      key: "availability",
      label: "Disponibilidade",
      state: availabilityStepComplete ? "complete" : "pending",
    },
    {
      description: "Documentos obrigatórios do cadastro.",
      href: routes.therapist.profile,
      key: "documents",
      label: "Documentos",
      state: documentsStepComplete
        ? verificationStatus === "changes_requested"
          ? "attention"
          : "complete"
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
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <AppPageHeader title={pageMode.title}>{pageMode.subtitle}</AppPageHeader>

      {errorMessage ? (
        <div
          className="rounded-card border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-bold leading-6 text-status-danger"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

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

          {pageMode.showUploadCards ? (
            <ProfileSection
              description="Anexe os documentos obrigatórios para concluir seu cadastro."
              title="Pendências para análise"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                {requiredDocuments.map((documentConfig) => (
                  <DocumentUploadCard
                    currentDocument={documentsByKind.get(documentConfig.kind)}
                    key={documentConfig.kind}
                    onUpload={async (file) => {
                      setUploadingKind(documentConfig.kind);
                      setErrorMessage(null);

                      const result = await uploadTherapistPrivateDocument({
                        file,
                        kind: documentConfig.kind,
                      });

                      setUploadingKind(null);

                      if (result.status === "error") {
                        setErrorMessage(result.error.message);
                        setLiveMessage(result.error.message);
                        return;
                      }

                      setDocuments(result.data.documents);
                      setVerificationStatus(result.data.verificationStatus);
                      setLiveMessage(
                        `${documentConfig.title} enviado com sucesso.`,
                      );
                    }}
                    uploading={uploadingKind === documentConfig.kind}
                    {...documentConfig}
                  />
                ))}
              </div>
            </ProfileSection>
          ) : (
            <ProfileSection
              description="Os documentos enviados ficam disponíveis apenas para análise administrativa."
              title="Documentos enviados"
            >
              <ul className="grid gap-4">
                {requiredDocuments.map((documentConfig) => {
                  const document = documentsByKind.get(documentConfig.kind);

                  return (
                    <li
                      className="flex items-start justify-between gap-4 rounded-[22px] border border-border bg-white px-4 py-4"
                      key={documentConfig.kind}
                    >
                      <div className="flex min-w-0 gap-3">
                        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-lavenderSoft text-brand-primary">
                          <FileText aria-hidden="true" className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-brand-deep">
                            {documentConfig.title}
                          </p>
                          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                            {document
                              ? `${document.fileName} · ${formatFileSize(document.fileSizeBytes)}`
                              : "Documento ainda não recebido."}
                          </p>
                          {document?.createdAt ? (
                            <p className="mt-1 text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
                              Enviado em {formatDateTime(document.createdAt)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <StatusPill
                        tone={document ? "success" : "warning"}
                        value={document ? "Enviado" : "Pendente"}
                      />
                    </li>
                  );
                })}
              </ul>
            </ProfileSection>
          )}

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
                value={`${editor.derived.availabilityRuleCount} regra(s)`}
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
                    Eles são usados apenas para validação administrativa e não
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

function DocumentUploadCard({
  currentDocument,
  description,
  formats,
  helper,
  kind,
  onUpload,
  title,
  uploading,
}: {
  currentDocument?: TherapistPrivateDocumentSummary;
  description: string;
  formats: string[];
  helper: string;
  kind: TherapistPrivateDocumentKind;
  onUpload: (file: File) => Promise<void>;
  title: string;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-[24px] border border-border bg-white p-5">
      <input
        accept=".pdf,image/jpeg,image/png"
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void onUpload(file);
        }}
        ref={inputRef}
        type="file"
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-extrabold text-brand-deep">{title}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {description}
          </p>
        </div>
        <StatusPill
          tone={
            currentDocument?.status === "rejected"
              ? "danger"
              : currentDocument
                ? "success"
                : "warning"
          }
          value={
            currentDocument?.status === "rejected"
              ? "Reenvio solicitado"
              : currentDocument
                ? "Enviado"
                : "Pendente"
          }
        />
      </div>

      <div className="mt-4 rounded-[20px] border border-dashed border-brand-lavender bg-surface-soft p-4">
        <p className="text-sm font-extrabold text-brand-deep">
          {currentDocument ? currentDocument.fileName : helper}
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          {currentDocument
            ? `${formatFileSize(currentDocument.fileSizeBytes)} · ${formatValidationState(currentDocument.validationState)}`
            : helper}
        </p>
        {currentDocument?.reviewNote ? (
          <p className="mt-3 border-l-2 border-status-warning pl-3 text-sm font-semibold leading-6 text-tesText-secondary">
            {currentDocument.reviewNote}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {formats.map((format) => (
            <span
              className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand-primary sm:text-xs"
              key={format}
            >
              {format}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <TESButton
          className="min-h-11 rounded-lg"
          onClick={() => inputRef.current?.click()}
          type="button"
          variant={currentDocument ? "secondary" : "primary"}
        >
          {uploading ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Upload aria-hidden="true" className="size-4" />
          )}
          {uploading
            ? "Enviando..."
            : currentDocument
              ? "Substituir arquivo"
              : "Anexar documento"}
        </TESButton>
        {kind === "identity_document" ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-tesText-secondary">
            <FileBadge2 aria-hidden="true" className="size-4" />
            RG, CNH ou passaporte com foto
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-tesText-secondary">
            <MapPin aria-hidden="true" className="size-4" />
            Emitido nos últimos 90 dias
          </p>
        )}
      </div>
    </div>
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

function StatusPill({
  tone,
  value,
}: {
  tone: "danger" | "success" | "warning";
  value: string;
}) {
  const classes =
    tone === "success"
      ? "bg-status-successBg text-status-success"
      : tone === "danger"
        ? "bg-status-dangerBg text-status-danger"
        : "bg-status-warningBg text-status-warning";

  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-[11px] font-extrabold uppercase tracking-[0.08em] sm:text-xs ${classes}`}
    >
      {value}
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
        "Sua equipe administrativa confere a autenticidade dos documentos enviados.",
        "Se houver algum ajuste, você receberá a orientação por e-mail e por esta área.",
        "Após a aprovação, seu perfil segue disponível para reservas conforme os critérios já atendidos.",
      ],
      mode: "in_review" as const,
      showUploadCards: false,
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
        "Depois disso, seu cadastro volta para análise administrativa.",
      ],
      mode: "attention" as const,
      showUploadCards: true,
      subtitle:
        "Seu cadastro precisa de ajustes antes de seguir para a próxima revisão.",
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
          "Se seu perfil ainda não apareceu em análise, revise a publicação e aguarde a sincronização da fila.",
        ]
      : [
          "Complete os dados principais do seu perfil.",
          "Cadastre ao menos uma terapia ativa e sua disponibilidade.",
          "Anexe os documentos obrigatórios para concluir a revisão.",
        ],
    mode: "pending" as const,
    showUploadCards: true,
    subtitle:
      "Finalize as informações e envie os documentos obrigatórios para que possamos analisar seu perfil.",
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
    return "Seu cadastro já entrou em análise. Agora acompanhamos a revisão administrativa.";
  }

  if (verificationStatus === "changes_requested") {
    return "Há ajustes pendentes antes de concluir a revisão do cadastro.";
  }

  if (documentsComplete) {
    return "Os documentos obrigatórios já foram recebidos nesta etapa.";
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
  if (status === "approved") return "Cadastro aprovado e liberado.";
  if (status === "submitted" || status === "in_review") {
    return "Cadastro enviado e em análise administrativa.";
  }
  if (status === "changes_requested") {
    return "A equipe solicitou correções antes da aprovação.";
  }
  if (status === "rejected") {
    return "O cadastro foi encerrado e precisa de nova orientação.";
  }
  return "A etapa de análise começa depois da publicação e dos documentos.";
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
          "A equipe verifica a autenticidade e a legibilidade dos documentos enviados.",
        title: "Conferência dos documentos",
      },
      {
        description:
          "O cadastro é comparado com os critérios atuais da plataforma.",
        title: "Validação do cadastro",
      },
      {
        description:
          "Se algo precisar de correção, você receberá a orientação exata do que ajustar.",
        title: "Aprovação ou ajustes",
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
        description:
          "Após a nova publicação, o cadastro retorna para a análise administrativa.",
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
      description: "Cadastre serviços ativos e defina sua disponibilidade.",
      title: "Operação do perfil",
    },
    {
      description:
        "Anexe os documentos privados exigidos para a validação administrativa.",
      title: "Documentos obrigatórios",
    },
  ];
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatValidationState(
  value: TherapistPrivateDocumentSummary["validationState"],
) {
  if (value === "passed") return "validado";
  if (value === "pending") return "em conferência";
  if (value === "failed") return "precisa de revisão";
  return "recebido";
}
