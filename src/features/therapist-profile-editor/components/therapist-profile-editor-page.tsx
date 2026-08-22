"use client";

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page";

import {
  createStableRequestId,
  sendTherapistProfileCommand,
} from "../therapist-profile-editor.commands";
import {
  buildInitialEditorFields,
  serializeEditorPayload,
} from "../therapist-profile-editor.mappers";
import type {
  SimpleTherapistProfileMutationCommand,
  SaveTherapistProfileDraftCommand,
  TherapistProfileEditableFields,
  TherapistProfileEditorData,
  TherapistProfileMutationResult,
} from "../therapist-profile-editor.types";
import { ProfileCompleteness } from "./profile-completeness";
import { ProfileEditorForm } from "./profile-editor-form";
import { ProfilePageHeader } from "./profile-page-header";
import { ProfileManagedElsewhere } from "./profile-managed-panels";
import { ProfilePersonalizationPanel } from "./profile-personalization-panel";
import {
  ProfilePhotoUploader,
  ProfileVideoUploader,
} from "./profile-media-uploader";
import { ProfileSaveBar } from "./profile-save-bar";
import { ProfileSection } from "./profile-section";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

type PendingAction = "discard_draft" | "publish" | "save_draft" | "unpublish";
type ConfirmAction = "discard_draft" | "publish" | "reset" | "unpublish";

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
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const baselineFields = useMemo(
    () => buildInitialEditorFields(editor),
    [editor],
  );
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(fields) !== JSON.stringify(baselineFields),
    [baselineFields, fields],
  );
  const hasDraft = Boolean(editor.draft);
  const isPublished = editor.derived.publicStatus === "published";
  const isFirstConfiguration = !isPublished;
  const mustSaveBeforePublishing =
    hasUnsavedChanges || (isFirstConfiguration && !hasDraft);

  function updateField<K extends keyof TherapistProfileEditableFields>(
    key: K,
    value: TherapistProfileEditableFields[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function resetLocalChanges() {
    setFields(baselineFields);
    setConfirmAction(null);
    setInlineError(null);
    setLiveMessage("Alterações locais descartadas.");
  }

  function showValidationError(message: string, focusId: string) {
    setInlineError(message);
    setLiveMessage(message);
    document.getElementById(focusId)?.focus();
  }

  function requestPublishConfirmation() {
    const validationError = validatePublishFields(fields);
    if (validationError) {
      showValidationError(validationError.message, validationError.focusId);
      return;
    }

    setInlineError(null);
    setConfirmAction("publish");
  }

  async function runMutation(action: PendingAction) {
    if (action === "save_draft") {
      const validationError = validateDraftFields(fields);
      if (validationError) {
        showValidationError(validationError.message, validationError.focusId);
        return;
      }
    }

    setPendingAction(action);
    setInlineError(null);

    const result = await sendMutationCommand(action, editor, fields);
    setPendingAction(null);

    if (!result) return;

    applyMutationResult(action, result);
  }

  async function runPublishChanges() {
    const validationError = validatePublishFields(fields);
    if (validationError) {
      showValidationError(validationError.message, validationError.focusId);
      return;
    }

    setPendingAction("publish");
    setInlineError(null);

    let sourceEditor = editor;
    if (mustSaveBeforePublishing) {
      const saveResult = await sendMutationCommand(
        "save_draft",
        sourceEditor,
        fields,
      );
      if (!saveResult) {
        setPendingAction(null);
        return;
      }
      sourceEditor = saveResult.editor;
    }

    const publishResult = await sendMutationCommand(
      "publish",
      sourceEditor,
      fields,
    );
    setPendingAction(null);

    if (!publishResult) {
      setEditor(sourceEditor);
      setFields(buildInitialEditorFields(sourceEditor));
      return;
    }

    applyMutationResult("publish", publishResult);
  }

  async function sendMutationCommand(
    action: PendingAction,
    sourceEditor: TherapistProfileEditorData,
    sourceFields: TherapistProfileEditableFields,
  ) {
    const command:
      | SaveTherapistProfileDraftCommand
      | SimpleTherapistProfileMutationCommand =
      action === "save_draft"
        ? {
            action,
            expectedVersion: sourceEditor.version,
            payload: serializeEditorPayload(sourceFields),
            requestId: createStableRequestId(),
          }
        : {
            action,
            expectedVersion: sourceEditor.version,
            requestId: createStableRequestId(),
          };

    const result = await sendTherapistProfileCommand(command);

    if (result.status === "error") {
      setInlineError(result.error.message);
      setLiveMessage(result.error.message);
      return null;
    }

    return result.data as TherapistProfileMutationResult;
  }

  function applyMutationResult(
    action: PendingAction,
    mutation: TherapistProfileMutationResult,
  ) {
    const nextEditor = mutation.editor;
    setEditor(nextEditor);
    setFields(buildInitialEditorFields(nextEditor));
    setConfirmAction(null);

    const message = getSuccessMessage(action, mutation.idempotentReplay);
    setLiveMessage(message);
  }

  return (
    <AppPageContainer className="gap-5">
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <ProfilePageHeader
        hasUnsavedChanges={hasUnsavedChanges}
        onReset={() =>
          hasUnsavedChanges ? setConfirmAction("reset") : resetLocalChanges()
        }
        onPrimaryAction={() =>
          isFirstConfiguration
            ? requestPublishConfirmation()
            : void runMutation("save_draft")
        }
        primaryDisabled={
          pendingAction !== null ||
          (isFirstConfiguration ? false : !hasUnsavedChanges)
        }
        primaryLabel={
          isFirstConfiguration ? "Publicar alterações" : "Salvar alterações"
        }
        primaryLoading={
          isFirstConfiguration
            ? pendingAction === "publish"
            : pendingAction === "save_draft"
        }
        primaryMode={isFirstConfiguration ? "publish" : "save"}
      />

      {inlineError ? (
        <div
          className="rounded-card border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-bold leading-6 text-status-danger"
          role="alert"
        >
          {inlineError}
        </div>
      ) : null}

      <ProfileCompleteness editor={editor} />

      <AppPageGrid>
        <AppPageMain>
          <ProfilePersonalizationPanel
            editor={editor}
            fields={fields}
            onEditorChange={setEditor}
            onError={setInlineError}
            onMessage={setLiveMessage}
            updateField={updateField}
          />
          <ProfileEditorForm
            editor={editor}
            fields={fields}
            updateField={updateField}
          />
          <ProfileSaveBar
            firstConfiguration={isFirstConfiguration}
            hasDraft={hasDraft}
            hasUnsavedChanges={hasUnsavedChanges}
            onDiscardDraft={() => setConfirmAction("discard_draft")}
            onPublish={requestPublishConfirmation}
            onSaveDraft={() => void runMutation("save_draft")}
            onUnpublish={() => setConfirmAction("unpublish")}
            pendingAction={pendingAction}
            propagationNotice={editor.propagationNotice}
            published={isPublished}
          />
        </AppPageMain>

        <AppPageAside>
          <ProfilePhotoUploader fields={fields} updateField={updateField} />
          <ProfileVideoUploader
            canUploadVideo={editor.capabilities.canUploadVideo}
            fields={fields}
            updateField={updateField}
          />
          <ProfileManagedElsewhere />
          <ProfileSection title="Importante">
            <p className="text-sm font-semibold leading-6 text-tesText-secondary">
              Depois do envio, a equipe TES revisa o perfil antes de ele voltar
              a aparecer publicamente. A publicação pode levar de 2 a 3 horas
              para refletir em todas as superfícies. Salvar rascunho não altera
              o público.
            </p>
          </ProfileSection>
        </AppPageAside>
      </AppPageGrid>

      {confirmAction ? (
        <ConfirmDialog
          action={confirmAction}
          loading={confirmAction !== "reset" && pendingAction === confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction === "reset") {
              resetLocalChanges();
              return;
            }
            if (confirmAction === "publish") {
              void runPublishChanges();
              return;
            }
            void runMutation(confirmAction);
          }}
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
      <ProfileSection>
        <div className="flex items-start gap-3">
          <AlertCircle aria-hidden="true" className="mt-1 text-status-danger" />
          <div>
            <h1 className="text-3xl font-extrabold text-brand-deep">
              Perfil indisponível
            </h1>
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
      </ProfileSection>
    </AppPageContainer>
  );
}

function ConfirmDialog({
  action,
  loading,
  onClose,
  onConfirm,
}: {
  action: ConfirmAction;
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
        "A versão pública será atualizada. Ela pode levar de 2 a 3 horas para aparecer em todos os lugares.",
      title: "Publicar alterações?",
    },
    reset: {
      button: "Descartar alterações",
      description:
        "As alterações ainda não salvas serão removidas deste editor.",
      title: "Descartar alterações não salvas?",
    },
    unpublish: {
      button: "Despublicar perfil",
      description:
        "O perfil deixará de aparecer publicamente, sem apagar seu histórico.",
      title: "Despublicar perfil?",
    },
  }[action];

  return (
    <UnsavedChangesDialog
      confirmLabel={copy.button}
      loading={loading}
      message={copy.description}
      onClose={onClose}
      onConfirm={onConfirm}
      title={copy.title}
    />
  );
}

type FieldValidationError = {
  focusId: keyof TherapistProfileEditableFields;
  message: string;
};

function validateDraftFields(
  fields: TherapistProfileEditableFields,
): FieldValidationError | null {
  const publicName = fields.publicName.trim();
  if (publicName.length < 2) {
    return {
      focusId: "publicName",
      message: "Informe o nome do perfil antes de salvar.",
    };
  }
  if (publicName.length > 120) {
    return {
      focusId: "publicName",
      message: "O nome do perfil deve ter até 120 caracteres.",
    };
  }
  if (fields.shortIntro.length > 200) {
    return {
      focusId: "shortIntro",
      message: "O texto curto deve ter até 200 caracteres.",
    };
  }
  if (fields.headline.length > 180) {
    return {
      focusId: "headline",
      message: "O destaque do perfil deve ter até 180 caracteres.",
    };
  }
  if (fields.bio.length > 1600) {
    return {
      focusId: "bio",
      message: "A apresentação do perfil deve ter até 1600 caracteres.",
    };
  }
  if (fields.essenceBody.length > 600) {
    return {
      focusId: "essenceBody",
      message: "Minha essência deve ter até 600 caracteres.",
    };
  }
  if (fields.invitationBody.length > 600) {
    return {
      focusId: "invitationBody",
      message: "O convite do perfil deve ter até 600 caracteres.",
    };
  }
  if (fields.city.length > 80 || fields.state.length > 40) {
    return {
      focusId: fields.city.length > 80 ? "city" : "state",
      message: "Revise cidade e estado antes de salvar.",
    };
  }
  if (fields.guideItems.length > 6) {
    return {
      focusId: "guideItems",
      message: "Mantenha no máximo 6 itens em Como posso te guiar.",
    };
  }
  if (
    hasInvalidListItem(
      fields.guideItems.map((item) => item.label),
      80,
    )
  ) {
    return {
      focusId: "guideItems",
      message: "Cada item de Como posso te guiar deve ter até 80 caracteres.",
    };
  }
  if (fields.reflections.length > 6) {
    return {
      focusId: "reflections",
      message: "Mantenha no máximo 6 conteúdos/reflexões.",
    };
  }
  if (
    hasInvalidListItem(
      fields.reflections.map((item) => item.title),
      120,
    )
  ) {
    return {
      focusId: "reflections",
      message: "Cada conteúdo/reflexão deve ter até 120 caracteres.",
    };
  }
  if (
    fields.reflections.some(
      (item) =>
        item.excerpt.length > 240 ||
        item.href.length > 500 ||
        item.imageUrl.length > 500 ||
        !Number.isInteger(item.minutesToRead) ||
        item.minutesToRead < 1 ||
        item.minutesToRead > 60,
    )
  ) {
    return {
      focusId: "reflections",
      message: "Revise os dados dos conteúdos/reflexões antes de salvar.",
    };
  }
  if (hasInvalidMediaUrl(fields.photoUrl, "public")) {
    return {
      focusId: "photoUrl",
      message: "Envie uma foto válida ou use uma URL pública da imagem.",
    };
  }
  if (hasInvalidMediaUrl(fields.videoThumbnailUrl, "public")) {
    return {
      focusId: "videoThumbnailUrl",
      message: "Envie uma capa válida ou use uma URL pública da imagem.",
    };
  }
  if (hasInvalidVideoUrl(fields.videoUrl, fields.videoProvider)) {
    return {
      focusId: "videoUrl",
      message:
        "Use um link https:// do YouTube ou Vimeo. Para um arquivo enviado, selecione o vídeo novamente.",
    };
  }
  if (fields.videoTitle.length > 120) {
    return {
      focusId: "videoTitle",
      message: "O título do vídeo deve ter até 120 caracteres.",
    };
  }
  return null;
}

function validatePublishFields(
  fields: TherapistProfileEditableFields,
): FieldValidationError | null {
  const draftError = validateDraftFields(fields);
  if (draftError) return draftError;

  const missingFields: Array<{
    focusId: keyof TherapistProfileEditableFields;
    label: string;
  }> = [];
  if (!fields.shortIntro.trim() && !fields.headline.trim()) {
    missingFields.push({ focusId: "shortIntro", label: "texto curto" });
  }
  if (!fields.essenceBody.trim() && !fields.bio.trim()) {
    missingFields.push({ focusId: "essenceBody", label: "sua essência" });
  }

  if (missingFields.length > 0) {
    return {
      focusId: missingFields[0].focusId,
      message: `Preencha ${formatFieldList(
        missingFields.map((field) => field.label),
      )} antes de publicar.`,
    };
  }

  return null;
}

function formatFieldList(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
}

function hasInvalidListItem(items: string[], max: number) {
  return items.some((item) => {
    const normalized = item.trim();
    return normalized.length > 0 && normalized.length > max;
  });
}

function hasInvalidMediaUrl(value: string, mode: "https" | "public") {
  const normalized = value.trim();
  if (!normalized) return false;
  if (/\s/.test(normalized)) return true;
  if (mode === "https") return !normalized.startsWith("https://");
  return !(normalized.startsWith("https://") || normalized.startsWith("/"));
}

function hasInvalidVideoUrl(
  value: string,
  provider: TherapistProfileEditableFields["videoProvider"],
) {
  const normalized = value.trim();
  if (!normalized) return false;
  if (provider === "upload") return hasInvalidMediaUrl(normalized, "https");
  if (!normalized.startsWith("https://") || /\s/.test(normalized)) return true;

  try {
    const hostname = new URL(normalized).hostname.replace(/^www\./, "");
    if (provider === "youtube") {
      return hostname !== "youtube.com" && hostname !== "youtu.be";
    }
    if (provider === "vimeo") return hostname !== "vimeo.com";
  } catch {
    return true;
  }

  return true;
}

function getSuccessMessage(action: PendingAction, replay: boolean) {
  if (replay) return "Operação já concluída anteriormente.";
  if (action === "save_draft") return "Rascunho salvo.";
  if (action === "discard_draft") return "Rascunho descartado.";
  if (action === "publish") {
    return "Alterações enviadas para revisão. O perfil volta a ficar público após a aprovação da equipe TES.";
  }
  return "Perfil despublicado.";
}
