"use client";

import { BookOpen, Sparkles } from "lucide-react";

import { TESButton } from "@/components/tes";
import { routes } from "@/lib/routes";

import type {
  TherapistProfileEditableFields,
  TherapistProfileEditorData,
} from "../therapist-profile-editor.types";
import {
  ProfileChipInput,
  ProfileFieldGroup,
  ProfileTextarea,
  ProfileTextField,
} from "./profile-field-group";
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

      <ProfileFieldGroup number={2} title="Sua apresentação">
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
        description="As terapias oferecidas vêm da área Suas terapias para evitar duplicidade de catálogo."
        number={3}
        title="Especialidades"
      >
        <div className="flex flex-wrap gap-3">
          {editor.derived.activeServiceCount > 0 ? (
            <span className="inline-flex min-h-11 items-center rounded-full border border-brand-lavender bg-white px-4 text-sm font-bold text-tesText-secondary shadow-card">
              {editor.derived.activeServiceCount} serviço
              {editor.derived.activeServiceCount === 1 ? "" : "s"} ativo
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
        description="Adicione os principais caminhos de cuidado que você apoia, sem prometer resultado."
        number={5}
        title="Como posso te guiar"
      >
        <ProfileChipInput
          addLabel="Adicionar item"
          items={fields.guideItems.map((item) => item.label)}
          label="Como posso te guiar"
          max={6}
          onChange={(items) =>
            updateField(
              "guideItems",
              items.map((item) => ({ icon: "sparkles", label: item })),
            )
          }
          placeholder="Novo caminho"
        />
      </ProfileFieldGroup>

      <ProfileFieldGroup
        description="Adicione conteúdos/reflexões para aparecer no seu perfil."
        number={6}
        title="Conteúdos / Reflexões"
      >
        {editor.capabilities.canUseAdvancedSections ? (
          <ProfileChipInput
            addLabel="Adicionar conteúdo"
            items={fields.reflections.map((item) => item.title)}
            label="Conteúdos e reflexões"
            max={6}
            onChange={(items) =>
              updateField(
                "reflections",
                items.map((item, index) => ({
                  excerpt: fields.reflections[index]?.excerpt ?? "",
                  href: fields.reflections[index]?.href ?? "",
                  imageUrl: fields.reflections[index]?.imageUrl ?? "",
                  minutesToRead: fields.reflections[index]?.minutesToRead ?? 3,
                  title: item,
                })),
              )
            }
            placeholder="Novo conteúdo"
          />
        ) : (
          <div className="grid gap-3 rounded-lg border border-brand-lavender bg-brand-lavenderSoft p-4 sm:grid-cols-[64px_1fr]">
            <div className="grid size-16 place-items-center rounded-lg bg-white text-brand-primary">
              <BookOpen aria-hidden="true" size={24} />
            </div>
            <div>
              <p className="text-sm font-extrabold leading-6 text-brand-deep">
                Conteúdos avançados disponíveis no Premium Plus.
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
                O downgrade não apaga dados já cadastrados, mas novas edições
                avançadas ficam bloqueadas pelo plano.
              </p>
              <TESButton
                className="mt-3 min-h-11 rounded-lg"
                href={routes.therapist.plan}
                variant="secondary"
              >
                Ver plano
              </TESButton>
            </div>
          </div>
        )}
      </ProfileFieldGroup>

      <div className="rounded-lg border border-brand-lavender bg-brand-lavenderSoft p-4">
        <div className="flex items-start gap-3">
          <Sparkles aria-hidden="true" className="mt-1 text-brand-primary" />
          <p className="text-sm font-semibold leading-6 text-tesText-secondary">
            As informações acima são exibidas no seu perfil público. Preços,
            horários, avaliações, documentos e dados administrativos continuam
            em suas fontes próprias e não são editados aqui.
          </p>
        </div>
      </div>
    </ProfileSection>
  );
}
