import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, FileText, ShieldCheck } from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";
import { routes } from "@/lib/routes";

import type { AdminOperationDetailPageData } from "../admin-operations.types";
import { AdminOperationCommandPanel } from "./admin-operation-command-panel";
import { AdminProfileReviewPanel } from "./admin-profile-review-panel";
import {
  AsideCard,
  DetailSectionCard,
  IdentityHero,
  ProductBackLink,
  ProductBreadcrumbs,
  ProductHistory,
  fieldMap,
  findSection,
  formatStatusLabel,
} from "./admin-operation-display";

type ProgressState = "attention" | "complete" | "current" | "pending";

export function AdminVerificationDetailPage({
  data,
}: {
  data: AdminOperationDetailPageData;
}) {
  const verification = findSection(data, "Verificação");
  const traceability = findSection(data, "Rastreabilidade");
  const fields = fieldMap(verification?.fields ?? []);
  const status = formatStatusLabel(fields.get("Status"));
  const therapistName = fields.get("Terapeuta") || data.title;
  const publication = fields.get("Elegibilidade pública") ?? "";
  const blockers = fields.get("Bloqueadores reais") ?? "";
  const progress = buildVerificationProgress({
    createdAt: traceability?.fields.find((field) => field.label === "Criado em")
      ?.value,
    publication,
    reviewedAt: fields.get("Revisado em"),
    status: fields.get("Status") ?? "",
    submittedAt: fields.get("Enviado em"),
  });

  return (
    <AppPageContainer className="max-w-[1320px] py-5 lg:py-7">
      <div className="space-y-7 lg:space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ProductBackLink
            href={data.backHref}
            label="Voltar para verificações"
          />
          <ProductBreadcrumbs
            items={[
              { href: routes.admin.professionals, label: "Profissionais" },
              { href: routes.admin.verifications, label: "Verificações" },
              { label: therapistName },
            ]}
          />
        </div>

        <header className="max-w-4xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-brand-primary sm:text-xs">
            Admin · verificação
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
            <h1 className="font-display text-[2.7rem] font-normal italic leading-[0.98] text-brand-deep sm:text-[3.6rem]">
              {therapistName}
            </h1>
            {status ? (
              <InlineStatus label={status} tone={statusTone(status)} />
            ) : null}
          </div>
          <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-tesText-secondary sm:text-lg">
            Analise os dados e documentos enviados, acompanhe a situação e
            registre a próxima decisão administrativa com segurança.
          </p>
        </header>

        <AppPageGrid className="gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <AppPageMain className="space-y-6">
            <IdentityHero
              badges={
                status ? [{ label: status, tone: statusTone(status) }] : []
              }
              details={[
                { label: "Enviado em", value: fields.get("Enviado em") ?? "" },
                {
                  label: "Última revisão",
                  value: fields.get("Revisado em") ?? "",
                },
              ].filter((detail) => detail.value)}
              meta={[
                { label: "Situação da publicação", value: publication },
                {
                  label: "Revisado por",
                  value: fields.get("Revisado por") ?? "",
                },
              ].filter((detail) => detail.value)}
              name={therapistName}
              title="ID profissional"
            />

            <section
              aria-labelledby="verification-progress-title"
              className="rounded-[28px] border border-border bg-white p-5 sm:p-7"
            >
              <h2
                className="text-xl font-extrabold text-brand-deep sm:text-2xl"
                id="verification-progress-title"
              >
                Fluxo do perfil
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
                Acompanhe o percurso entre o envio, a análise, a aprovação e a
                disponibilidade para novos agendamentos.
              </p>
              <ol className="mt-6 grid gap-3 xl:grid-cols-5">
                {progress.map((step) => (
                  <li
                    className="rounded-[24px] border border-border bg-surface-soft p-4"
                    key={step.key}
                  >
                    <div className="flex items-start gap-3">
                      <ProgressBullet state={step.state} />
                      <div>
                        <p className="text-sm font-extrabold text-brand-deep">
                          {step.label}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-tesText-muted sm:text-xs">
                          {progressLabel(step.state)}
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <DetailSectionCard
              description="Sinais que orientam a decisão administrativa nesta análise."
              fields={[
                {
                  label: "Ajuste solicitado",
                  value: fields.get("Ajuste solicitado") ?? "",
                },
                {
                  label: "Reprovação registrada",
                  value: fields.get("Reprovação registrada") ?? "",
                },
                { label: "Situação da publicação", value: publication },
                { label: "Pendências de publicação", value: blockers },
              ].filter((field) => field.value)}
              title="Resumo da verificação"
            />

            <AdminProfileReviewPanel review={data.profileReview} />

            <VerificationDocuments
              professionalId={data.relatedProfessionalId ?? null}
              review={data.privateDocuments ?? null}
            />
            <DetailSectionCard
              description="Registro de criação e atualização desta análise."
              fields={traceability?.fields ?? []}
              title="Rastreabilidade"
            />
          </AppPageMain>

          <AppPageAside className="space-y-5">
            <AsideCard title="Ações rápidas">
              <AdminOperationCommandPanel data={data} />
            </AsideCard>
            {data.relatedProfessionalId ? (
              <AsideCard title="Acesso rápido">
                <Link
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-brand-primary outline-none transition hover:text-brand-deep focus-visible:ring-4 focus-visible:ring-ring/20"
                  href={
                    routes.admin.professionalDetail(
                      data.relatedProfessionalId,
                    ) as Route<string>
                  }
                >
                  Ver cadastro do profissional{" "}
                  <ShieldCheck aria-hidden="true" className="size-4" />
                </Link>
              </AsideCard>
            ) : null}
            <AsideCard title="Histórico administrativo">
              <ProductHistory events={data.auditEvents} />
            </AsideCard>
          </AppPageAside>
        </AppPageGrid>
      </div>
    </AppPageContainer>
  );
}

function VerificationDocuments({
  professionalId,
  review,
}: {
  professionalId: string | null;
  review: AdminOperationDetailPageData["privateDocuments"];
}) {
  if (!review) {
    return (
      <section className="rounded-[28px] border border-border bg-white p-6">
        <h2 className="text-xl font-extrabold text-brand-deep">
          Documentos enviados
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Os documentos não puderam ser carregados agora. A decisão pode ser
          retomada quando a leitura estiver disponível.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-[28px] border border-border bg-white p-5 sm:p-7">
      <h2 className="text-xl font-extrabold text-brand-deep sm:text-2xl">
        {review.summary.title}
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {review.summary.description}
      </p>
      <div className="mt-5 divide-y divide-border overflow-hidden rounded-[22px] border border-border">
        {review.documents.map((document) => (
          <div
            className="flex flex-wrap items-center justify-between gap-4 p-4"
            key={document.kind}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-soft text-brand-primary">
                <FileText aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-brand-deep">
                  {document.title}
                </p>
                <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
                  {document.fileName ?? document.helper}
                </p>
              </div>
            </div>
            {professionalId && document.id ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-brand-lavender px-3 text-sm font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
                href={
                  `/api/admin/profissionais/${professionalId}/documents/${document.id}` as Route<string>
                }
              >
                Visualizar
              </Link>
            ) : (
              <span className="text-sm font-extrabold text-tesText-muted">
                Não enviado
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function buildVerificationProgress({
  createdAt,
  publication,
  reviewedAt,
  status,
  submittedAt,
}: {
  createdAt?: string;
  publication: string;
  reviewedAt?: string;
  status: string;
  submittedAt?: string;
}) {
  const reviewed = ["approved", "changes_requested", "rejected"].includes(
    status,
  );
  const available = publication === "Publicado e elegível";
  return [
    {
      key: "created",
      label: "Cadastro criado",
      detail: createdAt
        ? `Cadastro criado em ${createdAt}.`
        : "Cadastro registrado na plataforma.",
      state: "complete" as const,
    },
    {
      key: "submitted",
      label: "Enviado",
      detail: submittedAt
        ? `Enviado para revisão em ${submittedAt}.`
        : "Aguardando envio para a fila administrativa.",
      state:
        status === "submitted"
          ? ("current" as const)
          : submittedAt || status !== "draft"
            ? ("complete" as const)
            : ("pending" as const),
    },
    {
      key: "review",
      label: "Em análise",
      detail:
        status === "in_review"
          ? "Equipe administrativa analisando o cadastro agora."
          : reviewed
            ? `Análise registrada${reviewedAt ? ` em ${reviewedAt}` : ""}.`
            : "A revisão começa após o envio para a fila.",
      state:
        status === "in_review"
          ? ("current" as const)
          : reviewed
            ? ("complete" as const)
            : ("pending" as const),
    },
    {
      key: "approved",
      label: "Aprovado",
      detail:
        status === "approved"
          ? "Verificação concluída com aprovação."
          : status === "changes_requested"
            ? "Ajustes foram solicitados antes da aprovação."
            : status === "rejected"
              ? "Cadastro não aprovado nesta etapa."
              : "Aprovação ainda não registrada.",
      state:
        status === "approved"
          ? ("complete" as const)
          : ["changes_requested", "rejected"].includes(status)
            ? ("attention" as const)
            : ("pending" as const),
    },
    {
      key: "available",
      label: "Disponível para agendamento",
      detail: available
        ? "Perfil público ativo e recebendo reservas."
        : status === "approved"
          ? "Aprovado; a publicação ainda depende dos critérios indicados acima."
          : "Disponibilidade será verificada após a aprovação.",
      state: available
        ? ("complete" as const)
        : status === "approved"
          ? ("current" as const)
          : ("pending" as const),
    },
  ] as Array<{
    detail: string;
    key: string;
    label: string;
    state: ProgressState;
  }>;
}

function InlineStatus({
  label,
  tone,
}: {
  label: string;
  tone: "danger" | "primary" | "success" | "warning";
}) {
  const palette = {
    danger: "bg-status-dangerBg text-status-danger",
    primary: "bg-brand-lavenderSoft text-brand-primary",
    success: "bg-status-successBg text-status-success",
    warning: "bg-status-warningBg text-status-warning",
  };
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-sm font-extrabold ${palette[tone]}`}
    >
      {label}
    </span>
  );
}

function ProgressBullet({ state }: { state: ProgressState }) {
  const palette = {
    attention: "border-status-warning bg-status-warningBg text-status-warning",
    complete: "border-status-success bg-status-successBg text-status-success",
    current: "border-brand-primary bg-white text-brand-primary",
    pending: "border-border bg-white text-tesText-muted",
  };
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border ${palette[state]}`}
    >
      {state === "complete" ? (
        <CheckCircle2 className="size-4" />
      ) : (
        <span className="size-2 rounded-full bg-current" />
      )}
    </span>
  );
}

function progressLabel(state: ProgressState) {
  return state === "complete"
    ? "Concluído"
    : state === "current"
      ? "Agora"
      : state === "attention"
        ? "Atenção"
        : "Pendente";
}
function statusTone(status: string) {
  return status === "Aprovado"
    ? ("success" as const)
    : status === "Não aprovado"
      ? ("danger" as const)
      : status === "Em análise" || status === "Ajustes solicitados"
        ? ("warning" as const)
        : ("primary" as const);
}
