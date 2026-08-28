"use client";

import { ImagePlus, Loader2, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { TESButton } from "@/components/tes";
import {
  DetailIcon,
  therapyDetailIconOptions,
} from "@/features/therapies/components/detail/detail-icons";

import type {
  AdminTherapy,
  AdminTherapyCatalogContract,
  AdminTherapyDraftCommand,
} from "../admin-therapy-catalog.types";

const contentLimits = {
  complementaryDescription: 200,
  description: 200,
  introduction: 160,
  safetyNote: 150,
  shortDescription: 100,
  benefitDescription: 100,
} as const;

export function AdminTherapyEditor({
  categories,
  isSaving,
  matchingThemes,
  onCancel,
  onSave,
  therapy,
}: {
  categories: AdminTherapyCatalogContract["categories"];
  isSaving: boolean;
  matchingThemes: AdminTherapyCatalogContract["matchingThemes"];
  onCancel: () => void;
  onSave: (command: AdminTherapyDraftCommand) => Promise<void>;
  therapy: AdminTherapy | null;
}) {
  const initialBenefits = therapy?.publicContent.benefits ?? [];
  const [benefitCount, setBenefitCount] = useState(() =>
    Math.max(2, initialBenefits.length),
  );
  const [selectedThemeIds, setSelectedThemeIds] = useState(() =>
    (therapy?.matchingThemeIds ?? []).slice(0, 3),
  );
  const [imageUrl, setImageUrl] = useState(therapy?.imageUrl ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(
    therapy?.publicContent.heroImageUrl ?? "",
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageUploadStatus, setImageUploadStatus] = useState<string | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);

    const lengthError = validateContentLengths(form);
    if (lengthError) {
      setFormError(lengthError);
      return;
    }

    if (selectedThemeIds.length < 1 || selectedThemeIds.length > 3) {
      setFormError("Selecione de 1 a 3 temas do Match antes de salvar.");
      return;
    }

    await onSave({
      aliases: splitLines(String(form.get("aliases") ?? "")),
      benefits: collectBenefits(form),
      calendarColorKey: String(form.get("calendarColorKey") || "neutral"),
      categoryId: String(form.get("categoryId") ?? ""),
      description: nullable(String(form.get("description") ?? "")),
      highlights: splitLines(String(form.get("highlights") ?? "")).map(
        (title) => ({
          iconKey: "sparkles",
          title,
        }),
      ),
      imageUrl: nullable(imageUrl),
      isAvailableForServices: form.get("isAvailableForServices") === "on",
      isFeatured: form.get("isFeatured") === "on",
      isPubliclyVisible: form.get("isPubliclyVisible") === "on",
      isVisibleInMatching: form.get("isVisibleInMatching") === "on",
      themeIds: selectedThemeIds,
      name: String(form.get("name") ?? "").trim(),
      publicContent: {
        approachIconKey: nullable(String(form.get("approachIconKey") ?? "")),
        approachLabel: nullable(String(form.get("approachLabel") ?? "")),
        complementaryDescription: nullable(
          String(form.get("complementaryDescription") ?? ""),
        ),
        heroFocalPoint: parseFocalPoint(
          String(form.get("heroFocalPoint") ?? ""),
        ),
        heroImageUrl: nullable(heroImageUrl),
        introduction: nullable(String(form.get("introduction") ?? "")),
        safetyNote: nullable(String(form.get("safetyNote") ?? "")),
        seoDescription: nullable(String(form.get("seoDescription") ?? "")),
        seoTitle: nullable(String(form.get("seoTitle") ?? "")),
        subtitle: nullable(String(form.get("subtitle") ?? "")),
        visualThemeKey: parseVisualTheme(
          String(form.get("visualThemeKey") ?? ""),
        ),
      },
      reason: String(form.get("reason") ?? "").trim(),
      shortDescription: String(form.get("shortDescription") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim(),
      therapyId: therapy?.id,
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {formError ? (
        <p
          aria-live="assertive"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
        >
          {formError}
        </p>
      ) : null}

      <Section title="Identidade">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            defaultValue={therapy?.name}
            label="Nome canônico"
            name="name"
            required
          />
          <Field
            defaultValue={therapy?.slug}
            label="Slug"
            name="slug"
            required
          />
          <label>
            <span className="mb-2 block text-sm font-extrabold text-brand-deep">
              Categoria
            </span>
            <select
              className="min-h-11 w-full rounded-xl border border-brand-lavender px-3 text-sm font-bold text-brand-deep"
              defaultValue={therapy?.categoryId ?? categories[0]?.id}
              name="categoryId"
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isActive ? "" : " (inativa)"}
                </option>
              ))}
            </select>
          </label>
          <ColorSelect defaultValue={therapy?.calendarColorKey} />
        </div>
        <Textarea
          defaultValue={therapy?.shortDescription}
          label="Resumo"
          maxLength={contentLimits.shortDescription}
          name="shortDescription"
          required
        />
        <Textarea
          defaultValue={therapy?.description}
          label="Abordagem / descrição editorial"
          maxLength={contentLimits.description}
          name="description"
        />
        <Textarea
          defaultValue={therapy?.aliases.join("\n")}
          hint="Uma variação por linha."
          label="Aliases"
          name="aliases"
        />
      </Section>

      <Section title="Conteúdo público">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            defaultValue={therapy?.publicContent.subtitle}
            label="Subtítulo"
            name="subtitle"
          />
          <div className="md:col-span-2">
            <TherapyImageField
              heroImageUrl={heroImageUrl}
              imageUploadError={imageUploadError}
              imageUploadStatus={imageUploadStatus}
              imageUrl={imageUrl}
              isUploading={isUploadingImage}
              onHeroImageChange={setHeroImageUrl}
              onImageChange={setImageUrl}
              onUpload={async (file) => {
                setImageUploadError(null);
                setImageUploadStatus(null);

                if (
                  !["image/jpeg", "image/png", "image/webp"].includes(file.type)
                ) {
                  setImageUploadError("Use uma imagem JPG, PNG ou WebP.");
                  return;
                }

                if (file.size > 5 * 1024 * 1024) {
                  setImageUploadError("A imagem deve ter no máximo 5 MB.");
                  return;
                }

                setIsUploadingImage(true);

                try {
                  const body = new FormData();
                  body.set("context", "therapy-image");
                  body.set("file", file);

                  const response = await fetch("/api/admin/media", {
                    body,
                    method: "POST",
                  });
                  const payload = (await response.json()) as {
                    data?: { publicUrl?: string };
                    error?: { message?: string };
                    ok?: boolean;
                  };

                  if (
                    !response.ok ||
                    !payload.ok ||
                    typeof payload.data?.publicUrl !== "string"
                  ) {
                    setImageUploadError(
                      payload.error?.message ??
                        "Não foi possível enviar a imagem agora.",
                    );
                    return;
                  }

                  const publicUrl = payload.data.publicUrl;
                  setImageUrl(publicUrl);
                  setHeroImageUrl((current) => current || publicUrl);
                  setImageUploadStatus(
                    "Imagem carregada. Salve o rascunho para aplicar a alteração.",
                  );
                } catch {
                  setImageUploadError(
                    "Não foi possível enviar a imagem agora. Tente novamente.",
                  );
                } finally {
                  setIsUploadingImage(false);
                }
              }}
            />
          </div>
          <Field
            defaultValue={therapy?.publicContent.approachLabel}
            label="Rótulo de abordagem"
            name="approachLabel"
          />
          <Field
            defaultValue={therapy?.publicContent.approachIconKey}
            label="Ícone semântico"
            name="approachIconKey"
            placeholder="sparkles"
          />
          <label>
            <span className="mb-2 block text-sm font-extrabold text-brand-deep">
              Tema visual
            </span>
            <select
              className="min-h-11 w-full rounded-xl border border-brand-lavender px-3 text-sm font-bold text-brand-deep"
              defaultValue={therapy?.publicContent.visualThemeKey ?? "energy"}
              name="visualThemeKey"
            >
              <option value="energy">Energia</option>
              <option value="oracle">Oráculos</option>
              <option value="systemic">Sistêmico</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-extrabold text-brand-deep">
              Foco da imagem
            </span>
            <select
              className="min-h-11 w-full rounded-xl border border-brand-lavender px-3 text-sm font-bold text-brand-deep"
              defaultValue={therapy?.publicContent.heroFocalPoint ?? "center"}
              name="heroFocalPoint"
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </label>
        </div>
        <Textarea
          defaultValue={therapy?.publicContent.introduction}
          label="O que é"
          maxLength={contentLimits.introduction}
          name="introduction"
        />
        <Textarea
          defaultValue={therapy?.publicContent.complementaryDescription}
          label="Descrição complementar"
          maxLength={contentLimits.complementaryDescription}
          name="complementaryDescription"
        />
        <Textarea
          defaultValue={therapy?.publicContent.safetyNote}
          label="Nota responsável"
          maxLength={contentLimits.safetyNote}
          name="safetyNote"
        />
        <Textarea
          defaultValue={therapy?.publicContent.highlights
            .map((item) => item.title)
            .join("\n")}
          hint="Um destaque por linha."
          label="Destaques"
          name="highlights"
        />
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-extrabold text-brand-deep">
              Benefícios / experiência esperada
            </h4>
            <p className="mt-1 text-xs font-bold text-tesText-secondary">
              Cadastre pelo menos dois benefícios. Evite promessa de resultado.
            </p>
          </div>
          {Array.from({ length: benefitCount }).map((_, index) => {
            const benefit = initialBenefits[index];
            const isRequired = index < 2;

            return (
              <div
                className="grid gap-3 rounded-xl border border-brand-lavender bg-surface-soft p-3 md:grid-cols-[minmax(0,0.28fr)_minmax(0,0.24fr)_minmax(0,0.48fr)_auto]"
                key={`benefit-${index}`}
              >
                <Field
                  defaultValue={benefit?.title}
                  label={`Benefício ${index + 1}`}
                  name="benefitTitle"
                  placeholder="Ex.: Pausa de presença"
                  required={isRequired}
                />
                <BenefitIconSelect
                  defaultValue={benefit?.iconKey}
                  index={index}
                />
                <Field
                  defaultValue={benefit?.description}
                  label="Descrição opcional"
                  maxLength={contentLimits.benefitDescription}
                  name="benefitDescription"
                  placeholder="Ex.: Apoia um momento de escuta e organização interna."
                  showCounter
                />
                {index === benefitCount - 1 && benefitCount > 2 ? (
                  <button
                    aria-label={`Remover benefício ${index + 1}`}
                    className="mt-7 grid size-11 place-items-center rounded-full border border-brand-lavender text-brand-primary transition hover:bg-white"
                    onClick={() => setBenefitCount((current) => current - 1)}
                    type="button"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                ) : (
                  <span aria-hidden="true" className="hidden md:block" />
                )}
              </div>
            );
          })}
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
            onClick={() => setBenefitCount((current) => current + 1)}
            type="button"
          >
            <Plus className="size-4" aria-hidden="true" />
            Adicionar benefício
          </button>
        </div>
      </Section>

      <Section title="Disponibilidade no produto">
        <div className="grid gap-3 md:grid-cols-2">
          <Checkbox
            defaultChecked={therapy?.isPubliclyVisible}
            label="Visível publicamente"
            name="isPubliclyVisible"
          />
          <Checkbox
            defaultChecked={therapy?.isAvailableForServices}
            label="Disponível para novos serviços"
            name="isAvailableForServices"
          />
          <Checkbox
            defaultChecked={therapy?.isVisibleInMatching}
            label="Disponível no Match"
            name="isVisibleInMatching"
          />
          <Checkbox
            defaultChecked={therapy?.isFeatured}
            label="Destaque editorial"
            name="isFeatured"
          />
        </div>
      </Section>

      <Section title="Temas do Match">
        <fieldset>
          <legend className="text-sm font-extrabold text-brand-deep">
            Selecione de 1 a 3 temas do Match para recomendar esta terapia
          </legend>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Categoria continua sendo uma classificação única da terapia. Temas
            do Match podem ser múltiplos e conectam esta terapia à jornada do
            paciente.
          </p>
          <p
            aria-live="polite"
            className="mt-2 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-primary"
          >
            {selectedThemeIds.length} de 3 temas selecionados
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {matchingThemes.map((theme) => {
              const selected = selectedThemeIds.includes(theme.id);
              const disabled = !selected && selectedThemeIds.length >= 3;

              return (
                <ThemePreviewOption
                  disabled={disabled}
                  key={theme.id}
                  onChange={() =>
                    setSelectedThemeIds((current) =>
                      current.includes(theme.id)
                        ? current.filter((id) => id !== theme.id)
                        : current.length >= 3
                          ? current
                          : [...current, theme.id],
                    )
                  }
                  selected={selected}
                  theme={theme}
                />
              );
            })}
          </div>
          {matchingThemes.length === 0 ? (
            <p className="mt-3 rounded-xl bg-surface-soft p-3 text-sm font-semibold text-tesText-secondary">
              Nenhum tema ativo identificado para edição administrativa.
            </p>
          ) : null}
        </fieldset>
      </Section>

      <Section title="Governança">
        <Textarea
          hint="Obrigatório para rastreabilidade administrativa."
          label="Motivo da alteração"
          name="reason"
          required
        />
        <div className="rounded-xl bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
          Publicar exige categoria ativa e conteúdo público mínimo. Disponível
          no Match exige de um a três temas canônicos. Refinamentos são
          escolhidos somente nos serviços dos terapeutas.
        </div>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <TESButton
          disabled={isSaving}
          onClick={onCancel}
          type="button"
          variant="secondary"
        >
          Cancelar
        </TESButton>
        <TESButton disabled={isSaving} type="submit" variant="gradient">
          {isSaving ? "Salvando..." : "Salvar rascunho"}
        </TESButton>
      </div>
    </form>
  );
}

function TherapyImageField({
  heroImageUrl,
  imageUploadError,
  imageUploadStatus,
  imageUrl,
  isUploading,
  onHeroImageChange,
  onImageChange,
  onUpload,
}: {
  heroImageUrl: string;
  imageUploadError: string | null;
  imageUploadStatus: string | null;
  imageUrl: string;
  isUploading: boolean;
  onHeroImageChange: (value: string) => void;
  onImageChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const previewUrl = imageUrl || heroImageUrl;

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragActive(false);
    if (isUploading) return;
    const file = event.dataTransfer.files[0];
    if (file) void onUpload(file);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-brand-lavender bg-surface-soft p-4">
      <div>
        <h4 className="text-base font-extrabold text-brand-deep">
          Imagem da terapia
        </h4>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Envie uma imagem para preencher a imagem fallback e, quando ainda
          estiver vazio, a imagem hero.
        </p>
      </div>

      <label
        className={`group grid min-h-40 cursor-pointer place-items-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition focus-within:ring-4 focus-within:ring-ring/20 ${
          isDragActive
            ? "border-brand-primary bg-brand-lavenderSoft"
            : "border-brand-lavender bg-white hover:border-brand-primary hover:bg-brand-lavenderSoft"
        } ${isUploading ? "cursor-wait opacity-70" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label="Selecionar imagem da terapia"
          className="sr-only"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void onUpload(file);
          }}
          type="file"
        />
        <span className="grid justify-items-center gap-2">
          {isUploading ? (
            <Loader2
              aria-hidden="true"
              className="size-8 animate-spin text-brand-primary"
            />
          ) : (
            <UploadCloud
              aria-hidden="true"
              className="size-8 text-brand-primary"
            />
          )}
          <span className="text-base font-extrabold text-brand-deep">
            {isUploading
              ? "Enviando imagem..."
              : "Escolha uma imagem ou arraste e solte aqui"}
          </span>
          <span className="text-sm font-semibold text-tesText-secondary">
            JPG, PNG ou WebP · até 5 MB
          </span>
          {!isUploading ? (
            <span className="mt-1 inline-flex min-h-11 items-center rounded-full bg-brand-primary px-4 text-sm font-extrabold text-white">
              Escolher arquivo
            </span>
          ) : null}
        </span>
      </label>

      {imageUploadError ? (
        <p
          aria-live="assertive"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800"
        >
          {imageUploadError}
        </p>
      ) : null}
      {imageUploadStatus ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand-primary"
        >
          {imageUploadStatus}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,0.32fr)_minmax(0,0.68fr)]">
        <div className="relative overflow-hidden rounded-xl border border-brand-lavender bg-white">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Prévia da imagem da terapia"
              className="aspect-[16/9] h-full w-full object-cover"
              src={previewUrl}
            />
          ) : (
            <div className="grid aspect-[16/9] place-items-center gap-2 bg-brand-lavenderSoft p-4 text-center text-sm font-bold text-brand-primary">
              <ImagePlus aria-hidden="true" className="size-6" />
              Sem imagem selecionada
            </div>
          )}
          {previewUrl ? (
            <button
              aria-label="Remover imagens da terapia"
              className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-white/95 text-brand-primary shadow-card transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-ring/20"
              onClick={() => {
                onImageChange("");
                onHeroImageChange("");
              }}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="grid gap-4">
          <Field
            label="Imagem fallback"
            name="imageUrl"
            onChange={onImageChange}
            placeholder="/therapies/reiki.png"
            value={imageUrl}
          />
          <Field
            label="Imagem hero"
            name="heroImageUrl"
            onChange={onHeroImageChange}
            value={heroImageUrl}
          />
        </div>
      </div>
    </div>
  );
}

function ThemePreviewOption({
  disabled,
  onChange,
  selected,
  theme,
}: {
  disabled: boolean;
  onChange: () => void;
  selected: boolean;
  theme: AdminTherapyCatalogContract["matchingThemes"][number];
}) {
  return (
    <label className="group relative grid cursor-pointer gap-3 overflow-hidden rounded-2xl border border-brand-lavender bg-white p-3 text-left shadow-card transition hover:border-brand-primary has-[:checked]:border-brand-primary has-[:checked]:ring-4 has-[:checked]:ring-ring/20 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55">
      <input
        aria-label={theme.name}
        checked={selected}
        className="peer absolute right-4 top-4 size-5 accent-brand-primary"
        disabled={disabled}
        name="themeIds"
        onChange={onChange}
        type="checkbox"
        value={theme.id}
      />
      <ThemeImage imageUrl={theme.imageUrl} name={theme.name} />
      <span className="pr-8 text-sm font-extrabold leading-5 text-brand-deep">
        {theme.name}
      </span>
      <span className="text-xs font-bold text-tesText-secondary">
        {theme.slug}
      </span>
    </label>
  );
}

function BenefitIconSelect({
  defaultValue,
  index,
}: {
  defaultValue?: string | null;
  index: number;
}) {
  const normalizedDefault = normalizeTherapyIconKey(defaultValue);
  const [selectedIconKey, setSelectedIconKey] = useState(normalizedDefault);

  return (
    <label>
      <span className="mb-2 block text-sm font-extrabold text-brand-deep">
        Ícone visual {index + 1}
      </span>
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-brand-lavender bg-white px-3 focus-within:ring-4 focus-within:ring-ring/20">
        <span className="text-brand-primary" aria-hidden="true">
          <DetailIcon iconKey={selectedIconKey} />
        </span>
        <select
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-brand-deep outline-none"
          name="benefitIconKey"
          onChange={(event) => setSelectedIconKey(event.target.value)}
          value={selectedIconKey}
        >
          {therapyDetailIconOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function ThemeImage({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  if (!imageUrl) {
    return (
      <span className="grid aspect-[16/9] place-items-center rounded-xl bg-brand-lavenderSoft text-xs font-extrabold text-brand-primary">
        Sem imagem
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={`Previa visual de ${name}`}
      className="aspect-[16/9] w-full rounded-xl bg-brand-lavenderSoft object-cover"
      loading="lazy"
      src={imageUrl}
      title={name}
    />
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-brand-lavender bg-white p-4">
      <h3 className="text-lg font-extrabold text-brand-deep">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  defaultValue,
  label,
  name,
  onChange,
  placeholder,
  maxLength,
  required,
  showCounter = false,
  value,
}: {
  defaultValue?: string | null;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  showCounter?: boolean;
  value?: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-extrabold text-brand-deep">
        {label}
      </span>
      <input
        className="min-h-11 w-full rounded-xl border border-brand-lavender px-3 text-sm font-bold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        defaultValue={value === undefined ? defaultValue ?? "" : undefined}
        name={name}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        value={value}
      />
      {showCounter && maxLength ? (
        <span className="mt-1 block text-right text-xs font-bold text-tesText-secondary">
          Limite de {maxLength} caracteres
        </span>
      ) : null}
    </label>
  );
}

const colorOptions = [
  { label: "Roxo", value: "purple" },
  { label: "Lavanda", value: "lavender" },
  { label: "Azul", value: "blue" },
  { label: "Ciano", value: "cyan" },
  { label: "Verde", value: "green" },
  { label: "Menta", value: "mint" },
  { label: "Laranja", value: "orange" },
  { label: "Rosa", value: "pink" },
  { label: "Neutro", value: "neutral" },
] as const;

function ColorSelect({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-extrabold text-brand-deep">
        Chave semântica de cor
      </span>
      <select
        className="min-h-11 w-full rounded-xl border border-brand-lavender px-3 text-sm font-bold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        defaultValue={normalizeColorKey(defaultValue)}
        name="calendarColorKey"
      >
        {colorOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs font-bold text-tesText-secondary">
        Essa chave não é uma cor livre: ela mapeia a terapia para tokens visuais
        seguros do TES em calendários, badges e estados.
      </span>
    </label>
  );
}

function Textarea({
  defaultValue,
  hint,
  label,
  maxLength,
  name,
  required,
  showCounter = true,
}: {
  defaultValue?: string | null;
  hint?: string;
  label: string;
  maxLength?: number;
  name: string;
  required?: boolean;
  showCounter?: boolean;
}) {
  const [length, setLength] = useState(() => (defaultValue ?? "").length);

  return (
    <label>
      <span className="mb-2 block text-sm font-extrabold text-brand-deep">
        {label}
      </span>
      <textarea
        className="min-h-24 w-full rounded-xl border border-brand-lavender px-3 py-2 text-sm font-semibold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        defaultValue={defaultValue ?? ""}
        maxLength={maxLength}
        name={name}
        onChange={(event) => setLength(event.target.value.length)}
        required={required}
      />
      {hint ? (
        <span className="mt-1 block text-xs font-bold text-tesText-secondary">
          {hint}
        </span>
      ) : null}
      {showCounter && maxLength ? (
        <span
          className={`mt-1 block text-right text-xs font-bold ${length > maxLength ? "text-red-700" : "text-tesText-secondary"}`}
        >
          {length}/{maxLength}
        </span>
      ) : null}
    </label>
  );
}

function Checkbox({
  defaultChecked,
  label,
  name,
  value,
}: {
  defaultChecked?: boolean;
  label: string;
  name: string;
  value?: string;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-lavender px-3 text-sm font-extrabold text-brand-deep">
      <input
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
        value={value}
      />
      {label}
    </label>
  );
}

function splitLines(value: string) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectBenefits(form: FormData) {
  const titles = form.getAll("benefitTitle").map(String);
  const descriptions = form.getAll("benefitDescription").map(String);
  const iconKeys = form.getAll("benefitIconKey").map(String);

  return titles
    .map((title, index) => ({
      description: nullable(descriptions[index] ?? ""),
      iconKey: normalizeTherapyIconKey(iconKeys[index]),
      title: title.trim(),
    }))
    .filter((benefit) => benefit.title.length > 0);
}

function validateContentLengths(form: FormData) {
  const fields = [
    ["shortDescription", contentLimits.shortDescription, "O resumo"],
    ["description", contentLimits.description, "A abordagem"],
    ["introduction", contentLimits.introduction, "O campo O que é"],
    [
      "complementaryDescription",
      contentLimits.complementaryDescription,
      "A descrição complementar",
    ],
    ["safetyNote", contentLimits.safetyNote, "A nota responsável"],
  ] as const;

  for (const [name, limit, label] of fields) {
    if (String(form.get(name) ?? "").length > limit) {
      return `${label} deve ter no máximo ${limit} caracteres.`;
    }
  }

  for (const description of form.getAll("benefitDescription")) {
    if (String(description).length > contentLimits.benefitDescription) {
      return `A descrição opcional do benefício deve ter no máximo ${contentLimits.benefitDescription} caracteres.`;
    }
  }

  return null;
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeColorKey(value?: string | null) {
  return typeof value === "string" &&
    colorOptions.some((option) => option.value === value)
    ? value
    : "neutral";
}

function normalizeTherapyIconKey(value?: string | null) {
  return typeof value === "string" &&
    therapyDetailIconOptions.some((option) => option.key === value)
    ? value
    : "heart";
}

function parseFocalPoint(value: string): "center" | "left" | "right" {
  if (value === "left" || value === "right") return value;
  return "center";
}

function parseVisualTheme(value: string): "energy" | "oracle" | "systemic" {
  if (value === "oracle" || value === "systemic") return value;
  return "energy";
}
