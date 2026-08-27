import { Edit3, ExternalLink, Heart } from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
} from "@/components/app-page";
import { TESButton } from "@/components/tes";
import { TherapistProfilePage } from "@/features/therapist-profile/components/profile-page";
import type { TherapistProfileData } from "@/features/therapist-profile/types";
import { routes } from "@/lib/routes";

import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { ProfileCompletenessChecklist } from "./profile-completeness";
import { PublicProfileDesktopPreview } from "./public-profile-desktop-preview";
import { TherapistProfileRegistrationSurface } from "./therapist-profile-registration-surface";
import { ProfileInfoBanner, ProfileSection } from "./profile-section";
import { ProfileStatus } from "./profile-status";

export type TherapistProfilePublishedPreview =
  | {
      data: TherapistProfileData;
      status: "success";
    }
  | {
      status: "not_found" | "not_published" | "unavailable";
    };

export function TherapistProfileOverviewPage({
  editor,
  publishedPreview,
}: {
  editor: TherapistProfileEditorData;
  publishedPreview: TherapistProfilePublishedPreview;
}) {
  const hasRequiredDocuments = ["identity_document", "address_proof"].every(
    (kind) =>
      editor.privateDocuments.some(
        (item) => item.kind === kind && item.status !== "rejected",
      ),
  );
  const verificationStatus =
    editor.verificationSummary?.status ?? editor.derived.verificationStatus;

  if (verificationStatus !== "approved" || !hasRequiredDocuments) {
    return <TherapistProfileRegistrationSurface editor={editor} />;
  }

  return (
    <AppPageContainer className="gap-5">
      <AppPageHeader
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {editor.derived.publicStatus === "published" ? (
              <TESButton
                className="min-h-11 rounded-lg"
                href={editor.publicProfileHref}
                variant="secondary"
              >
                <ExternalLink aria-hidden="true" size={18} />
                Ver perfil público
              </TESButton>
            ) : null}
            <TESButton
              className="min-h-11 rounded-lg"
              href={routes.therapist.profileEdit}
            >
              <Edit3 aria-hidden="true" size={18} />
              Editar perfil
            </TESButton>
          </div>
        }
        title="Perfil público"
      >
        Gerencie como você é apresentado para o mundo.
      </AppPageHeader>

      <ProfileInfoBanner
        icon={<Heart aria-hidden="true" className="size-6" />}
        title="Mais pessoas podem entender seu trabalho quando seu perfil está completo e claro."
      >
        Um perfil bem cuidado transmite confiança, acolhimento e ajuda mais
        pessoas a te encontrar.
      </ProfileInfoBanner>

      {editor.draft ? (
        <ProfileSection className="border-brand-lavender bg-brand-lavenderSoft">
          <p className="text-sm font-extrabold leading-6 text-brand-deep">
            Existe um rascunho salvo.
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            A prévia abaixo mostra a versão pública atual. Para que o novo tema
            apareça aqui, publique o rascunho em Editar perfil. Depois da
            publicação, a atualização pode levar até 2 a 3 horas.
          </p>
        </ProfileSection>
      ) : null}

      <AppPageGrid>
        <AppPageMain>
          <ProfileSection
            className="overflow-hidden"
            description="A página completa aparece em visualização desktop. Para navegar ou interagir, abra seu perfil público."
            title="Prévia do perfil publicado"
          >
            {publishedPreview.status === "success" ? (
              <PublicProfileDesktopPreview>
                <TherapistProfilePage
                  mode="preview"
                  profile={publishedPreview.data.profile}
                  reviews={publishedPreview.data.reviews}
                />
              </PublicProfileDesktopPreview>
            ) : (
              <PublishedPreviewState status={publishedPreview.status} />
            )}
          </ProfileSection>
        </AppPageMain>

        <AppPageAside>
          <ProfileStatus editor={editor} />
          <ProfileCompletenessChecklist editor={editor} />
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}

function PublishedPreviewState({
  status,
}: {
  status: Exclude<TherapistProfilePublishedPreview["status"], "success">;
}) {
  const content = {
    not_found: {
      description:
        "A versão publicada ainda não está disponível para visualização. Confira o estado do perfil e tente novamente em instantes.",
      title: "Não foi possível encontrar seu perfil público",
    },
    not_published: {
      description:
        "A prévia aparecerá aqui assim que a versão do seu perfil estiver publicada para as pessoas.",
      title: "Seu perfil ainda não está publicado",
    },
    unavailable: {
      description:
        "Tente atualizar esta página em alguns instantes. Seus dados continuam preservados.",
      title: "Não foi possível carregar a prévia agora",
    },
  }[status];

  return (
    <div
      className="rounded-[16px] border border-brand-lavender bg-surface-muted p-5"
      role={status === "unavailable" ? "alert" : undefined}
    >
      <p className="text-base font-extrabold leading-6 text-brand-deep">
        {content.title}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        {content.description}
      </p>
    </div>
  );
}
