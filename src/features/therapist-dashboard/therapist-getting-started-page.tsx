import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileText,
  Send,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { AppPageContainer } from "@/components/app-page";
import { TESButton } from "@/components/tes";
import { getTherapistPlanDefinition } from "@/domain/tes";
import type { AuthenticatedTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

import { therapistStatusLabel } from "./therapist-home-readiness.mappers";
import type {
  TherapistHomeChecklistItem,
  TherapistHomeDocument,
  TherapistHomeReadiness,
} from "./therapist-home-readiness.types";

const checklistIcons: Record<TherapistHomeChecklistItem["id"], LucideIcon> = {
  agenda: CalendarDays,
  connect: CircleHelp,
  profile: UserRound,
  services: Sparkles,
};

export function TherapistGettingStartedPage({
  attentionMessage,
  readiness,
  session,
}: {
  attentionMessage?: string;
  session: Pick<AuthenticatedTherapistSession, "name" | "plan" | "status">;
  readiness: TherapistHomeReadiness;
}) {
  const plan = getTherapistPlanDefinition(session.plan);
  const requiredChecklist = readiness.checklist.filter((item) => item.required);
  const onboardingSteps = [...requiredChecklist, ...readiness.documents];
  const completedSteps = onboardingSteps.filter((item) => item.complete).length;
  const progressPercent = Math.round(
    onboardingSteps.length > 0
      ? (completedSteps / onboardingSteps.length) * 100
      : 100,
  );
  const pendingChecklist = requiredChecklist.filter((item) => !item.complete);
  const pendingDocuments = readiness.documents.filter((item) => !item.complete);
  const pendingItems = [
    ...pendingChecklist,
    ...pendingDocuments.map((document) => ({
      ...document,
      actionLabel:
        document.state === "attention"
          ? "Enviar novamente"
          : "Enviar documento",
      href: routes.therapist.settings,
    })),
  ];
  const pendingSection = pendingSectionContent({
    pendingItems,
    verificationStatus: readiness.verificationStatus,
  });
  const primaryAction =
    pendingChecklist[0] ??
    (pendingDocuments[0]
      ? {
          actionLabel: "Abrir Configurações",
          href: routes.therapist.settings,
        }
      : {
          actionLabel: "Ver cadastro",
          href: routes.therapist.profile,
        });

  return (
    <AppPageContainer className="max-w-[1210px] gap-7 pb-12 pt-1 lg:gap-8">
      {attentionMessage ? (
        <div
          className="rounded-2xl border border-status-warning/30 bg-status-warningBg px-4 py-3 text-sm font-bold leading-6 text-brand-deep"
          role="status"
        >
          {attentionMessage}
        </div>
      ) : null}
      <header className="max-w-3xl pt-2 sm:pt-5">
        <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-brand-primary">
          {plan.name} · Cadastro profissional
        </p>
        <h1 className="mt-3 font-display text-[42px] font-light italic leading-[0.96] text-brand-deep sm:text-[56px]">
          Complete seu cadastro
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
          Organize as informações, envie os documentos obrigatórios e acompanhe
          cada etapa antes de encaminhar seu perfil para análise.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_292px] xl:items-start">
        <div className="grid gap-6">
          <section className="rounded-[28px] border border-brand-lavender/70 bg-white p-5 shadow-card sm:p-7">
            <div className="grid gap-7 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
              <div className="border-b border-border pb-7 text-center lg:border-b-0 lg:border-r lg:pb-0 lg:pr-7">
                <p className="text-sm font-extrabold text-brand-deep">
                  Seu progresso de cadastro
                </p>
                <ProgressRing value={progressPercent} />
                <p className="mx-auto mt-4 max-w-[220px] text-sm font-semibold leading-6 text-tesText-secondary">
                  {progressSummary({
                    pendingDocuments,
                    pendingSteps: pendingChecklist,
                  })}
                </p>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-brand-deep">
                      Etapas do cadastro
                    </h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                      Conclua os itens abaixo para avançar com clareza.
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-lavenderSoft px-3 py-1.5 text-xs font-extrabold text-brand-primary">
                    {completedSteps} de {onboardingSteps.length} concluídas
                  </span>
                </div>

                <ul className="mt-5 divide-y divide-border">
                  {requiredChecklist.map((item) => (
                    <ChecklistRow item={item} key={item.id} />
                  ))}
                  {readiness.documents.map((item) => (
                    <DocumentStepRow item={item} key={item.id} />
                  ))}
                  <ReviewStep status={readiness.verificationStatus} />
                </ul>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
              <TESButton
                className="min-h-11 rounded-lg sm:min-w-[210px]"
                href={primaryAction.href}
              >
                Continuar cadastro
                <ArrowRight aria-hidden="true" className="size-4" />
              </TESButton>
              <a
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                href="#pendencias"
              >
                Ver pendências
              </a>
            </div>
          </section>

          <section
            className="rounded-[28px] border border-brand-lavender/70 bg-white p-5 shadow-card sm:p-7"
            id="pendencias"
          >
            <SectionHeading
              description={pendingSection.description}
              title={pendingSection.title}
            />
            {pendingItems.length > 0 ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {pendingItems.map((item) => (
                  <PendingItemCard item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 rounded-[20px] bg-status-successBg p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-status-success"
                />
                <p>
                  Seus itens obrigatórios foram concluídos. Acompanhe a
                  situação do cadastro ao lado.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-brand-lavender/70 bg-white p-5 shadow-card sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeading
                description="Uma prévia das informações que serão usadas na sua apresentação."
                title="Resumo do seu perfil"
              />
              <TESButton
                className="min-h-11 shrink-0 rounded-lg"
                href={routes.therapist.profileEdit}
                variant="secondary"
              >
                Editar perfil
              </TESButton>
            </div>
            <ProfileSummary readiness={readiness} />
          </section>
        </div>

        <aside className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <section className="rounded-[28px] border border-brand-lavender/70 bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
                <Clock3 aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold leading-6 text-brand-deep">
                  {verificationTitle(readiness.verificationStatus)}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                  {verificationDescription(readiness.verificationStatus)}
                </p>
              </div>
            </div>

            {pendingItems.length > 0 ? (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-muted">
                  Falta concluir
                </p>
                <ul className="mt-3 grid gap-2">
                  {pendingItems.map((item) => (
                    <li
                      className="flex items-center gap-2 text-sm font-semibold text-tesText-secondary"
                      key={item.id}
                    >
                      <span className="size-1.5 rounded-full bg-status-warning" />
                      {item.title}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-brand-lavender/70 bg-white p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-extrabold text-brand-deep">
              Como funciona
            </h2>
            <ol className="mt-5 grid gap-5">
              {[
                [
                  "Complete seu perfil",
                  "Inclua sua apresentação, terapias e horários.",
                ],
                [
                  "Envie os documentos",
                  "Anexe os documentos obrigatórios com segurança.",
                ],
                [
                  "Acompanhe a análise",
                  "Nossa equipe revisa o cadastro e informa os próximos passos.",
                ],
              ].map(([title, description], index) => (
                <li className="flex gap-3" key={title}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-sm font-extrabold text-brand-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-brand-deep">
                      {title}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-[28px] border border-brand-lavender/70 bg-brand-lavenderSoft/60 p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-brand-deep">
              Precisa de ajuda?
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              Se surgir uma dúvida sobre seu cadastro, nossa equipe pode
              orientar você.
            </p>
            <TESButton
              className="mt-5 min-h-11 w-full rounded-lg"
              href={`${routes.therapist.messages}?context=suporte`}
              variant="secondary"
            >
              Falar com o suporte
            </TESButton>
          </section>
        </aside>
      </div>
    </AppPageContainer>
  );
}

function ProgressRing({ value }: { value: number }) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div
      aria-label={`${safeValue}% do cadastro concluído`}
      className="mx-auto mt-5 grid size-44 place-items-center rounded-full p-2"
      role="img"
      style={{
        background: `conic-gradient(var(--tes-color-brand-primary) ${safeValue}%, var(--tes-color-brand-lavender-soft) ${safeValue}% 100%)`,
      }}
    >
      <div className="grid size-full place-items-center rounded-full bg-white">
        <div>
          <p className="text-4xl font-extrabold leading-none text-brand-deep">
            {safeValue}%
          </p>
          <p className="mt-1 text-xs font-bold text-tesText-secondary">
            concluído
          </p>
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({ item }: { item: TherapistHomeChecklistItem }) {
  const Icon = checklistIcons[item.id];

  return (
    <li className="first:pt-0">
      <Link
        aria-label={`${item.actionLabel}: ${item.title}`}
        className="group flex min-h-16 w-full items-start gap-3 rounded-xl py-3 transition hover:bg-brand-lavenderSoft/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={item.href}
      >
        <StepState state={item.state} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-brand-deep">
            {item.title}
          </span>
          <span className="mt-1 block text-sm font-semibold leading-5 text-tesText-secondary">
            {item.description}
          </span>
        </span>
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-brand-primary transition group-hover:bg-white">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </Link>
    </li>
  );
}

function DocumentStepRow({ item }: { item: TherapistHomeDocument }) {
  return (
    <li>
      <Link
        aria-label={`Abrir Configurações para enviar ${item.title}`}
        className="group flex min-h-16 w-full items-start gap-3 rounded-xl py-3 transition hover:bg-brand-lavenderSoft/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.therapist.settings}
      >
        <StepState state={item.state} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-brand-deep">
            {item.title}
          </span>
          <span className="mt-1 block text-sm font-semibold leading-5 text-tesText-secondary">
            {item.description}
          </span>
        </span>
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-brand-primary transition group-hover:bg-white">
          <FileText aria-hidden="true" className="size-4" />
        </span>
      </Link>
    </li>
  );
}

function ReviewStep({ status }: { status: string }) {
  const complete =
    status === "approved" || status === "submitted" || status === "in_review";
  const attention = status === "changes_requested" || status === "rejected";

  return (
    <li className="pb-0">
      <Link
        aria-label="Abrir cadastro para revisão"
        className="group flex min-h-16 w-full items-start gap-3 rounded-xl py-3 transition hover:bg-brand-lavenderSoft/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={routes.therapist.profile}
      >
        <StepState
          state={complete ? "complete" : attention ? "attention" : "pending"}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-brand-deep">
            Revisar e enviar
          </span>
          <span className="mt-1 block text-sm font-semibold leading-5 text-tesText-secondary">
            {complete
              ? "Cadastro encaminhado para análise."
              : "Revise os dados e envie seu cadastro quando estiver pronto."}
          </span>
        </span>
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-brand-primary transition group-hover:bg-white">
          <Send aria-hidden="true" className="size-4" />
        </span>
      </Link>
    </li>
  );
}

type PendingOnboardingItem = {
  actionLabel: string;
  description: string;
  href: string;
  id: TherapistHomeChecklistItem["id"] | TherapistHomeDocument["id"];
  state: TherapistHomeChecklistItem["state"] | TherapistHomeDocument["state"];
  title: string;
};

function PendingItemCard({ item }: { item: PendingOnboardingItem }) {
  const needsAttention = item.state === "attention";
  const isDocument =
    item.id === "identity_document" || item.id === "address_proof";
  const Icon = isDocument
    ? FileText
    : checklistIcons[item.id as TherapistHomeChecklistItem["id"]];
  const description =
    needsAttention && isDocument
      ? "Este documento precisa ser enviado novamente."
      : item.description;

  return (
    <article className="flex flex-col justify-between gap-5 rounded-[22px] border border-status-warning/30 bg-status-warningBg/40 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-status-warning">
          {needsAttention ? (
            <AlertCircle aria-hidden="true" className="size-5" />
          ) : (
            <Icon aria-hidden="true" className="size-5" />
          )}
        </span>
        <div>
          <h3 className="text-base font-extrabold text-brand-deep">
            {item.title}
          </h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {description}
          </p>
        </div>
      </div>
      <TESButton
        className="min-h-11 self-start rounded-lg"
        href={item.href}
        variant="secondary"
      >
        {item.actionLabel}
      </TESButton>
    </article>
  );
}

function ProfileSummary({ readiness }: { readiness: TherapistHomeReadiness }) {
  const profile = readiness.profileSummary;
  const location = [profile.city, profile.state].filter(Boolean).join(" / ");

  return (
    <div className="mt-5 grid gap-5 border-t border-border pt-5 sm:grid-cols-[auto_minmax(0,1fr)]">
      <span className="grid size-16 place-items-center rounded-full bg-brand-lavenderSoft text-lg font-extrabold text-brand-deep">
        {initials(profile.publicName)}
      </span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryDatum
          label="Nome público"
          value={profile.publicName || "Ainda não informado"}
        />
        <SummaryDatum
          label="Localização"
          value={location || "Ainda não informada"}
        />
        <SummaryDatum
          label="Situação do cadastro"
          value={therapistStatusLabel(readiness.therapistStatus)}
        />
      </div>
    </div>
  );
}

function SummaryDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-extrabold leading-6 text-brand-deep">
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-extrabold text-brand-deep">{title}</h2>
      <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
        {description}
      </p>
    </div>
  );
}

function StepState({
  state,
}: {
  state: "attention" | "complete" | "in_review" | "pending";
}) {
  const Icon =
    state === "complete" ? Check : state === "attention" ? AlertCircle : Clock3;
  const className =
    state === "complete"
      ? "bg-status-successBg text-status-success"
      : state === "attention"
        ? "bg-status-warningBg text-status-warning"
        : state === "in_review"
          ? "bg-status-infoBg text-status-info"
          : "bg-brand-lavenderSoft text-brand-primary";

  return (
    <span
      className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${className}`}
    >
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

function progressSummary({
  pendingDocuments,
  pendingSteps,
}: {
  pendingDocuments: TherapistHomeDocument[];
  pendingSteps: TherapistHomeChecklistItem[];
}) {
  const totalPending = pendingDocuments.length + pendingSteps.length;
  if (totalPending === 0) {
    return "Seu cadastro está completo. O TES está analisando e logo você terá um retorno.";
  }
  if (totalPending === 1) {
    return "Falta apenas uma etapa para você concluir o cadastro.";
  }
  return `Faltam ${totalPending} etapas para você concluir o cadastro.`;
}

function pendingSectionContent({
  pendingItems,
  verificationStatus,
}: {
  pendingItems: PendingOnboardingItem[];
  verificationStatus: string;
}) {
  if (pendingItems.length === 0) {
    return {
      description:
        verificationStatus === "approved"
          ? "Seu cadastro está completo e aprovado."
          : "Seus itens obrigatórios foram concluídos. Acompanhe a situação do cadastro.",
      title:
        verificationStatus === "approved"
          ? "Cadastro concluído"
          : "Cadastro em análise",
    };
  }

  const itemTitles = pendingItems.map((item) => item.title);

  return {
    description:
      itemTitles.length === 1
        ? `Falta concluir: ${itemTitles[0]}.`
        : `Faltam concluir: ${formatPendingItemTitles(itemTitles)}.`,
    title: "Pendências do cadastro",
  };
}

function formatPendingItemTitles(titles: string[]) {
  if (titles.length <= 1) return titles[0] ?? "";
  if (titles.length === 2) return `${titles[0]} e ${titles[1]}`;

  return `${titles.slice(0, -1).join(", ")} e ${titles.at(-1)}`;
}

function verificationTitle(status: string) {
  if (status === "approved") return "Cadastro aprovado";
  if (status === "in_review") return "Cadastro em análise";
  if (status === "submitted") return "Cadastro enviado para análise";
  if (status === "changes_requested") return "Ajustes solicitados";
  if (status === "rejected") return "Cadastro precisa de revisão";
  return "Cadastro ainda não enviado para análise";
}

function verificationDescription(status: string) {
  if (status === "approved") {
    return "Sua análise foi concluída. Acompanhe a situação do perfil na Visão geral.";
  }
  if (status === "in_review") {
    return "Nossa equipe está analisando as informações enviadas.";
  }
  if (status === "submitted") {
    return "Seu cadastro foi recebido e aguarda o início da análise.";
  }
  if (status === "changes_requested") {
    return "Revise os itens sinalizados e envie novamente quando estiver pronto.";
  }
  if (status === "rejected") {
    return "Revise as informações necessárias antes de encaminhar uma nova solicitação.";
  }
  return "Complete as etapas obrigatórias para enviar seu cadastro para análise.";
}

function initials(name: string) {
  const letters = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return (
    letters
      .map((letter) => letter[0])
      .join("")
      .toUpperCase() || "TE"
  );
}
