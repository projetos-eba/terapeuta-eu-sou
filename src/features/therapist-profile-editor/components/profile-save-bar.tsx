"use client";

import { Loader2, Send, Trash2 } from "lucide-react";

import { AppPageActions, AppStickySaveBar } from "@/components/app-page";
import { TESButton } from "@/components/tes";

type PendingAction = "discard_draft" | "publish" | "save_draft" | "unpublish";

export function ProfileSaveBar({
  hasDraft,
  hasUnsavedChanges,
  onDiscardDraft,
  onPublish,
  onSaveDraft,
  onUnpublish,
  pendingAction,
  propagationNotice,
  published,
}: {
  hasDraft: boolean;
  hasUnsavedChanges: boolean;
  onDiscardDraft: () => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  onUnpublish: () => void;
  pendingAction: PendingAction | null;
  propagationNotice: string;
  published: boolean;
}) {
  const publishDisabled =
    pendingAction !== null || !hasDraft || hasUnsavedChanges;

  return (
    <AppStickySaveBar className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-extrabold leading-6 text-brand-deep">
            {hasUnsavedChanges
              ? "Você tem alterações não salvas."
              : hasDraft
                ? "Existe um rascunho salvo aguardando publicação."
                : "A versão pública está sincronizada com o editor."}
          </p>
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            {hasUnsavedChanges
              ? "Salve como rascunho antes de publicar."
              : propagationNotice}
          </p>
        </div>
        <AppPageActions className="shrink-0">
          <TESButton
            className="min-h-11 rounded-lg"
            disabled={!hasUnsavedChanges || pendingAction !== null}
            onClick={onSaveDraft}
            type="button"
            variant="secondary"
          >
            {pendingAction === "save_draft" ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={18} />
            ) : null}
            Salvar rascunho
          </TESButton>
          {hasDraft ? (
            <TESButton
              className="min-h-11 rounded-lg"
              disabled={pendingAction !== null}
              onClick={onDiscardDraft}
              type="button"
              variant="secondary"
            >
              <Trash2 aria-hidden="true" size={18} />
              Descartar rascunho
            </TESButton>
          ) : null}
          {published ? (
            <TESButton
              className="min-h-11 rounded-lg"
              disabled={pendingAction !== null}
              onClick={onUnpublish}
              type="button"
              variant="secondary"
            >
              Despublicar
            </TESButton>
          ) : null}
          <TESButton
            className="min-h-11 rounded-lg"
            disabled={publishDisabled}
            onClick={onPublish}
            type="button"
          >
            {pendingAction === "publish" ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={18} />
            ) : (
              <Send aria-hidden="true" size={18} />
            )}
            Publicar alterações
          </TESButton>
        </AppPageActions>
      </div>
    </AppStickySaveBar>
  );
}
