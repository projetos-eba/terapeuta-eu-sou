"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Code2,
  Eye,
  FileText,
  LockKeyhole,
  Mail,
  RotateCcw,
  Save,
} from "lucide-react";

import {
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
  AppStickySaveBar,
} from "@/components/app-page";
import { TESButton, TESFeedbackDialog } from "@/components/tes";
import { routes } from "@/lib/routes";

type ProviderKey = "hostinger_mail_api";
type ContentMode = "html" | "text";
type TemplateMode = "custom" | "default";

type Sender = {
  active: boolean;
  display_name: string;
  id: string;
  is_default: boolean;
  mailbox_address: string;
  provider: ProviderKey;
};

type Overrides = {
  html: string;
  preheader: string;
  subject: string;
  text: string;
};

type Detail = {
  actionKey: string;
  allowedTokens: Array<{ key: string; label: string }>;
  description: string;
  label: string;
  preview: { html: string; preheader: string; subject: string; text: string };
  senders: Sender[];
  setting: {
    automatic_dispatch_enabled: boolean;
    enabled: boolean;
    html_override: string | null;
    preheader_override: string | null;
    sender_profile_id: string | null;
    subject_override: string | null;
    text_override: string | null;
  } | null;
  supportsAutomaticDispatch: boolean;
};

type Draft = Overrides & {
  automatic: boolean;
  enabled: boolean;
  senderProfileId: string;
};

const emptyOverrides: Overrides = {
  html: "",
  preheader: "",
  subject: "",
  text: "",
};

export function AdminEmailEventEditor({ actionKey }: { actionKey: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [preview, setPreview] = useState<Detail["preview"] | null>(null);
  const [previewState, setPreviewState] = useState<
    "idle" | "loading" | "unavailable"
  >("idle");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [contentMode, setContentMode] = useState<ContentMode>("text");
  const [templateMode, setTemplateMode] = useState<TemplateMode>("default");
  const [hasEdited, setHasEdited] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const applyDetail = useCallback((next: Detail) => {
    const nextDraft = draftFromDetail(next);
    setData(next);
    setDraft(nextDraft);
    setPreview(next.preview);
    setTemplateMode(hasCustomTemplate(nextDraft) ? "custom" : "default");
    setSaved(false);
    setHasEdited(false);
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/emails", {
        body: JSON.stringify({ action: "get", actionKey }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(
          result.error?.message ?? "Não foi possível carregar o evento.",
        );
        return;
      }
      applyDetail(result.data);
    } catch {
      setError("Não foi possível carregar o evento.");
    }
  }, [actionKey, applyDetail]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!draft || !hasEdited) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPreviewState("loading");
      void (async () => {
        try {
          const response = await fetch("/api/admin/emails", {
            body: JSON.stringify({
              action: "preview",
              actionKey,
              overrides: pickOverrides(draft),
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
            signal: controller.signal,
          });
          const result = await response.json();
          if (!response.ok || !result.ok)
            throw new Error("preview_unavailable");
          setPreview(result.data.preview);
          setPreviewState("idle");
        } catch (previewError) {
          if ((previewError as Error).name === "AbortError") return;
          setPreviewState("unavailable");
        }
      })();
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [actionKey, draft, hasEdited]);

  const updateDraft = useCallback((update: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...update } : current));
    setHasEdited(true);
    setSaved(false);
    setError("");
  }, []);

  async function save(nextDraft = draft) {
    if (!nextDraft || !data) return;
    setSaving(true);
    setSaved(false);
    setError("");
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/emails", {
        body: JSON.stringify({
          action: "save",
          actionKey,
          automaticDispatchEnabled: data.supportsAutomaticDispatch
            ? nextDraft.automatic
            : false,
          enabled: nextDraft.enabled,
          overrides: pickOverrides(nextDraft),
          senderProfileId: nextDraft.senderProfileId || null,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setFeedback(
          result.error?.message ?? "Não foi possível salvar a configuração.",
        );
        return;
      }
      applyDetail(result.data);
      setSaved(true);
    } catch {
      setFeedback("Não foi possível salvar a configuração.");
    } finally {
      setSaving(false);
    }
  }

  function selectTemplateMode(mode: TemplateMode) {
    setTemplateMode(mode);
    if (mode === "default") {
      updateDraft(emptyOverrides);
    }
  }

  function insertToken(token: string) {
    if (!draft || templateMode !== "custom") return;
    const field = contentMode;
    const textArea = textAreaRef.current;
    const current = draft[field];
    const start = textArea?.selectionStart ?? current.length;
    const end = textArea?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    updateDraft({ [field]: next });
    window.requestAnimationFrame(() => {
      textArea?.focus();
      const cursor = start + token.length;
      textArea?.setSelectionRange(cursor, cursor);
    });
  }

  if (error && !data) return <EditorError message={error} />;
  if (!data || !draft) return <EditorLoading />;

  const activeSenders = data.senders.filter((sender) => sender.active);
  const selectedSender = activeSenders.find(
    (sender) => sender.id === draft.senderProfileId,
  );
  const resolvedProvider = selectedSender?.provider ?? "hostinger_mail_api";

  return (
    <AppPageContainer className="max-w-[1166px] py-5 lg:py-6">
      <AppPageHeader
        actions={
          <TESButton href={routes.admin.emailManagement} variant="secondary">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar para E-mails
          </TESButton>
        }
        eyebrow="Configurações · E-mails"
        title={data.label}
      >
        {data.description}
      </AppPageHeader>

      <AppPageSection>
        <div className="flex flex-col gap-3 border-b border-brand-lavender/60 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-brand-lavenderSoft text-brand-primary">
              <Mail aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-brand-deep">
                Configuração do evento
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                A disponibilidade e o conteúdo são aplicados somente a este
                evento transacional.
              </p>
            </div>
          </div>
          <EventStatus enabled={draft.enabled} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <SwitchRow
            checked={draft.enabled}
            description="Ao desabilitar, nenhum e-mail deste evento será enviado."
            label="Evento habilitado"
            onChange={(checked) => updateDraft({ enabled: checked })}
          />
          <SwitchRow
            checked={data.supportsAutomaticDispatch && draft.automatic}
            description={
              data.supportsAutomaticDispatch
                ? "O e-mail é iniciado pelo fluxo autorizado da plataforma."
                : "Este evento não possui gatilho automático. Envios só podem ocorrer pelo fluxo autorizado."
            }
            disabled={!data.supportsAutomaticDispatch}
            label="Envio automático"
            onChange={(checked) => updateDraft({ automatic: checked })}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-extrabold text-brand-deep">
            Remetente do evento
            <select
              className="min-h-11 w-full rounded-xl border border-brand-lavender bg-white px-3 text-sm font-semibold text-tesText-primary outline-none focus:ring-4 focus:ring-ring/20"
              onChange={(event) =>
                updateDraft({ senderProfileId: event.target.value })
              }
              value={draft.senderProfileId}
            >
              <option value="">Remetente padrão da plataforma</option>
              {activeSenders.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.mailbox_address}
                  {sender.is_default ? " (padrão)" : ""}
                </option>
              ))}
            </select>
            <span className="font-semibold leading-6 text-tesText-secondary">
              {providerLabel(resolvedProvider)} · apenas remetentes ativos são
              disponibilizados.
            </span>
          </label>
          <div className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4">
            <div className="flex items-start gap-3">
              <LockKeyhole
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-brand-primary"
              />
              <div>
                <h3 className="text-sm font-extrabold text-brand-deep">
                  Destinatário resolvido pelo evento
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                  O paciente, profissional ou pessoa correspondente é
                  identificado com segurança pelo sistema. Não é possível
                  transformar este evento em um envio arbitrário.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs font-bold text-tesText-muted">
          Identificador do evento: {data.actionKey}
        </p>
      </AppPageSection>

      <AppPageGrid className="items-start xl:grid-cols-[minmax(0,1fr)_400px]">
        <AppPageMain>
          <AppPageSection>
            <div className="flex flex-col gap-4 border-b border-brand-lavender/60 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-brand-deep">
                  Mensagem principal
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                  Use o padrão da plataforma ou personalize somente este evento.
                </p>
              </div>
              <div
                aria-label="Modo do template"
                className="inline-flex rounded-full border border-brand-lavender/70 bg-surface-soft p-1"
                role="group"
              >
                <ModeButton
                  active={templateMode === "default"}
                  onClick={() => selectTemplateMode("default")}
                >
                  Padrão
                </ModeButton>
                <ModeButton
                  active={templateMode === "custom"}
                  onClick={() => selectTemplateMode("custom")}
                >
                  Personalizado
                </ModeButton>
              </div>
            </div>

            {templateMode === "default" ? (
              <div className="mt-5 rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
                O template padrão já é resolvido pelo TES. Escolha
                <strong className="font-extrabold text-brand-deep">
                  {" "}
                  Personalizado
                </strong>{" "}
                para criar substituições apenas para este evento.
              </div>
            ) : null}

            <fieldset
              className="mt-5 grid gap-4"
              disabled={templateMode !== "custom"}
            >
              <label className="grid gap-2 text-sm font-extrabold text-brand-deep">
                Assunto
                <input
                  className="min-h-11 rounded-xl border border-brand-lavender bg-white px-3 text-sm font-semibold text-tesText-primary outline-none focus:ring-4 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-surface-soft"
                  onChange={(event) =>
                    updateDraft({ subject: event.target.value })
                  }
                  placeholder="Usar assunto padrão"
                  value={draft.subject}
                />
              </label>
              <label className="grid gap-2 text-sm font-extrabold text-brand-deep">
                Texto de apoio
                <input
                  className="min-h-11 rounded-xl border border-brand-lavender bg-white px-3 text-sm font-semibold text-tesText-primary outline-none focus:ring-4 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-surface-soft"
                  onChange={(event) =>
                    updateDraft({ preheader: event.target.value })
                  }
                  placeholder="Usar texto padrão"
                  value={draft.preheader}
                />
              </label>

              <div>
                <p className="text-sm font-extrabold text-brand-deep">
                  Conteúdo do e-mail
                </p>
                <div
                  aria-label="Formato do conteúdo"
                  className="mt-2 inline-flex rounded-full border border-brand-lavender/70 bg-surface-soft p-1"
                  role="group"
                >
                  <ModeButton
                    active={contentMode === "text"}
                    onClick={() => setContentMode("text")}
                  >
                    <FileText aria-hidden="true" className="size-4" />
                    Texto
                  </ModeButton>
                  <ModeButton
                    active={contentMode === "html"}
                    onClick={() => setContentMode("html")}
                  >
                    <Code2 aria-hidden="true" className="size-4" />
                    HTML
                  </ModeButton>
                </div>
                <textarea
                  className="mt-3 min-h-64 w-full resize-y rounded-xl border border-brand-lavender bg-white p-3 font-mono text-sm font-medium leading-6 text-tesText-primary outline-none focus:ring-4 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-surface-soft"
                  onChange={(event) =>
                    updateDraft({ [contentMode]: event.target.value })
                  }
                  placeholder={
                    contentMode === "html"
                      ? "Use o HTML padrão ou escreva uma substituição segura."
                      : "Use o texto padrão ou escreva uma substituição."
                  }
                  ref={textAreaRef}
                  value={draft[contentMode]}
                />
              </div>
            </fieldset>

            <div className="mt-5 rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4">
              <h3 className="text-sm font-extrabold text-brand-deep">
                Conteúdo dinâmico permitido
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                Estes tokens são resolvidos somente no contexto deste evento.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.allowedTokens.map((token) => {
                  const value = `{{${token.key}}}`;
                  return (
                    <button
                      className="inline-flex min-h-11 items-center rounded-full border border-brand-lavender bg-white px-3 text-xs font-extrabold text-brand-primary outline-none transition hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={templateMode !== "custom"}
                      key={token.key}
                      onClick={() => insertToken(value)}
                      title={`Inserir ${token.label}`}
                      type="button"
                    >
                      {token.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <TESButton
              className="mt-5"
              disabled={saving}
              onClick={() => {
                const resetDraft = { ...draft, ...emptyOverrides };
                setTemplateMode("default");
                setDraft(resetDraft);
                void save(resetDraft);
              }}
              type="button"
              variant="ghost"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Restaurar padrão
            </TESButton>
          </AppPageSection>
        </AppPageMain>

        <AppPageSection aria-live="polite" className="xl:sticky xl:top-5">
          <div className="flex items-center gap-3 border-b border-brand-lavender/60 pb-5">
            <span className="grid size-11 place-items-center rounded-[16px] bg-brand-lavenderSoft text-brand-primary">
              <Eye aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-brand-deep">
                Preview seguro
              </h2>
              <p className="mt-1 text-sm font-semibold text-tesText-secondary">
                Dados fictícios controlados
              </p>
            </div>
          </div>

          {previewState === "unavailable" || !preview ? (
            <div className="mt-5 flex gap-3 rounded-[20px] border border-status-warning/30 bg-status-warningBg p-4 text-sm font-semibold leading-6 text-tesText-secondary">
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-status-warning"
              />
              <p>
                O preview não está disponível no momento. O conteúdo ainda será
                validado ao salvar.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-muted">
                  Assunto
                </p>
                <p className="mt-2 text-sm font-extrabold leading-6 text-brand-deep">
                  {preview.subject}
                </p>
              </div>
              <iframe
                className="mt-4 min-h-[480px] w-full rounded-[20px] border border-brand-lavender bg-white"
                sandbox=""
                srcDoc={preview.html}
                title="Preview seguro do e-mail"
              />
              {previewState === "loading" ? (
                <p className="mt-3 text-sm font-semibold text-tesText-muted">
                  Atualizando preview…
                </p>
              ) : null}
            </>
          )}
        </AppPageSection>
      </AppPageGrid>

      {feedback ? (
        <TESFeedbackDialog
          message={feedback}
          onClose={() => setFeedback(null)}
        />
      ) : null}

      <AppStickySaveBar>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite" className="min-h-6 text-sm font-semibold">
            {error ? <span className="text-status-danger">{error}</span> : null}
            {saved ? (
              <span className="inline-flex items-center gap-2 text-status-success">
                <CheckCircle2 aria-hidden="true" className="size-4" />
                Configuração salva.
              </span>
            ) : null}
          </div>
          <TESButton
            disabled={saving}
            onClick={() => void save()}
            type="button"
          >
            <Save aria-hidden="true" className="size-4" />
            {saving ? "Salvando…" : "Salvar configuração"}
          </TESButton>
        </div>
      </AppStickySaveBar>
    </AppPageContainer>
  );
}

function SwitchRow({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4">
      <div>
        <h3 className="text-sm font-extrabold text-brand-deep">{label}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {description}
        </p>
      </div>
      <button
        aria-checked={checked}
        aria-label={label}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 ${
          checked ? "bg-brand-primary" : "bg-brand-lavender"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function EventStatus({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-extrabold ${
        enabled
          ? "border-status-success/25 bg-status-successBg text-status-success"
          : "border-status-warning/30 bg-status-warningBg text-status-warning"
      }`}
    >
      {enabled ? "Evento habilitado" : "Evento desabilitado"}
    </span>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-sm font-extrabold outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20 ${
        active
          ? "bg-brand-primary text-white"
          : "text-tesText-secondary hover:bg-white hover:text-brand-deep"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function EditorLoading() {
  return (
    <AppPageContainer aria-busy="true" className="max-w-[1166px] py-5 lg:py-6">
      <AppPageHeader
        eyebrow="Configurações · E-mails"
        title="Carregando evento"
      >
        Preparando uma configuração segura para este evento.
      </AppPageHeader>
      <div className="h-96 animate-pulse rounded-card border border-brand-lavender/60 bg-surface-soft" />
    </AppPageContainer>
  );
}

function EditorError({ message }: { message: string }) {
  return (
    <AppPageContainer className="max-w-[1166px] py-5 lg:py-6">
      <AppPageHeader
        actions={
          <TESButton href={routes.admin.emailManagement} variant="secondary">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar para E-mails
          </TESButton>
        }
        eyebrow="Configurações · E-mails"
        title="Evento indisponível"
      >
        Não foi possível abrir esta configuração de e-mail.
      </AppPageHeader>
      <AppPageSection>
        <p className="rounded-[20px] border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-semibold leading-6 text-status-danger">
          {message}
        </p>
      </AppPageSection>
    </AppPageContainer>
  );
}

function draftFromDetail(detail: Detail): Draft {
  return {
    automatic:
      detail.supportsAutomaticDispatch &&
      detail.setting?.automatic_dispatch_enabled !== false,
    enabled: detail.setting?.enabled !== false,
    html: detail.setting?.html_override ?? "",
    preheader: detail.setting?.preheader_override ?? "",
    senderProfileId: detail.setting?.sender_profile_id ?? "",
    subject: detail.setting?.subject_override ?? "",
    text: detail.setting?.text_override ?? "",
  };
}

function hasCustomTemplate(draft: Draft) {
  return Boolean(draft.html || draft.preheader || draft.subject || draft.text);
}

function pickOverrides(draft: Draft): Overrides {
  return {
    html: draft.html,
    preheader: draft.preheader,
    subject: draft.subject,
    text: draft.text,
  };
}

function providerLabel(provider: ProviderKey) {
  return provider === "hostinger_mail_api"
    ? "Hostinger Mail"
    : "Provider configurado";
}
