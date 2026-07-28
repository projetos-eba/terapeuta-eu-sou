import { Edit3, ExternalLink, Heart } from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
} from "@/components/app-page";
import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

import { mapEditorFieldsToPublicPreview } from "../therapist-profile-editor.mappers";
import type { TherapistProfileEditorData } from "../therapist-profile-editor.types";
import { ProfileCompletenessChecklist } from "./profile-completeness";
import { ProfileInfoBanner, ProfileSection } from "./profile-section";
import { ProfileStatus } from "./profile-status";
import { PublicProfileSnapshot } from "./public-profile-snapshot";

export function TherapistProfileOverviewPage({
  editor,
}: {
  editor: TherapistProfileEditorData;
}) {
  const publishedProfile = mapEditorFieldsToPublicPreview({
    editor,
    fields: editor.published.fields,
  });

  return (
    <AppPageContainer className="gap-5">
      <AppPageHeader
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TESButton
              className="min-h-11 rounded-lg"
              href={editor.publicProfileHref}
              variant="secondary"
            >
              <ExternalLink aria-hidden="true" size={18} />
              Ver perfil público
            </TESButton>
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
            A prévia abaixo mostra a versão pública atual. Para publicar o
            rascunho, acesse Editar perfil.
          </p>
        </ProfileSection>
      ) : null}

      <AppPageGrid>
        <AppPageMain>
          <PublicProfileSnapshot profile={publishedProfile} />
        </AppPageMain>

        <AppPageAside>
          <ProfileStatus editor={editor} />
          <ProfileCompletenessChecklist editor={editor} />
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}
