"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  MessageSquarePlus,
} from "lucide-react";

import { TESDialog, TESFeedbackDialog } from "@/components/tes";
import { routes } from "@/lib/routes";

import type {
  MessageCenterActorRole,
  MessageCenterTemplate,
  MessageCenterThread,
} from "../message-center.types";

type MessageCenterActionsProps = {
  actorRole: MessageCenterActorRole;
  source: "demo" | "supabase";
  templates: MessageCenterTemplate[];
  threads: MessageCenterThread[];
  variant: "participant" | "support";
};

type ApiFailure = { ok: false; error?: { message?: string } };
type Preview = {
  body: string;
  category: string;
  context: { bookingId: string } | null;
  cta: { href: string; label: string } | null;
  recipientName: string;
};

export function MessageCenterActions(props: MessageCenterActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg border border-brand-lavender bg-white px-4 text-xs font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <MessageSquarePlus aria-hidden="true" size={16} />
        {props.variant === "support"
          ? props.actorRole === "patient"
            ? "Nova mensagem"
            : "Novo suporte"
          : "Escolher mensagem"}
      </button>
      {isOpen ? (
        <TemplateDialog {...props} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}
function TemplateDialog({
  onClose,
  ...props
}: MessageCenterActionsProps & { onClose: () => void }) {
  const router = useRouter();
  const firstThread = useMemo(
    () =>
      props.threads.find((thread) => Boolean(thread.conversationId)) ?? null,
    [props.threads],
  );
  const [conversationId, setConversationId] = useState(
    firstThread?.conversationId ?? "",
  );
  const selectedThread =
    props.threads.find((thread) => thread.conversationId === conversationId) ??
    firstThread;
  const [templateKey, setTemplateKey] = useState(props.templates[0]?.key ?? "");
  const selectedTemplate = props.templates.find(
    (template) => template.key === templateKey,
  );
  const [supportSubject, setSupportSubject] = useState(
    selectedTemplate?.label ?? "",
  );
  const [supportDescription, setSupportDescription] = useState(
    selectedTemplate?.body ?? "",
  );
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"choose" | "review" | "success">("choose");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const supportRequestId = useRef<string | null>(null);

  const templateParameters = selectedTemplate?.parameters ?? [];
  const canReview =
    props.variant === "support" ||
    Boolean(conversationId && templateKey && selectedThread);

  async function previewTemplate() {
    if (!selectedTemplate || !conversationId || props.source === "demo") {
      setError("Conecte-se novamente para preparar uma mensagem real.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const response = await fetch("/api/messages/preview-template", {
      body: JSON.stringify({
        actorRole: props.actorRole,
        conversationId,
        templateKey,
        parameters,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      preview?: Preview;
      error?: { message?: string };
    } | null;
    setIsSubmitting(false);
    if (!response.ok || payload?.ok !== true || !payload.preview) {
      setError(
        payload?.error?.message ?? "Não foi possível preparar a prévia agora.",
      );
      return;
    }
    setPreview(payload.preview);
    setStep("review");
  }

  async function sendTemplate() {
    if (!selectedTemplate || !conversationId || props.source === "demo") {
      setError("Conecte-se novamente para enviar uma mensagem real.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const response = await fetch("/api/messages/send-template", {
      body: JSON.stringify({
        actorRole: props.actorRole,
        conversationId,
        templateKey,
        parameters,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | ApiFailure
      | { ok: true }
      | null;
    setIsSubmitting(false);
    if (!response.ok || payload?.ok !== true) {
      setError(
        payload?.ok === false
          ? (payload.error?.message ??
              "Não foi possível enviar esta mensagem agora.")
          : "Não foi possível enviar esta mensagem agora.",
      );
      return;
    }
    setStep("success");
  }

  async function createSupportTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (props.source === "demo") {
      setError("Conecte-se novamente para abrir um chamado real.");
      return;
    }
    setIsSubmitting(true);
    supportRequestId.current ??= crypto.randomUUID();
    const response = await fetch("/api/support/tickets", {
      body: JSON.stringify({
        actorRole: props.actorRole,
        bookingId: null,
        category: supportCategoryForTemplate(selectedTemplate?.key),
        description: supportDescription,
        requestId: supportRequestId.current,
        source: "message_center",
        subject: supportSubject,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      ticket?: { id?: string; protocol?: string };
      error?: { message?: string };
    } | null;
    setIsSubmitting(false);
    if (!response.ok || payload?.ok !== true) {
      setError(
        payload?.error?.message ?? "Não foi possível abrir o chamado agora.",
      );
      return;
    }
    const ticketId = (payload.ticket as { id?: string } | undefined)?.id;
    if (ticketId) {
      const href =
        props.actorRole === "patient"
          ? routes.patient.supportTicketDetail(ticketId)
          : routes.therapist.supportTicketDetail(ticketId);
      router.push(href);
      router.refresh();
      supportRequestId.current = null;
      onClose();
      return;
    }
    setProtocol(payload.ticket?.protocol ?? "registrado");
    setStep("success");
  }

  return (
    <TESDialog
      description={
        props.variant === "support"
          ? "Escolha uma categoria e conte o que você precisa para abrir sua conversa com o TES."
          : "Escolha uma mensagem aprovada, revise o conteúdo resolvido pelo TES e envie."
      }
      onClose={onClose}
      title={
        props.variant === "support"
          ? "Novo contato com suporte"
          : step === "review"
            ? "Revisar mensagem"
            : "Escolher mensagem"
      }
    >
      {step === "success" ? (
        <div className="rounded-xl bg-status-successBg p-5 text-status-success">
          <Check aria-hidden="true" size={22} />
          <p className="mt-3 text-sm font-extrabold">
            {props.variant === "support"
              ? `Chamado aberto com protocolo ${protocol ?? "registrado"}.`
              : "Mensagem enviada com segurança."}
          </p>
          <p className="mt-1 text-sm font-semibold leading-6">
            {props.variant === "support"
              ? "A equipe TES poderá acompanhar sua mensagem neste chamado."
              : "O texto enviado foi resolvido pelo TES a partir de um modelo aprovado."}
          </p>
        </div>
      ) : props.variant === "support" ? (
        <form className="grid gap-4" onSubmit={createSupportTicket}>
          <TemplateOptions
            legend="Categoria do suporte"
            selectedKey={templateKey}
            templates={props.templates}
            onChange={(key) => {
              setTemplateKey(key);
              supportRequestId.current = null;
              const template = props.templates.find(
                (item) => item.key === key,
              );
              setSupportSubject(template?.label ?? "");
              setSupportDescription(template?.body ?? "");
            }}
          />
          <label className="grid gap-2">
            <span className="text-sm font-extrabold text-brand-deep">
              Assunto
            </span>
            <input
              className="min-h-12 rounded-lg border border-brand-lavender px-3 text-sm font-semibold text-brand-deep"
              maxLength={120}
              onChange={(event) => {
                supportRequestId.current = null;
                setSupportSubject(event.target.value);
              }}
              value={supportSubject}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-extrabold text-brand-deep">
              Conte mais sobre o que aconteceu
            </span>
            <textarea
              className="min-h-32 resize-y rounded-lg border border-brand-lavender px-3 py-3 text-sm font-semibold leading-6 text-brand-deep"
              maxLength={4000}
              onChange={(event) => {
                supportRequestId.current = null;
                setSupportDescription(event.target.value);
              }}
              value={supportDescription}
            />
          </label>
          {error ? (
            <TESFeedbackDialog message={error} onClose={() => setError(null)} />
          ) : null}
          <Actions
            disabled={
              !templateKey ||
              supportSubject.trim().length < 3 ||
              !supportDescription.trim() ||
              isSubmitting
            }
            onBack={onClose}
            submitLabel="Abrir chamado"
            submitting={isSubmitting}
          />
        </form>
      ) : step === "review" && preview ? (
        <div className="grid gap-4">
          <div className="rounded-xl border border-brand-lavender bg-brand-lavenderSoft p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-brand-primary">
              Destinatário
            </p>
            <p className="mt-1 text-sm font-bold text-brand-deep">
              {preview.recipientName}
            </p>
            {selectedThread?.sessionContext ? (
              <p className="mt-2 text-xs font-semibold text-tesText-secondary">
                {selectedThread.sessionContext}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-brand-lavender bg-white p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-brand-primary">
              Mensagem final
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-brand-deep">
              {preview.body}
            </p>
          </div>
          {preview.cta ? (
            <div className="rounded-xl border border-brand-lavender bg-white p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-brand-primary">
                Ação sugerida
              </p>
              <p className="mt-2 text-sm font-bold text-brand-deep">
                {preview.cta.label}
              </p>
            </div>
          ) : null}
          {error ? (
            <TESFeedbackDialog message={error} onClose={() => setError(null)} />
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary"
              onClick={() => setStep("choose")}
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={16} />
              Voltar
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() => void sendTemplate()}
              type="button"
            >
              {isSubmitting ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={17}
                />
              ) : null}
              Enviar mensagem
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-extrabold text-brand-deep">
              Destinatário
            </span>
            <span className="relative">
              <select
                className="min-h-12 w-full appearance-none rounded-lg border border-brand-lavender bg-white px-4 pr-10 text-sm font-semibold text-brand-deep outline-none focus:border-brand-primary"
                onChange={(event) => setConversationId(event.target.value)}
                value={conversationId}
              >
                {props.threads.map((thread) => (
                  <option
                    disabled={!thread.conversationId}
                    key={thread.id}
                    value={thread.conversationId ?? ""}
                  >
                    {thread.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary"
                size={17}
              />
            </span>
          </label>
          <TemplateOptions
            legend="Mensagem aprovada"
            selectedKey={templateKey}
            templates={props.templates}
            onChange={(key) => {
              setTemplateKey(key);
              setParameters({});
            }}
          />
          {templateParameters.map((parameter) => (
            <label className="grid gap-2" key={parameter.key}>
              <span className="text-sm font-extrabold text-brand-deep">
                {parameter.label}
              </span>
              <select
                className="min-h-11 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-semibold text-brand-deep"
                onChange={(event) =>
                  setParameters((current) => ({
                    ...current,
                    [parameter.key]: event.target.value,
                  }))
                }
                value={parameters[parameter.key] ?? ""}
              >
                <option value="">Selecione uma opção</option>
                {parameter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {error ? (
            <TESFeedbackDialog message={error} onClose={() => setError(null)} />
          ) : null}
          <Actions
            disabled={
              !canReview ||
              templateParameters.some(
                (parameter) => !parameters[parameter.key],
              ) ||
              isSubmitting
            }
            onBack={onClose}
            onSubmit={() => void previewTemplate()}
            submitLabel="Revisar mensagem"
            submitting={isSubmitting}
          />
        </div>
      )}
    </TESDialog>
  );
}

function supportCategoryForTemplate(key: string | undefined) {
  const categories: Record<string, string> = {
    patient_support_payment: "pagamentos",
    patient_support_access: "zoom_acesso",
    patient_support_account: "conta_acesso",
    therapist_support_finance: "financeiro_repasses",
    therapist_support_schedule: "agenda_sessoes",
    therapist_support_account: "conta_acesso",
  };
  return categories[key ?? ""] ?? "outro";
}

function TemplateOptions({
  legend,
  selectedKey,
  templates,
  onChange,
}: {
  legend: string;
  selectedKey: string;
  templates: MessageCenterTemplate[];
  onChange: (key: string) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-extrabold text-brand-deep">{legend}</legend>
      <div className="grid max-h-[46vh] gap-2 overflow-y-auto pr-1">
        {templates.map((template) => (
          <label
            className="grid cursor-pointer gap-1 rounded-lg border border-brand-lavender bg-white p-4 transition has-[:checked]:border-brand-primary has-[:checked]:bg-brand-lavenderSoft"
            key={template.key}
          >
            <span className="flex items-center gap-3">
              <input
                checked={selectedKey === template.key}
                className="size-4 accent-brand-primary"
                onChange={() => onChange(template.key)}
                type="radio"
              />
              <span className="text-sm font-extrabold text-brand-deep">
                {template.label}
              </span>
              <span className="rounded-full bg-brand-lavenderSoft px-2 py-1 text-[11px] font-extrabold text-brand-primary">
                {getCategoryLabel(template.category)}
              </span>
            </span>
            <span className="pl-7 text-xs font-semibold leading-5 text-tesText-secondary">
              {template.description || template.body}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function getCategoryLabel(category: MessageCenterTemplate["category"]) {
  const labels: Partial<Record<MessageCenterTemplate["category"], string>> = {
    acompanhamento: "Acompanhamento",
    atendimento: "Atendimento",
    atualizacao: "Atualização",
    confirmacao: "Confirmação",
    duvida: "Dúvida",
    financeiro: "Financeiro",
    plataforma: "Plataforma",
    reagendamento: "Reagendamento",
    suporte: "Suporte TES",
  };
  return labels[category] ?? category;
}

function Actions({
  disabled,
  onBack,
  onSubmit,
  submitLabel,
  submitting,
}: {
  disabled: boolean;
  onBack: () => void;
  onSubmit?: () => void;
  submitLabel: string;
  submitting: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary"
        onClick={onBack}
        type="button"
      >
        Voltar
      </button>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={onSubmit}
        type={onSubmit ? "button" : "submit"}
      >
        {submitting ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={17} />
        ) : null}
        {submitLabel}
      </button>
    </div>
  );
}
