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
  TherapistProfileEditableFields,
  TherapistProfileEditorData,
  TherapistProfileMutationResult,
} from "../therapist-profile-editor.types";
import { ProfileCompleteness } from "./profile-completeness";
import { ProfileEditorForm } from "./profile-editor-form";
import { ProfilePageHeader } from "./profile-page-header";
import { ProfileManagedElsewhere } from "./profile-managed-panels";
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

  async function runMutation(action: PendingAction) {
    if (action === "save_draft") {
      const validationError = validateFields(fields);
      if (validationError) {
        setInlineError(validationError);
        setLiveMessage(validationError);
        document.getElementById("publicName")?.focus();
        return;
      }
    }

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
    <AppPageContainer className="gap-5">
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <ProfilePageHeader
        hasUnsavedChanges={hasUnsavedChanges}
        onReset={() =>
          hasUnsavedChanges ? setConfirmAction("reset") : resetLocalChanges()
        }
        onSaveDraft={() => void runMutation("save_draft")}
        saving={pendingAction === "save_draft"}
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
          <ProfileEditorForm
            editor={editor}
            fields={fields}
            updateField={updateField}
          />
          <ProfileSaveBar
            hasDraft={hasDraft}
            hasUnsavedChanges={hasUnsavedChanges}
            onDiscardDraft={() => setConfirmAction("discard_draft")}
            onPublish={() => setConfirmAction("publish")}
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
              Alterações publicadas podem levar até 2 a 3 horas para aparecer em
              todas as superfícies públicas. Salvar rascunho não altera o
              público.
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
        "A versão pública será atualizada. A propagação pode levar até 2 a 3 horas.",
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

function validateFields(fields: TherapistProfileEditableFields) {
  if (fields.publicName.trim().length < 2) {
    return "Informe o nome do perfil antes de salvar.";
  }
  if (fields.shortIntro.length > 200) {
    return "O texto curto deve ter até 200 caracteres.";
  }
  return null;
}

function getSuccessMessage(action: PendingAction, replay: boolean) {
  if (replay) return "Operação já concluída anteriormente.";
  if (action === "save_draft") return "Rascunho salvo.";
  if (action === "discard_draft") return "Rascunho descartado.";
  if (action === "publish") {
    return "Alterações publicadas. A propagação pode levar até 2 a 3 horas.";
  }
  return "Perfil despublicado.";
}
