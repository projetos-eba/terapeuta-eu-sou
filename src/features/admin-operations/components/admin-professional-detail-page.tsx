"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe2,
  History,
  MapPin,
  UserRound,
} from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";
import { routes } from "@/lib/routes";

import type {
  AdminOperationAuditEvent,
  AdminOperationDetailPageData,
  AdminOperationField,
} from "../admin-operations.types";
import { AdminOperationCommandPanel } from "./admin-operation-command-panel";
import { AdminProfileReviewPanel } from "./admin-profile-review-panel";
import {
  buildMonogram,
  fieldMap,
  findSection,
  formatAuditActionLabel,
  formatDateTime,
  formatPlanLabel,
  formatStatusLabel,
  ProductBackLink,
  ProductBreadcrumbs,
} from "./admin-operation-display";

type DetailTab = "overview" | "profile" | "services" | "documents" | "history";

const tabs: Array<{
  icon: typeof UserRound;
  id: DetailTab;
  label: string;
}> = [
  { icon: UserRound, id: "overview", label: "Visão geral" },
  { icon: Globe2, id: "profile", label: "Perfil" },
  { icon: BriefcaseBusiness, id: "services", label: "Serviços e terapias" },
  { icon: FileText, id: "documents", label: "Documentos" },
  { icon: History, id: "history", label: "Histórico" },
];

export function AdminProfessionalDetailPage({
  data,
}: {
  data: AdminOperationDetailPageData;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const identity = fieldMap(
    findSection(data, "Identidade operacional")?.fields ?? [],
  );
  const profile = fieldMap(findSection(data, "Estado do perfil")?.fields ?? []);
  const operation = fieldMap(findSection(data, "Operação")?.fields ?? []);
  const traceability = findSection(data, "Rastreabilidade")?.fields ?? [];

  const name = data.title;
  const status = formatStatusLabel(data.statusLabel);
  const plan = formatPlanLabel(profile.get("Plano"));
  const publicSlug = identity.get("Slug público") ?? "";
  const hasPublishedProfile = Boolean(
    data.publicProfile?.content && publicSlug,
  );
  const publication = describePublication(profile);
  const progressStages = buildProfessionalProgressStages({
    profile,
    traceability,
    verificationSummary: data.verificationSummary ?? null,
  });

  const overviewFields = compactFields([
    { label: "Situação do cadastro", value: status },
    { label: "Publicação", value: publication },
    {
      label: "Recebendo reservas",
      value: profile.get("Recebe reservas") ?? "",
    },
    { label: "Atendimento", value: profile.get("Atendimento online") ?? "" },
    {
      label: "Verificação",
      value: formatStatusLabel(profile.get("Última verificação")),
    },
    {
      label: "Conta de recebimento",
      value: formatStatusLabel(operation.get("Conta de recebimento")),
    },
  ]);
  const activityFields = compactFields([
    { label: "Serviços ativos", value: operation.get("Serviços ativos") ?? "" },
    {
      label: "Serviços cadastrados",
      value: operation.get("Serviços totais") ?? "",
    },
    { label: "Sessões futuras", value: operation.get("Sessões futuras") ?? "" },
    { label: "Próxima sessão", value: operation.get("Próxima sessão") ?? "" },
  ]);
  const blockers = profile.get("Bloqueadores reais") ?? "";

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-7">
      <div className="space-y-7 lg:space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ProductBackLink
            href={data.backHref}
            label="Voltar para profissionais"
          />
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.professionals, label: "Profissionais" },
              { label: name },
            ]}
          />
        </div>

        <header className="max-w-4xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-brand-primary sm:text-xs">
            Admin · profissional
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
            <h1 className="font-display text-[2.7rem] font-normal italic leading-[0.98] text-brand-deep sm:text-[3.6rem]">
              {name}
            </h1>
            {status ? (
              <InlineStatus label={status} tone={statusTone(status)} />
            ) : null}
          </div>
          <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
            Consulte a situação do cadastro, a versão pública do perfil e os
            sinais necessários para a próxima decisão administrativa.
          </p>
        </header>

        <AppPageGrid className="gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <AppPageMain className="space-y-6">
            <section
              aria-labelledby="professional-summary-title"
              className="rounded-[28px] border border-border bg-white p-5 sm:p-7"
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] lg:gap-8">
                <div className="flex min-w-0 gap-4 sm:gap-5">
                  <div className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-xl font-extrabold text-brand-deep sm:size-20 sm:text-2xl">
                    {buildMonogram(name)}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-extrabold text-brand-deep"
                      id="professional-summary-title"
                    >
                      Profissional {plan ? `· ${plan}` : ""}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                      {identity.get("Cidade") || "Localização não informada"}
                      {identity.get("Idiomas")
                        ? ` · ${identity.get("Idiomas")}`
                        : ""}
                    </p>
                    {publication ? (
                      <div className="mt-4">
                        <InlineStatus
                          label={publication}
                          tone={
                            publication.includes("pendente")
                              ? "warning"
                              : "success"
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <dl className="grid content-start gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
                  <SummaryFact
                    icon={MapPin}
                    label="Base de atuação"
                    value={identity.get("Cidade") || "Não informada"}
                  />
                  <SummaryFact
                    icon={CalendarDays}
                    label="Próxima sessão"
                    value={operation.get("Próxima sessão") || "Não agendada"}
                  />
                </dl>
              </div>
            </section>

            {blockers ? (
              <section
                aria-label="Pendências de publicação"
                className="border-l-4 border-status-warning bg-status-warningBg px-5 py-4 sm:px-6"
              >
                <p className="text-sm font-extrabold text-brand-deep">
                  Publicação pendente
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                  {blockers}
                </p>
              </section>
            ) : null}
            <AdminProfileReviewPanel review={data.profileReview} />
          </AppPageMain>

          <AppPageAside>
            <aside className="rounded-[28px] border border-border bg-white p-5 sm:p-6">
              <AdminOperationCommandPanel data={data} />
              <div className="mt-5 border-t border-border pt-4">
                <Link
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-brand-primary outline-none transition hover:text-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
                  href={routes.admin.verifications as Route<string>}
                >
                  Abrir fila de verificações
                  <ExternalLink aria-hidden="true" className="size-4" />
                </Link>
                {hasPublishedProfile ? (
                  <Link
                    className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-brand-primary outline-none transition hover:text-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
                    href={
                      routes.public.therapistProfile(
                        publicSlug,
                      ) as Route<string>
                    }
                    target="_blank"
                  >
                    Ver perfil público
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </Link>
                ) : null}
              </div>
            </aside>
          </AppPageAside>
        </AppPageGrid>

        <section
          aria-labelledby="professional-progress-title"
          className="rounded-[28px] border border-border bg-white p-5 sm:p-7"
        >
          <div className="max-w-3xl">
            <h2
              className="text-xl font-extrabold text-brand-deep sm:text-2xl"
              id="professional-progress-title"
            >
              Fluxo do perfil
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Esta leitura mostra em que ponto o cadastro chegou entre envio,
              análise, publicação e disponibilidade para reservas.
            </p>
          </div>

          <ol className="mt-6 grid gap-3 xl:grid-cols-5">
            {progressStages.map((stage, index) => (
              <li
                className="relative rounded-[24px] border border-border bg-surface-soft px-4 py-4"
                key={stage.key}
              >
                {index < progressStages.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-[calc(100%-1px)] top-7 hidden h-px w-3 bg-border xl:block"
                  />
                ) : null}
                <div className="flex items-start gap-3">
                  <ProgressStageBullet state={stage.state} />
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-brand-deep">
                      {stage.label}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-tesText-muted sm:text-xs">
                      {stage.eyebrow}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                      {stage.detail}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Detalhes do profissional">
          <div
            aria-label="Seções do profissional"
            className="grid grid-cols-2 gap-2 border-b border-border pb-3 md:flex md:items-center"
            role="tablist"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;

              return (
                <button
                  aria-controls={`professional-${tab.id}-panel`}
                  aria-selected={selected}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 md:justify-start ${
                    selected
                      ? "bg-brand-lavenderSoft text-brand-deep"
                      : "text-tesText-secondary hover:bg-surface-soft hover:text-brand-deep"
                  }`}
                  id={`professional-${tab.id}-tab`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            aria-labelledby={`professional-${activeTab}-tab`}
            className="pt-6"
            id={`professional-${activeTab}-panel`}
            role="tabpanel"
            tabIndex={0}
          >
            {activeTab === "overview" ? (
              <OverviewPanel
                activityFields={activityFields}
                fields={overviewFields}
              />
            ) : null}
            {activeTab === "profile" ? (
              <ProfilePanel profile={data.publicProfile} />
            ) : null}
            {activeTab === "services" ? (
              <ServicesPanel
                counts={activityFields}
                profile={data.publicProfile}
              />
            ) : null}
            {activeTab === "documents" ? (
              <DocumentsPanel
                professionalId={data.id}
                review={data.privateDocuments}
              />
            ) : null}
            {activeTab === "history" ? (
              <HistoryPanel events={data.auditEvents} fields={traceability} />
            ) : null}
          </div>
        </section>
      </div>
    </AppPageContainer>
  );
}

function OverviewPanel({
  activityFields,
  fields,
}: {
  activityFields: AdminOperationField[];
  fields: AdminOperationField[];
}) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
      <OpenSection
        description="Aprovação administrativa, publicação pública e disponibilidade para reservas são sinais distintos."
        title="Situação atual"
      >
        <DefinitionList fields={fields} />
      </OpenSection>
      <OpenSection
        description="Dados essenciais para acompanhar a presença atual na plataforma."
        title="Atividade"
      >
        <DefinitionList fields={activityFields} />
      </OpenSection>
    </div>
  );
}

function ProfilePanel({
  profile,
}: {
  profile: AdminOperationDetailPageData["publicProfile"];
}) {
  if (profile?.status === "unavailable") {
    return (
      <ProfileState
        description="Não foi possível carregar a versão pública do perfil agora. A situação operacional continua disponível na visão geral."
        title="Perfil indisponível no momento"
      />
    );
  }

  if (!profile?.content) {
    return (
      <ProfileState
        description="O conteúdo aparece aqui somente depois de publicado e elegível para a superfície pública. Rascunhos e informações privadas não são exibidos nesta tela."
        title="Não há perfil público disponível"
      />
    );
  }

  const { content } = profile;

  return (
    <div className="max-w-5xl space-y-8">
      <OpenSection
        description="Esta é a versão pública que o profissional registrou em Meu perfil."
        title="Perfil publicado"
      >
        {content.shortIntro ? (
          <p className="max-w-3xl font-display text-2xl font-normal italic leading-9 text-brand-deep sm:text-[1.85rem]">
            {content.shortIntro}
          </p>
        ) : null}
        <div className="mt-7 grid gap-8 border-t border-border pt-6 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <h3 className="text-sm font-extrabold text-brand-deep">
              Minha essência
            </h3>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-tesText-secondary">
              {content.essenceBody || "Texto de apresentação não informado."}
            </p>
          </div>
          {content.experienceYears ? (
            <div className="border-l-2 border-brand-primary pl-4">
              <p className="text-2xl font-extrabold text-brand-deep">
                {content.experienceYears} anos
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                de experiência informada
              </p>
            </div>
          ) : null}
        </div>
      </OpenSection>

      {content.guideItems.length > 0 || content.invitationBody ? (
        <div className="grid gap-8 border-t border-border pt-8 lg:grid-cols-2">
          {content.guideItems.length > 0 ? (
            <OpenSection title="Como posso guiar">
              <ul className="divide-y divide-border">
                {content.guideItems.map((item) => (
                  <li
                    className="flex gap-3 py-3 text-sm font-semibold text-tesText-secondary"
                    key={item.label}
                  >
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-brand-primary"
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            </OpenSection>
          ) : null}
          {content.invitationBody ? (
            <OpenSection title="Apresentação">
              <p className="text-sm font-semibold leading-7 text-tesText-secondary">
                {content.invitationBody}
              </p>
            </OpenSection>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ServicesPanel({
  counts,
  profile,
}: {
  counts: AdminOperationField[];
  profile: AdminOperationDetailPageData["publicProfile"];
}) {
  const services = profile?.services;

  return (
    <div className="max-w-5xl space-y-8">
      <OpenSection
        description="Serviços elegíveis que aparecem na superfície pública neste momento."
        title="Serviços e terapias"
      >
        {profile?.status === "unavailable" || services === null ? (
          <p className="text-sm font-semibold leading-7 text-tesText-secondary">
            Não foi possível carregar a lista de serviços publicados agora.
          </p>
        ) : services && services.length > 0 ? (
          <ul className="divide-y divide-border">
            {services.map((service, index) => (
              <li
                className="grid gap-2 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6"
                key={`${service.serviceTitle}-${index}`}
              >
                <div>
                  <p className="text-base font-extrabold text-brand-deep">
                    {service.serviceTitle ||
                      service.therapyName ||
                      "Serviço publicado"}
                  </p>
                  {service.therapyName &&
                  service.therapyName !== service.serviceTitle ? (
                    <p className="mt-1 text-sm font-semibold text-brand-primary">
                      {service.therapyName}
                    </p>
                  ) : null}
                  {service.description ? (
                    <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
                      {service.description}
                    </p>
                  ) : null}
                </div>
                <p className="text-sm font-extrabold text-brand-deep">
                  {formatServiceMeta(service)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-semibold leading-7 text-tesText-secondary">
            Não há serviços elegíveis para publicação neste momento.
          </p>
        )}
      </OpenSection>
      <OpenSection
        description="Indicadores operacionais continuam disponíveis mesmo quando um serviço não está publicado."
        title="Resumo operacional"
      >
        <DefinitionList fields={counts} />
      </OpenSection>
    </div>
  );
}

function DocumentsPanel({
  professionalId,
  review,
}: {
  professionalId: string;
  review: AdminOperationDetailPageData["privateDocuments"];
}) {
  if (!review) {
    return (
      <ProfileState
        description="Não foi possível carregar os documentos privados agora. A situação de verificação continua disponível na visão geral."
        title="Documentos indisponíveis no momento"
      />
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      <OpenSection
        description={review.summary.description}
        title={review.summary.title}
      >
        <ul className="divide-y divide-border border-y border-border">
          {review.documents.map((document) => (
            <li
              className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6"
              key={document.kind}
            >
              <div className="flex min-w-0 gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-soft text-brand-primary">
                  <FileText aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-brand-deep">
                    {document.title}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                    {document.fileName
                      ? `${document.fileName}${document.sizeBytes ? ` · ${formatFileSize(document.sizeBytes)}` : ""}`
                      : document.helper}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold leading-5 text-tesText-muted sm:text-xs">
                    {documentStatusCopy(document.status)}
                  </p>
                  {document.reviewNote ? (
                    <p className="mt-3 border-l-2 border-status-warning pl-3 text-sm font-semibold leading-6 text-tesText-secondary">
                      {document.reviewNote}
                    </p>
                  ) : null}
                </div>
              </div>
              {document.id ? (
                <div className="flex flex-wrap gap-3">
                  <Link
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20"
                    href={`/api/admin/profissionais/${professionalId}/documents/${document.id}`}
                    target="_blank"
                  >
                    Visualizar
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </Link>
                  <Link
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-surface-soft focus-visible:ring-4 focus-visible:ring-ring/20"
                    href={`/api/admin/profissionais/${professionalId}/documents/${document.id}?download=1`}
                    target="_blank"
                  >
                    Baixar
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </Link>
                  <DocumentReviewActions
                    documentId={document.id}
                    professionalId={professionalId}
                    status={document.status}
                  />
                </div>
              ) : (
                <span className="text-sm font-extrabold text-status-warning">
                  Pendente
                </span>
              )}
            </li>
          ))}
        </ul>
      </OpenSection>
      <ProfileState
        description="Os arquivos são privados. O acesso abre uma URL temporária, autorizada para a sessão administrativa atual."
        title="Leitura protegida"
      />
    </div>
  );
}

function DocumentReviewActions({
  documentId,
  professionalId,
  status,
}: {
  documentId: string;
  professionalId: string;
  status: "accepted" | "missing" | "rejected" | "uploaded";
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function submit(decision: "accepted" | "resubmission_requested") {
    if (decision === "resubmission_requested" && reason.trim().length < 3) {
      setMessage(
        "Informe o que precisa ser corrigido antes de solicitar o reenvio.",
      );
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/admin/profissionais/${professionalId}/documents/${documentId}`,
        {
          body: JSON.stringify({ decision, reason: reason.trim() || null }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
        ok?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        setMessage(
          payload?.error?.message ??
            "Não foi possível registrar a decisão agora.",
        );
        return;
      }

      setSuccessMessage(
        decision === "accepted"
          ? "Documento confirmado. A aprovação final do cadastro continua sendo registrada na análise administrativa."
          : "Solicitação de reenvio registrada para o profissional.",
      );
      setShowReason(false);
      setReason("");
      router.refresh();
    } catch {
      setMessage("Não foi possível registrar a decisão agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "missing") return null;

  return (
    <div className="flex basis-full flex-wrap items-center gap-3 border-t border-border pt-3">
      {status !== "accepted" ? (
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-status-successBg px-4 text-sm font-extrabold text-status-success outline-none transition hover:bg-status-successBg/70 focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          onClick={() => void submit("accepted")}
          type="button"
        >
          Aceitar documento
        </button>
      ) : null}
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-status-warning/30 px-4 text-sm font-extrabold text-status-warning outline-none transition hover:bg-status-warningBg focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        onClick={() => setShowReason((value) => !value)}
        type="button"
      >
        Solicitar reenvio
      </button>
      {showReason ? (
        <div className="basis-full">
          <label
            className="text-sm font-extrabold text-brand-deep"
            htmlFor={`document-reason-${documentId}`}
          >
            Orientação para o profissional
          </label>
          <textarea
            className="mt-2 min-h-24 w-full rounded-lg border border-border bg-white p-3 text-sm font-semibold leading-6 text-brand-deep outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            id={`document-reason-${documentId}`}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-extrabold text-white outline-none transition hover:bg-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() => void submit("resubmission_requested")}
              type="button"
            >
              Confirmar solicitação
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center px-2 text-sm font-extrabold text-brand-primary outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
              onClick={() => setShowReason(false)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p
          className="basis-full text-sm font-semibold leading-6 text-status-danger"
          role="alert"
        >
          {message}
        </p>
      ) : null}
      {successMessage ? (
        <p
          aria-live="polite"
          className="basis-full text-sm font-semibold leading-6 text-status-success"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
    </div>
  );
}

function HistoryPanel({
  events,
  fields,
}: {
  events: AdminOperationAuditEvent[];
  fields: AdminOperationField[];
}) {
  return (
    <div className="grid max-w-5xl gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
      <OpenSection
        description="Decisões administrativas registradas para este profissional."
        title="Linha do tempo"
      >
        {events.length > 0 ? (
          <ol className="border-l border-border pl-5">
            {events.map((event) => (
              <li className="relative pb-6 last:pb-0" key={event.id}>
                <span className="absolute -left-[1.7rem] top-1.5 size-3 rounded-full border-2 border-white bg-brand-primary" />
                <p className="text-sm font-extrabold text-brand-deep">
                  {formatAuditActionLabel(event.action)}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-tesText-muted sm:text-xs">
                  {formatDateTime(event.createdAt)}
                </p>
                {event.reason ? (
                  <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                    {event.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm font-semibold leading-7 text-tesText-secondary">
            Ainda não há movimentações administrativas registradas para este
            profissional.
          </p>
        )}
      </OpenSection>
      <OpenSection title="Rastreabilidade">
        <DefinitionList fields={fields} />
      </OpenSection>
    </div>
  );
}

function ProfileState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <section className="max-w-3xl border-l-4 border-brand-primary bg-brand-lavenderSoft px-5 py-5 sm:px-6">
      <h2 className="text-lg font-extrabold text-brand-deep">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-7 text-tesText-secondary">
        {description}
      </p>
    </section>
  );
}

function OpenSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section>
      <h2 className="text-xl font-extrabold text-brand-deep sm:text-2xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
          {description}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DefinitionList({ fields }: { fields: AdminOperationField[] }) {
  if (fields.length === 0) {
    return (
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        Informações indisponíveis no momento.
      </p>
    );
  }

  return (
    <dl className="divide-y divide-border border-y border-border">
      {fields.map((field) => (
        <div
          className="grid gap-1 py-4 sm:grid-cols-[minmax(160px,0.7fr)_minmax(0,1.3fr)] sm:gap-6"
          key={field.label}
        >
          <dt className="text-sm font-bold text-tesText-secondary">
            {field.label}
          </dt>
          <dd className="text-sm font-extrabold leading-6 text-brand-deep">
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SummaryFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-brand-primary"
      />
      <div>
        <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-tesText-muted sm:text-xs">
          {label}
        </dt>
        <dd className="mt-1 text-sm font-extrabold leading-6 text-brand-deep">
          {value}
        </dd>
      </div>
    </div>
  );
}

function InlineStatus({
  label,
  tone,
}: {
  label: string;
  tone: "danger" | "primary" | "success" | "warning";
}) {
  const colors = {
    danger: "bg-status-danger",
    primary: "bg-brand-primary",
    success: "bg-status-success",
    warning: "bg-status-warning",
  };

  return (
    <span className="inline-flex min-h-8 items-center gap-2 text-sm font-extrabold text-brand-deep">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${colors[tone]}`}
      />
      {label}
    </span>
  );
}

function compactFields(fields: AdminOperationField[]) {
  return fields.filter((field) => Boolean(field.value));
}

function describePublication(fields: Map<string, string>) {
  const eligibility = fields.get("Elegibilidade pública");
  const published = fields.get("Publicado");
  const publicStatus = formatStatusLabel(fields.get("Perfil público"));

  if (eligibility) return eligibility;
  if (published && publicStatus) return `${published} · ${publicStatus}`;
  return published || publicStatus || "";
}

function statusTone(status: string) {
  if (status === "Aprovado" || status === "Ativo") return "success" as const;
  if (status === "Suspenso" || status === "Não aprovado")
    return "danger" as const;
  if (status === "Em análise" || status === "Ajustes solicitados") {
    return "warning" as const;
  }
  return "primary" as const;
}

function formatServiceMeta(service: {
  durationMinutes: number | null;
  priceCents: number | null;
}) {
  const duration = service.durationMinutes
    ? `${service.durationMinutes} min`
    : "";
  const price =
    typeof service.priceCents === "number"
      ? new Intl.NumberFormat("pt-BR", {
          currency: "BRL",
          maximumFractionDigits: 0,
          style: "currency",
        }).format(service.priceCents / 100)
      : "";

  return (
    [duration, price].filter(Boolean).join(" · ") ||
    "Informações não disponíveis"
  );
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function documentStatusCopy(
  status: "accepted" | "missing" | "rejected" | "uploaded",
) {
  if (status === "accepted") return "Recebido e aceito para análise.";
  if (status === "rejected") return "Documento com pendência de revisão.";
  if (status === "uploaded") return "Recebido; ainda não representa aprovação.";
  return "Documento obrigatório ainda não recebido.";
}

function buildProfessionalProgressStages({
  profile,
  traceability,
  verificationSummary,
}: {
  profile: Map<string, string>;
  traceability: AdminOperationField[];
  verificationSummary: AdminOperationDetailPageData["verificationSummary"];
}) {
  const traceabilityMap = fieldMap(traceability);
  const verificationStatus = verificationSummary?.status ?? "none";
  const reflectsProfileDecision =
    verificationSummary?.source === "profile_status" &&
    (verificationStatus === "approved" || verificationStatus === "suspended");
  const createdAt = traceabilityMap.get("Criado em");
  const submittedAt = verificationSummary?.submittedAt;
  const reviewedAt = verificationSummary?.reviewedAt;
  const published = profile.get("Publicado") === "Sim";
  const publicStatus = formatStatusLabel(profile.get("Perfil público"));
  const canReceiveBookings = profile.get("Recebe reservas") === "Sim";

  return [
    {
      detail: createdAt
        ? `Cadastro criado em ${createdAt}.`
        : "Cadastro já registrado na plataforma.",
      eyebrow: "Base do cadastro",
      key: "created",
      label: "Cadastro criado",
      state: "complete" as const,
    },
    {
      detail: submittedAt
        ? `Enviado para revisão em ${formatDateTime(submittedAt)}.`
        : reflectsProfileDecision
          ? "A situação atual do cadastro confirma o encaminhamento para análise."
          : verificationStatus === "none" || verificationStatus === "draft"
            ? "Ainda não existe envio confirmado para análise."
            : "Cadastro já encaminhado para a fila administrativa.",
      eyebrow: progressEyebrow(
        reflectsProfileDecision ||
          Boolean(submittedAt) ||
          reachedReviewQueue(verificationStatus),
        verificationStatus === "submitted",
      ),
      key: "submitted",
      label: "Enviado",
      state:
        verificationStatus === "submitted"
          ? ("current" as const)
          : reflectsProfileDecision ||
              Boolean(submittedAt) ||
              reachedReviewQueue(verificationStatus)
            ? ("complete" as const)
            : ("pending" as const),
    },
    {
      detail:
        verificationStatus === "in_review"
          ? "Equipe administrativa analisando perfil e documentos agora."
          : reviewedAt
            ? `Análise registrada em ${formatDateTime(reviewedAt)}.`
            : reflectsProfileDecision
              ? "A situação atual do cadastro confirma que a análise administrativa foi concluída."
              : reachedPostReview(verificationStatus)
                ? "Análise concluída com decisão administrativa."
                : "A revisão começa depois do envio para a fila.",
      eyebrow: progressEyebrow(
        reflectsProfileDecision || reachedPostReview(verificationStatus),
        verificationStatus === "in_review",
      ),
      key: "review",
      label: "Em análise",
      state:
        verificationStatus === "in_review"
          ? ("current" as const)
          : reflectsProfileDecision || reachedPostReview(verificationStatus)
            ? ("complete" as const)
            : ("pending" as const),
    },
    {
      detail:
        verificationStatus === "approved"
          ? reflectsProfileDecision
            ? "A situação atual do cadastro confirma a aprovação administrativa."
            : "Verificação concluída com aprovação."
          : verificationStatus === "changes_requested"
            ? "Ajustes solicitados antes de aprovar a publicação."
            : verificationStatus === "rejected"
              ? "Cadastro reprovado nesta etapa."
              : "Aprovação ainda não registrada.",
      eyebrow:
        verificationStatus === "approved"
          ? "Concluído"
          : verificationStatus === "changes_requested" ||
              verificationStatus === "rejected"
            ? "Atenção"
            : "Pendente",
      key: "approved",
      label: "Aprovado",
      state:
        verificationStatus === "approved"
          ? ("complete" as const)
          : verificationStatus === "changes_requested" ||
              verificationStatus === "rejected"
            ? ("attention" as const)
            : ("pending" as const),
    },
    {
      detail: canReceiveBookings
        ? "Perfil público ativo e recebendo reservas."
        : published
          ? `Publicado (${publicStatus || "ativo"}), mas ainda sem reservas abertas.`
          : publicStatus === "Suspenso"
            ? "Publicação suspensa no momento."
            : "Ainda não publicado ou indisponível para reservas.",
      eyebrow: canReceiveBookings
        ? "Ativo"
        : published
          ? "Publicado"
          : publicStatus === "Suspenso"
            ? "Suspenso"
            : "Pendente",
      key: "available",
      label: "Disponível para agendamento",
      state: canReceiveBookings
        ? ("complete" as const)
        : published
          ? ("current" as const)
          : publicStatus === "Suspenso"
            ? ("attention" as const)
            : ("pending" as const),
    },
  ];
}

function reachedReviewQueue(status: string) {
  return (
    status === "submitted" ||
    status === "in_review" ||
    status === "approved" ||
    status === "changes_requested" ||
    status === "rejected" ||
    status === "suspended"
  );
}

function reachedPostReview(status: string) {
  return (
    status === "approved" ||
    status === "changes_requested" ||
    status === "rejected" ||
    status === "suspended"
  );
}

function progressEyebrow(reached: boolean, current: boolean) {
  if (current) return "Agora";
  return reached ? "Concluído" : "Pendente";
}

function ProgressStageBullet({
  state,
}: {
  state: "attention" | "complete" | "current" | "pending";
}) {
  if (state === "complete") {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-status-successBg text-status-success">
        <CheckCircle2 aria-hidden="true" className="size-4" />
      </span>
    );
  }

  if (state === "current") {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <span
          aria-hidden="true"
          className="size-3 rounded-full bg-brand-primary"
        />
      </span>
    );
  }

  if (state === "attention") {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-status-warningBg text-status-warning">
        <span
          aria-hidden="true"
          className="size-3 rounded-full bg-status-warning"
        />
      </span>
    );
  }

  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-white text-tesText-muted">
      <span aria-hidden="true" className="size-3 rounded-full bg-border" />
    </span>
  );
}
