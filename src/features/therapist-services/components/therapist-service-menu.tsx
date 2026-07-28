"use client";

import { Archive, Edit3, MoreVertical, Pause, Play, Rows3 } from "lucide-react";
import { useState } from "react";

import { TESDialog } from "@/components/tes";
import { cn } from "@/lib/utils";

import type { TherapistServiceSummary } from "../therapist-services.types";

export type TherapistServiceMenuAction =
  | "activate"
  | "archive"
  | "edit"
  | "move_down"
  | "move_up"
  | "pause";

export function TherapistServiceMenu({
  canMoveDown,
  canMoveUp,
  disabled,
  onAction,
  service,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  disabled?: boolean;
  onAction: (action: TherapistServiceMenuAction) => void;
  service: TherapistServiceSummary;
}) {
  const [open, setOpen] = useState(false);
  const canActivate = service.status === "draft" || service.status === "paused";
  const canPause = service.status === "active";
  const canArchive = service.status !== "archived";

  return (
    <>
      <button
        aria-label={`Abrir ações de ${service.title}`}
        className="grid size-11 place-items-center rounded-lg text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:opacity-60"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        <MoreVertical aria-hidden="true" size={20} />
      </button>
      {open ? (
        <TESDialog
          className="max-w-[420px]"
          description="Escolha uma ação para este serviço."
          onClose={() => setOpen(false)}
          title="Ações do serviço"
        >
          <div className="grid gap-2">
            <MenuButton
              icon={<Edit3 aria-hidden="true" size={17} />}
              label="Editar serviço"
              onClick={() => {
                setOpen(false);
                onAction("edit");
              }}
            />
            <MenuButton
              disabled={!canActivate}
              icon={<Play aria-hidden="true" size={17} />}
              label="Ativar"
              onClick={() => {
                setOpen(false);
                onAction("activate");
              }}
            />
            <MenuButton
              disabled={!canPause}
              icon={<Pause aria-hidden="true" size={17} />}
              label="Pausar"
              onClick={() => {
                setOpen(false);
                onAction("pause");
              }}
            />
            <MenuButton
              disabled={!canMoveUp}
              icon={<Rows3 aria-hidden="true" size={17} />}
              label="Mover para cima"
              onClick={() => {
                setOpen(false);
                onAction("move_up");
              }}
            />
            <MenuButton
              disabled={!canMoveDown}
              icon={<Rows3 aria-hidden="true" size={17} />}
              label="Mover para baixo"
              onClick={() => {
                setOpen(false);
                onAction("move_down");
              }}
            />
            <MenuButton
              danger
              disabled={!canArchive}
              icon={<Archive aria-hidden="true" size={17} />}
              label="Arquivar"
              onClick={() => {
                setOpen(false);
                onAction("archive");
              }}
            />
          </div>
        </TESDialog>
      ) : null}
    </>
  );
}

function MenuButton({
  danger,
  disabled,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-extrabold transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50",
        danger ? "text-status-danger" : "text-brand-primary",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}
