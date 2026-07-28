"use client";

import { Eye, Loader2, Save } from "lucide-react";

import { AppPageActions, AppPageHeader } from "@/components/app-page";
import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

export function ProfilePageHeader({
  hasUnsavedChanges,
  onReset,
  onSaveDraft,
  saving,
}: {
  hasUnsavedChanges: boolean;
  onReset: () => void;
  onSaveDraft: () => void;
  saving: boolean;
}) {
  return (
    <AppPageHeader
      actions={
        <AppPageActions>
          <TESButton
            className="min-h-11 rounded-lg"
            href={routes.therapist.profile}
            variant="secondary"
          >
            <Eye aria-hidden="true" size={18} />
            Visualizar perfil
          </TESButton>
          <TESButton
            className="min-h-11 rounded-lg"
            disabled={!hasUnsavedChanges || saving}
            onClick={onReset}
            type="button"
            variant="secondary"
          >
            Cancelar
          </TESButton>
          <TESButton
            className="min-h-11 rounded-lg"
            disabled={!hasUnsavedChanges || saving}
            onClick={onSaveDraft}
            type="button"
          >
            {saving ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={18} />
            ) : (
              <Save aria-hidden="true" size={18} />
            )}
            Salvar alterações
          </TESButton>
        </AppPageActions>
      }
      title="Editar perfil"
    >
      Atualize as informações principais exibidas no seu perfil público.
    </AppPageHeader>
  );
}
