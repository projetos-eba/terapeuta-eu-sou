"use client";

import { Loader2 } from "lucide-react";

import { TESButton, TESDialog } from "@/components/tes";

export function UnsavedChangesDialog({
  loading,
  message,
  onClose,
  onConfirm,
  title,
  confirmLabel,
}: {
  confirmLabel: string;
  loading: boolean;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <TESDialog description={message} onClose={onClose} title={title}>
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
          {confirmLabel}
        </TESButton>
      </div>
    </TESDialog>
  );
}
