"use client";

import Link from "next/link";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  Info,
  Loader2,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  AppPageActions,
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
  AppStickySaveBar,
} from "@/components/app-page";
import { TESButton, TESDialog } from "@/components/tes";
import { routes } from "@/lib/routes";

import {
  createStableRequestId,
  sendTherapistProfileCommand,
} from "../therapist-profile-editor.commands";
import {
  buildInitialEditorFields,
  serializeEditorPayload,
} from "../therapist-profile-editor.mappers";
import type {
  TherapistProfileEditableFields,
  TherapistProfileEditorData,
  TherapistProfileMutationResult,
} from "../therapist-profile-editor.types";

type PendingAction = "discard_draft" | "publish" | "save_draft" | "unpublish";

export function TherapistProfileEditorPage({
  editor: initialEditor,
}: {
  editor: TherapistProfileEditorData;
}) {
  const [editor, setEditor] = useState(initialEditor);
  const [fields, setFields] = useState(() =>
    buildInitialEditorFields(initialEditor),
  );
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<
    "discard_draft" | "publish" | "unpublish" | null
  >(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);

  const hasDraft = Boolean(editor.draft);
  const isPublished = editor.derived.publicStatus === "published";
  const displayedFields = useMemo(
    () => (hasDraft ? "draft" : "published"),
    [hasDraft],
  );

  function updateField<K extends keyof TherapistProfileEditableFields>(
    key: K,
    value: TherapistProfileEditableFields[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function setGuideItem(index: number, value: string) {
    setFields((current) => {
      const next = [...current.guideItems];
      next[index] = { icon: next[index]?.icon ?? "sparkles", label: value };
      return {
        ...current,
        guideItems: next.filter((item) => item.label.trim()).slice(0, 6),
      };
    });
  }

  function setReflectionTitle(index: number, value: string) {
    setFields((current) => {
      const next = [...current.reflections];
      next[index] = {
        excerpt: next[index]?.excerpt ?? "",
        href: next[index]?.href ?? "",
        imageUrl: next[index]?.imageUrl ?? "",
        minutesToRead: next[index]?.minutesToRead ?? 3,
        title: value,
      };
      return {
        ...current,
        reflections: next.filter((item) => item.title.trim()).slice(0, 6),
      };
    });
  }

  async function runMutation(action: PendingAction) {
    setPendingAction(action);
    setInlineError(null);

    const command =
      action === "save_draft"
        ? {
            action,
            expectedVersion: editor.version,
            payload: serializeEditorPayload(fields),
            requestId: createStableRequestId(),
          }
        : {
            action,
            expectedVersion: editor.version,
            requestId: createStableRequestId(),
          };

    const result = await sendTherapistProfileCommand(command);
    setPendingAction(null);

    if (result.status === "error") {
      setInlineError(result.error.message);
      setLiveMessage(result.error.message);
      return;
    }

    const mutation = result.data as TherapistProfileMutationResult;
    setEditor(mutation.editor);
    setFields(buildInitialEditorFields(mutation.editor));
    setConfirmAction(null);

    const message = getSuccessMessage(action, mutation.idempotentReplay);
    setLiveMessage(message);
  }

  return (
    <AppPageContainer>
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <AppPageHeader
        actions={
          <AppPageActions>
            <TESButton
              className="min-h-11 rounded-lg"
              href={editor.publicProfileHref}
              variant="secondary"
            >
              <Eye aria-hidden="true" size={18} />
              Ver perfil público
            </TESButton>
            <TESButton
              className="min-h-11 rounded-lg"
              disabled={pendingAction !== null}
              onClick={() => void runMutation("save_draft")}
              type="button"
            >
              {pendingAction === "save_draft" ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={18}
                />
              ) : (
                <Save aria-hidden="true" size={18} />
              )}
              Salvar rascunho
            </TESButton>
          </AppPageActions>
        }
        eyebrow="Meu perfil"
        title="Perfil público"
      >
        Gerencie como você é apresentado para o mundo. As alterações salvas como
        rascunho ficam privadas até você publicar.
      </AppPageHeader>

      {inlineError ? (
        <div
          className="rounded-card border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-bold leading-6 text-status-danger"
          role="alert"
        >
          {inlineError}
        </div>
      ) : null}

      <AppPageGrid>
        <AppPageMain>
          <CompletenessCard editor={editor} />

          <AppPageSection aria-labelledby="profile-editor-title">
            <div className="flex flex-col gap-3 border-b border-brand-lavender pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2
                  className="font-display text-[28px] font-light italic leading-tight text-brand-deep"
                  id="profile-editor-title"
                >
                  Editar perfil
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                  Você está editando a versão{" "}
                  {displayedFields === "draft" ? "em rascunho" : "publicada"}.
                </p>
              </div>
              {hasDraft ? (
                <span className="inline-flex min-h-11 items-center rounded-full bg-brand-lavenderSoft px-4 text-sm font-extrabold text-brand-primary">
                  Rascunho salvo
                </span>
              ) : null}
            </div>

            <form
              className="mt-6 grid gap-5"
              onSubmit={(event) => event.preventDefault()}
            >
              <TextField
                description="Nome exibido na busca e no perfil público."
                id="publicName"
                label="Nome do perfil"
                onChange={(value) => updateField("publicName", value)}
                required
                value={fields.publicName}
              />
              <TextField
                description="Use uma frase breve, responsável e sem promessa de resultado."
                id="shortIntro"
                label="Texto curto"
                maxLength={280}
                onChange={(value) => updateField("shortIntro", value)}
                value={fields.shortIntro}
              />
              <TextArea
                description="Conte sua abordagem com clareza e acolhimento."
                id="essenceBody"
                label="Minha essência"
                maxLength={1600}
                onChange={(value) => updateField("essenceBody", value)}
                rows={5}
                value={fields.essenceBody}
              />
              <TextArea
                description="Explique a proposta e o que a pessoa pode esperar da experiência."
                id="bio"
                label="Como posso te guiar"
                maxLength={1600}
                onChange={(value) => updateField("bio", value)}
                rows={5}
                value={fields.bio}
              />

              <TagEditor
                items={fields.guideItems.map((item) => item.label)}
                label="Especialidades"
                max={6}
                onChange={setGuideItem}
              />

              <TagEditor
                items={fields.reflections.map((item) => item.title)}
                label="Conteúdos / Reflexões"
                max={6}
                onChange={setReflectionTitle}
              />
            </form>
          </AppPageSection>

          <AppStickySaveBar>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-semibold leading-6 text-tesText-secondary">
                {editor.propagationNotice}
              </p>
              <AppPageActions className="shrink-0">
                {hasDraft ? (
                  <TESButton
                    className="min-h-11 rounded-lg"
                    disabled={pendingAction !== null}
                    onClick={() => setConfirmAction("discard_draft")}
                    type="button"
                    variant="secondary"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                    Descartar
                  </TESButton>
                ) : null}
                {isPublished ? (
                  <TESButton
                    className="min-h-11 rounded-lg"
                    disabled={pendingAction !== null}
                    onClick={() => setConfirmAction("unpublish")}
                    type="button"
                    variant="secondary"
                  >
                    Despublicar
                  </TESButton>
                ) : null}
                <TESButton
                  className="min-h-11 rounded-lg"
                  disabled={pendingAction !== null || !hasDraft}
                  onClick={() => setConfirmAction("publish")}
                  type="button"
                >
                  <Send aria-hidden="true" size={18} />
                  Publicar alterações
                </TESButton>
              </AppPageActions>
            </div>
          </AppStickySaveBar>
        </AppPageMain>

        <AppPageAside>
          <StatusPanel editor={editor} />
          <DerivedPanel editor={editor} />
          <MediaPanel
            canUploadVideo={editor.capabilities.canUploadVideo}
            fields={fields}
            updateField={updateField}
          />
          <ManagedElsewherePanel />
        </AppPageAside>
      </AppPageGrid>

      {confirmAction ? (
        <ConfirmProfileActionDialog
          action={confirmAction}
          loading={pendingAction === confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => void runMutation(confirmAction)}
        />
      ) : null}
    </AppPageContainer>
  );
}

export function TherapistProfileEditorErrorState({
  message,
  requestId,
}: {
  message: string;
  requestId?: string;
}) {
  return (
    <AppPageContainer>
      <AppPageHeader title="Meu perfil">
        Não foi possível carregar os dados do perfil profissional agora.
      </AppPageHeader>
      <AppPageSection>
        <div className="flex items-start gap-3">
          <AlertCircle aria-hidden="true" className="mt-1 text-status-danger" />
          <div>
            <h2 className="text-lg font-extrabold text-brand-deep">
              Perfil indisponível
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              {message}
            </p>
            {requestId ? (
              <p className="mt-3 text-xs font-bold text-tesText-subtle">
                Código de suporte: {requestId}
              </p>
            ) : null}
          </div>
        </div>
      </AppPageSection>
    </AppPageContainer>
  );
}

function CompletenessCard({ editor }: { editor: TherapistProfileEditorData }) {
  return (
    <AppPageSection className="bg-brand-lavenderSoft/50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-brand-deep">
            Perfis completos transmitem confiança
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Complete as informações essenciais para apresentar seu trabalho com
            mais clareza.
          </p>
        </div>
        <p className="text-3xl font-extrabold text-brand-primary">
          {editor.completeness.percent}%
        </p>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-brand-primary"
          style={{ width: `${Math.min(100, editor.completeness.percent)}%` }}
        />
      </div>
    </AppPageSection>
  );
}

function ConfirmProfileActionDialog({
  action,
  loading,
  onClose,
  onConfirm,
}: {
  action: "discard_draft" | "publish" | "unpublish";
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const copy = {
    discard_draft: {
      button: "Descartar rascunho",
      description:
        "O rascunho será removido e a versão pública continuará igual.",
      title: "Descartar rascunho?",
    },
    publish: {
      button: "Publicar alterações",
      description:
        "A versão pública será atualizada. A propagação pode levar até 2 a 3 horas.",
      title: "Publicar alterações?",
    },
    unpublish: {
      button: "Despublicar perfil",
      description:
        "O perfil deixará de aparecer publicamente, sem apagar seu histórico.",
      title: "Despublicar perfil?",
    },
  }[action];

  return (
    <TESDialog
      description={copy.description}
      onClose={onClose}
      title={copy.title}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <TESButton
          className="min-h-11 rounded-lg"
          disabled={loading}
          onClick={onClose}
          type="button"
          variant="secondary"
        >
          Cancelar
        </TESButton>
        <TESButton
          className="min-h-11 rounded-lg"
          disabled={loading}
          onClick={onConfirm}
          type="button"
        >
          {loading ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={18} />
          ) : null}
          {copy.button}
        </TESButton>
      </div>
    </TESDialog>
  );
}

function DerivedPanel({ editor }: { editor: TherapistProfileEditorData }) {
  const derived = editor.derived;

  return (
    <AppPageSection>
      <h2 className="text-lg font-extrabold text-brand-deep">
        Dados derivados
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Estes valores vêm de serviços, agenda, avaliações e assinatura.
      </p>
      <dl className="mt-5 grid gap-3">
        <ReadOnlyMetric
          label="Avaliação média"
          value={derived.averageRating?.toFixed(1) ?? "Ainda sem dados"}
        />
        <ReadOnlyMetric
          label="Avaliações"
          value={String(derived.reviewCount)}
        />
        <ReadOnlyMetric
          label="Sessões concluídas"
          value={String(derived.completedSessions)}
        />
        <ReadOnlyMetric
          label="Preço inicial"
          value={formatPrice(derived.startingPriceCents)}
        />
        <ReadOnlyMetric
          label="Serviços ativos"
          value={String(derived.activeServiceCount)}
        />
      </dl>
    </AppPageSection>
  );
}

function ManagedElsewherePanel() {
  return (
    <AppPageSection>
      <h2 className="text-lg font-extrabold text-brand-deep">
        Gerenciado em outras páginas
      </h2>
      <div className="mt-4 grid gap-3">
        <ManagedLink
          href={routes.therapist.services}
          label="Terapias e preços"
        />
        <ManagedLink
          href={routes.therapist.agenda}
          label="Horários disponíveis"
        />
        <ManagedLink href={routes.therapist.reviews} label="Avaliações" />
      </div>
    </AppPageSection>
  );
}

function ManagedLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="flex min-h-11 items-center justify-between rounded-lg border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
      href={href}
    >
      {label}
      <FileText aria-hidden="true" size={18} />
    </Link>
  );
}

function MediaPanel({
  canUploadVideo,
  fields,
  updateField,
}: {
  canUploadVideo: boolean;
  fields: TherapistProfileEditableFields;
  updateField: <K extends keyof TherapistProfileEditableFields>(
    key: K,
    value: TherapistProfileEditableFields[K],
  ) => void;
}) {
  return (
    <AppPageSection>
      <h2 className="text-lg font-extrabold text-brand-deep">
        Vídeo de apresentação
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Informe um link público em HTTPS. Upload direto e documentos privados
        usam buckets separados.
      </p>
      {!canUploadVideo ? (
        <div className="mt-4 rounded-lg border border-status-warning/30 bg-status-warningBg p-4">
          <p className="text-sm font-extrabold text-status-warning">
            Vídeo disponível em planos Premium e Premium Plus.
          </p>
          <TESButton
            className="mt-3 min-h-11 rounded-lg"
            href={routes.therapist.plan}
            variant="secondary"
          >
            Ver plano
          </TESButton>
        </div>
      ) : null}
      <div className="mt-5 grid gap-4">
        <TextField
          disabled={!canUploadVideo}
          id="videoUrl"
          label="Link do vídeo"
          onChange={(value) => updateField("videoUrl", value)}
          value={fields.videoUrl}
        />
        <TextField
          disabled={!canUploadVideo}
          id="videoTitle"
          label="Título do vídeo"
          onChange={(value) => updateField("videoTitle", value)}
          value={fields.videoTitle}
        />
      </div>
    </AppPageSection>
  );
}

function ReadOnlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-lavender bg-brand-lavenderSoft/40 p-4">
      <dt className="text-sm font-bold text-tesText-secondary">{label}</dt>
      <dd className="mt-1 text-lg font-extrabold text-brand-deep">{value}</dd>
    </div>
  );
}

function StatusPanel({ editor }: { editor: TherapistProfileEditorData }) {
  return (
    <AppPageSection>
      <div className="flex items-start gap-3">
        <CheckCircle2
          aria-hidden="true"
          className="mt-1 shrink-0 text-status-success"
          size={22}
        />
        <div>
          <h2 className="text-lg font-extrabold text-brand-deep">
            Status do perfil
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {getStatusLabel(editor.derived.publicStatus)}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-brand-lavender p-4">
        <h3 className="text-sm font-extrabold text-brand-deep">
          Checklist de confiança
        </h3>
        <ul className="mt-3 grid gap-2">
          {editor.completeness.items.map((item) => (
            <li
              className="flex items-center gap-2 text-sm font-semibold text-tesText-secondary"
              key={item.key}
            >
              {item.complete ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="text-status-success"
                  size={18}
                />
              ) : (
                <Info
                  aria-hidden="true"
                  className="text-brand-primary"
                  size={18}
                />
              )}
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </AppPageSection>
  );
}

function TagEditor({
  items,
  label,
  max,
  onChange,
}: {
  items: string[];
  label: string;
  max: number;
  onChange: (index: number, value: string) => void;
}) {
  const values = [...items, ""].slice(0, max);

  return (
    <div>
      <label className="text-sm font-extrabold text-brand-deep">{label}</label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {values.map((item, index) => (
          <input
            className="min-h-11 rounded-lg border border-brand-lavender px-4 text-sm font-bold text-brand-deep outline-none transition placeholder:text-tesText-subtle focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
            key={`${label}-${index}`}
            onChange={(event) => onChange(index, event.target.value)}
            placeholder={`Item ${index + 1}`}
            value={item}
          />
        ))}
      </div>
    </div>
  );
}

function TextArea({
  description,
  id,
  label,
  onChange,
  rows,
  value,
  ...props
}: {
  description?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "onChange" | "rows" | "value"
>) {
  const descriptionId = `${id}-description`;
  return (
    <div>
      <label className="text-sm font-extrabold text-brand-deep" htmlFor={id}>
        {label}
      </label>
      {description ? (
        <p
          className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary"
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}
      <textarea
        aria-describedby={description ? descriptionId : undefined}
        className="mt-3 w-full rounded-lg border border-brand-lavender px-4 py-3 text-sm font-bold leading-6 text-brand-deep outline-none transition placeholder:text-tesText-subtle focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
        {...props}
      />
    </div>
  );
}

function TextField({
  description,
  id,
  label,
  onChange,
  value,
  ...props
}: {
  description?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "onChange" | "value">) {
  const descriptionId = `${id}-description`;
  return (
    <div>
      <label className="text-sm font-extrabold text-brand-deep" htmlFor={id}>
        {label}
      </label>
      {description ? (
        <p
          className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary"
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}
      <input
        aria-describedby={description ? descriptionId : undefined}
        className="mt-3 min-h-11 w-full rounded-lg border border-brand-lavender px-4 text-sm font-bold text-brand-deep outline-none transition placeholder:text-tesText-subtle focus:border-brand-primary focus:ring-4 focus:ring-ring/20 disabled:bg-brand-lavenderSoft disabled:text-tesText-subtle"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
        {...props}
      />
    </div>
  );
}

function formatPrice(cents: number | null) {
  if (cents === null) return "Ainda sem dados";
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    archived: "Arquivado",
    draft: "Rascunho",
    published: "Publicado",
    suspended: "Suspenso",
    unpublished: "Despublicado",
  };
  return labels[status] ?? "Em configuração";
}

function getSuccessMessage(action: PendingAction, replay: boolean) {
  if (replay) return "Operação já concluída anteriormente.";
  if (action === "save_draft") return "Rascunho salvo.";
  if (action === "discard_draft") return "Rascunho descartado.";
  if (action === "publish") return "Alterações publicadas.";
  return "Perfil despublicado.";
}
