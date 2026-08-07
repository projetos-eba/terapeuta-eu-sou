"use client";

import { Eye, Loader2, Save, Send } from "lucide-react";

import { AppPageActions, AppPageHeader } from "@/components/app-page";
import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

export function ProfilePageHeader({
  hasUnsavedChanges,
  onReset,
  onPrimaryAction,
  primaryDisabled,
  primaryLabel,
  primaryMode,
  primaryLoading,
}: {
  hasUnsavedChanges: boolean;
  onReset: () => void;
  onPrimaryAction: () => void;
  primaryDisabled: boolean;
  primaryLabel: string;
  primaryMode: "publish" | "save";
  primaryLoading: boolean;
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
            disabled={!hasUnsavedChanges || primaryLoading}
            onClick={onReset}
            type="button"
            variant="secondary"
          >
            Cancelar
          </TESButton>
          <TESButton
            className="min-h-11 rounded-lg"
            disabled={primaryDisabled}
            onClick={onPrimaryAction}
            type="button"
          >
            {primaryLoading ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={18} />
            ) : primaryMode === "publish" ? (
              <Send aria-hidden="true" size={18} />
            ) : (
              <Save aria-hidden="true" size={18} />
            )}
            {primaryLabel}
          </TESButton>
        </AppPageActions>
      }
      title="Editar perfil"
    >
      Atualize as informações principais exibidas no seu perfil público.
    </AppPageHeader>
  );
}
