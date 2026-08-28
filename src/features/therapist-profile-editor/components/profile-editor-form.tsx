"use client";

import { Sparkles } from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

import type {
  TherapistProfileEditableFields,
  TherapistProfileEditorData,
} from "../therapist-profile-editor.types";
import {
  ProfileFieldGroup,
  ProfileTextarea,
  ProfileTextField,
} from "./profile-field-group";
import { ProfileGuideThemePicker } from "./profile-guide-theme-picker";
import { ProfileSection } from "./profile-section";

export function ProfileEditorForm({
  editor,
  fields,
  updateField,
}: {
  editor: TherapistProfileEditorData;
  fields: TherapistProfileEditableFields;
  updateField: <K extends keyof TherapistProfileEditableFields>(
    key: K,
    value: TherapistProfileEditableFields[K],
  ) => void;
}) {
  return (
    <ProfileSection className="grid gap-8" title="Informações principais">
      <ProfileFieldGroup number={1} title="Nome do perfil">
        <ProfileTextField
          id="publicName"
          label="Nome do perfil"
          onChange={(value) => updateField("publicName", value)}
          required
          value={fields.publicName}
        />
      </ProfileFieldGroup>

      <ProfileFieldGroup
        info="Sua apresentação é o texto curto que aparece perto do seu nome. Use este espaço para explicar, de forma direta e acolhedora, como você se apresenta e o que a pessoa pode esperar da sua página."
        number={2}
        title="Sua apresentação"
      >
        <ProfileTextarea
          id="shortIntro"
          label="Sua apresentação"
          maxLength={200}
          onChange={(value) => updateField("shortIntro", value)}
          rows={3}
          value={fields.shortIntro}
        />
      </ProfileFieldGroup>

      <ProfileFieldGroup
        description="As terapias que aparecem aqui são escolhidas em Suas terapias."
        number={3}
        title="Especialidades"
      >
        <div className="flex flex-wrap gap-3">
          {editor.derived.activeServiceCount > 0 ? (
            <span className="inline-flex min-h-11 items-center rounded-full border border-brand-lavender bg-white px-4 text-sm font-bold text-tesText-secondary shadow-card">
              {editor.derived.activeServiceCount} terapia
              {editor.derived.activeServiceCount === 1 ? "" : "s"} ativa
              {editor.derived.activeServiceCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-full border border-brand-lavender bg-brand-lavenderSoft px-4 text-sm font-bold text-brand-deep">
              Nenhuma terapia ativa ainda
            </span>
          )}
          <TESButton
            className="min-h-11 rounded-full"
            href={routes.therapist.services}
            variant="secondary"
          >
            Editar em Suas terapias
          </TESButton>
        </div>
      </ProfileFieldGroup>

      <ProfileFieldGroup
        description="Conte quem você é, sua abordagem e o que te inspira."
        info="Minha essência é o espaço para falar com mais profundidade sobre sua abordagem, seus valores e a forma como você conduz seu trabalho. Evite prometer resultados ou fazer diagnósticos."
        number={4}
        title="Minha essência"
      >
        <ProfileTextarea
          id="essenceBody"
          label="Minha essência"
          maxLength={600}
          onChange={(value) => updateField("essenceBody", value)}
          rows={5}
          value={fields.essenceBody}
        />
      </ProfileFieldGroup>

      <ProfileFieldGroup
        description="Escolha os temas da plataforma que mais representam como você pode acompanhar cada pessoa."
        number={5}
        title="Como posso te guiar"
      >
        <ProfileGuideThemePicker
          items={fields.guideItems}
          onChange={(items) => updateField("guideItems", items)}
        />
      </ProfileFieldGroup>

      <div className="rounded-lg border border-brand-lavender bg-brand-lavenderSoft p-4">
        <div className="flex items-start gap-3">
          <Sparkles aria-hidden="true" className="mt-1 text-brand-primary" />
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            As informações acima aparecem no seu perfil público. Preços,
            horários, avaliações, documentos e dados da conta ficam nas áreas
            correspondentes.
          </p>
        </div>
      </div>
    </ProfileSection>
  );
}
