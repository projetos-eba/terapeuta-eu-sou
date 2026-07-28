import { Check, Info } from "lucide-react";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { ProfileSection } from "./profile-section";

export function ProfileStatus({
  editor,
}: {
  editor: TherapistProfileEditorData;
}) {
  const status = editor.derived.publicStatus;
  const statusCopy = publicStatusCopy(status);

  return (
    <ProfileSection title="Status do perfil">
      <div className="rounded-lg bg-status-successBg p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-status-success">
            {status === "published" ? (
              <Check aria-hidden="true" size={18} />
            ) : (
              <Info aria-hidden="true" size={18} />
            )}
          </span>
          <div>
            <p className="text-sm font-extrabold leading-6 text-status-success">
              {statusCopy.title}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-brand-deep">
              {statusCopy.description}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs font-bold leading-5 text-tesText-secondary">
        {publishedLabel(editor.published.publishedAt)}
      </p>
    </ProfileSection>
  );
}

function publicStatusCopy(status: string) {
  if (status === "published") {
    return {
      description:
        "Seu perfil público está visível para novos pacientes na plataforma.",
      title: "Seu perfil está publicado",
    };
  }
  if (status === "suspended") {
    return {
      description:
        "A administração pausou a visibilidade pública deste perfil.",
      title: "Perfil suspenso",
    };
  }
  if (status === "unpublished") {
    return {
      description: "Seu perfil não está aparecendo nas superfícies públicas.",
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
  }).format(new Date(publishedAt))}`;
}
