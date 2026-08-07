"use client";

import { Loader2, Send, Trash2 } from "lucide-react";

import { AppPageActions, AppStickySaveBar } from "@/components/app-page";
import { TESButton } from "@/components/tes";

type PendingAction = "discard_draft" | "publish" | "save_draft" | "unpublish";

export function ProfileSaveBar({
  firstConfiguration,
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
  firstConfiguration: boolean;
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
    pendingAction !== null ||
    (firstConfiguration
      ? !hasDraft && !hasUnsavedChanges
      : !hasDraft || hasUnsavedChanges);
  const message = getSaveBarMessage({
    firstConfiguration,
    hasDraft,
    hasUnsavedChanges,
    propagationNotice,
  });

  return (
    <AppStickySaveBar className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-extrabold leading-6 text-brand-deep">
            {message.title}
          </p>
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            {message.description}
          </p>
        </div>
        <AppPageActions className="shrink-0">
          {firstConfiguration ? null : (
            <TESButton
              className="min-h-11 rounded-lg"
              disabled={!hasUnsavedChanges || pendingAction !== null}
              onClick={onSaveDraft}
              type="button"
              variant="secondary"
            >
              {pendingAction === "save_draft" ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={18}
                />
              ) : null}
              Salvar alterações
            </TESButton>
          )}
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

function getSaveBarMessage({
  firstConfiguration,
  hasDraft,
  hasUnsavedChanges,
  propagationNotice,
}: {
  firstConfiguration: boolean;
  hasDraft: boolean;
  hasUnsavedChanges: boolean;
  propagationNotice: string;
}) {
  if (firstConfiguration) {
    if (hasUnsavedChanges) {
      return {
        description:
          "A publicação salva os dados preenchidos e envia a primeira versão para o seu perfil público.",
        title: "Publique sua primeira versão quando os campos essenciais estiverem completos.",
      };
    }

    if (hasDraft) {
      return {
        description: propagationNotice,
        title: "Existe uma primeira versão salva aguardando publicação.",
      };
    }

    return {
      description:
        "Preencha as informações principais para liberar a primeira publicação.",
      title: "Seu perfil ainda não tem dados prontos para publicar.",
    };
  }

  if (hasUnsavedChanges) {
    return {
      description:
        "Salve as alterações como rascunho antes de atualizar a versão pública.",
      title: "Você tem alterações não salvas.",
    };
  }

  if (hasDraft) {
    return {
      description: propagationNotice,
      title: "Existe um rascunho salvo aguardando publicação.",
    };
  }

  return {
    description: propagationNotice,
    title: "A versão pública está sincronizada com o editor.",
  };
}
