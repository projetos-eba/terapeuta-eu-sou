import { Check, Info } from "lucide-react";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { ProfileSection } from "./profile-section";

export function ProfileStatus({
  editor,
}: {
  editor: TherapistProfileEditorData;
}) {
  const status = editor.derived.publicStatus;
  const statusCopy = publicStatusCopy({
    isPubliclyVisible: editor.publication.isPubliclyVisible,
    needsReceivingAccount: editor.publication.needsReceivingAccount,
    status,
  });
  const isPubliclyVisible = editor.publication.isPubliclyVisible;

  return (
    <ProfileSection title="Status do perfil">
      <div
        className={
          isPubliclyVisible
            ? "rounded-lg bg-status-successBg p-4"
            : "rounded-lg bg-brand-lavenderSoft p-4"
        }
      >
        <div className="flex items-start gap-3">
          <span
            className={
              isPubliclyVisible
                ? "grid size-9 shrink-0 place-items-center rounded-full bg-white text-status-success"
                : "grid size-9 shrink-0 place-items-center rounded-full bg-white text-brand-primary"
            }
          >
            {isPubliclyVisible ? (
              <Check aria-hidden="true" size={18} />
            ) : (
              <Info aria-hidden="true" size={18} />
            )}
          </span>
          <div>
            <p
              className={
                isPubliclyVisible
                  ? "text-sm font-extrabold leading-6 text-status-success"
                  : "text-sm font-extrabold leading-6 text-brand-deep"
              }
            >
              {statusCopy.title}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-brand-deep">
              {statusCopy.description}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs font-bold leading-5 text-tesText-secondary">
        {isPubliclyVisible
          ? publishedLabel(editor.published.publishedAt)
          : "Seu perfil ainda não está visível para novas pessoas."}
      </p>
    </ProfileSection>
  );
}

function publicStatusCopy({
  isPubliclyVisible,
  needsReceivingAccount,
  status,
}: {
  isPubliclyVisible: boolean;
  needsReceivingAccount: boolean;
  status: string;
}) {
  if (isPubliclyVisible) {
    return {
      description:
        "Seu perfil público está visível para novos pacientes na plataforma.",
      title: "Seu perfil está publicado",
    };
  }
  if (needsReceivingAccount) {
    return {
      description:
        "Conclua sua conta de recebimento para que seu perfil fique visível para novas pessoas.",
      title: "Perfil aguardando conta de recebimento",
    };
  }
  if (status === "suspended") {
    return {
      description: "A equipe TES pausou a visibilidade pública deste perfil.",
      title: "Perfil suspenso",
    };
  }
  if (status === "unpublished") {
    return {
      description: "Seu perfil não está visível para as pessoas.",
      title: "Perfil despublicado",
    };
  }
  return {
    description: "Publique o perfil quando as informações estiverem prontas.",
    title: "Perfil em rascunho",
  };
}

function publishedLabel(publishedAt: string | null) {
  if (!publishedAt) return "Ainda não publicado.";
  return `Publicado em ${new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(publishedAt))}`;
}
