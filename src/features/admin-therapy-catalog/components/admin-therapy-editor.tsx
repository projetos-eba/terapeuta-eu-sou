"use client";

import {
  CalendarDays,
  Eye,
  ImagePlus,
  Info,
  Loader2,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";

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
  isSaving,
  matchingThemes,
  onCancel,
  onSave,
  therapy,
}: {
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
  const [preview, setPreview] = useState(() => ({
    aliases: therapy?.aliases ?? [],
    approachIconKey: normalizeTherapyIconKey(
      therapy?.publicContent.approachIconKey,
      "sparkles",
    ),
    approachLabel: therapy?.publicContent.approachLabel ?? "",
    calendarColorKey: normalizeColorKey(therapy?.calendarColorKey),
    complementaryDescription:
      therapy?.publicContent.complementaryDescription ?? "",
    description: therapy?.description ?? "",
    introduction: therapy?.publicContent.introduction ?? "",
    name: therapy?.name ?? "",
    shortDescription: therapy?.shortDescription ?? "",
    subtitle: therapy?.publicContent.subtitle ?? "",
  }));

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
            help="É o nome principal que as pessoas veem na página da terapia e nos cartões. Use um nome claro, como “Reiki”."
            label="Nome da terapia"
            name="name"
            onChange={(name) =>
              setPreview((current) => ({ ...current, name }))
            }
            placeholder="Ex.: Reiki"
            required
          />
          <Field
            defaultValue={therapy?.slug}
            help="É o endereço curto usado no link da página. Use letras minúsculas e hífens, como “reiki”. Não aparece como texto para as pessoas."
            label="Slug"
            name="slug"
            required
          />
          <ColorSelect
            defaultValue={therapy?.calendarColorKey}
            onChange={(calendarColorKey) =>
              setPreview((current) => ({ ...current, calendarColorKey }))
            }
          />
        </div>
        <Textarea
          defaultValue={therapy?.shortDescription}
          help="É uma frase curta para apresentar a terapia nos cartões do catálogo. Conte o que ela propõe, sem prometer resultados."
          hint="Ex.: Prática complementar de cuidado energético, com presença e escuta."
          label="Resumo curto"
          maxLength={contentLimits.shortDescription}
          name="shortDescription"
          onChange={(shortDescription) =>
            setPreview((current) => ({ ...current, shortDescription }))
          }
          required
        />
        <Textarea
          defaultValue={therapy?.description}
          help="Explique de forma simples como a terapia costuma ser apresentada. Este texto pode aparecer em “O que é” quando não houver uma explicação própria preenchida abaixo."
          hint="Ex.: No Reiki, a prática é apresentada como um cuidado complementar, feito com atenção, presença e respeito ao ritmo de cada pessoa."
          label="Como a terapia funciona"
          maxLength={contentLimits.description}
          name="description"
          onChange={(description) =>
            setPreview((current) => ({ ...current, description }))
          }
        />
        <Textarea
          defaultValue={therapy?.aliases.join("\n")}
          help="Inclua nomes pelos quais a terapia também é conhecida. Eles ajudam a equipe a localizar e evitar cadastros duplicados, mas não aparecem na página pública."
          hint="Um nome alternativo por linha. Ex.: Reiki Usui ou Terapia Reiki."
          label="Nomes alternativos"
          name="aliases"
          onChange={(value) =>
            setPreview((current) => ({
              ...current,
              aliases: splitLines(value),
            }))
          }
        />

      </Section>

      <Section title="Conteúdo público">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            defaultValue={therapy?.publicContent.subtitle}
            help="É a frase de apoio que aparece logo abaixo do nome, no topo da página pública. Use uma ideia acolhedora e objetiva, sem prometer resultados."
            label="Subtítulo"
            name="subtitle"
            onChange={(subtitle) =>
              setPreview((current) => ({ ...current, subtitle }))
            }
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
            help="É o pequeno selo que aparece acima do nome na página pública. Use uma expressão breve que ajude a situar a pessoa, como “Prática energética complementar”."
            label="Tipo de abordagem"
            name="approachLabel"
            onChange={(approachLabel) =>
              setPreview((current) => ({ ...current, approachLabel }))
            }
            placeholder="Ex.: Prática energética complementar"
          />
          <TherapyIconSelect
            defaultValue={therapy?.publicContent.approachIconKey}
            fallbackIconKey="sparkles"
            help="Escolha o ícone que acompanha o tipo de abordagem no selo público. Prefira um símbolo simples, relacionado à ideia principal da terapia."
            label="Ícone do tipo de abordagem"
            name="approachIconKey"
            onChange={(approachIconKey) =>
              setPreview((current) => ({ ...current, approachIconKey }))
            }
          />
          <SelectField
            defaultValue={therapy?.publicContent.visualThemeKey ?? "energy"}
            help="Define a atmosfera visual da página pública, como energia, oráculos ou sistêmico. Não muda o texto nem o funcionamento da terapia."
            label="Tema visual"
            name="visualThemeKey"
          >
            <option value="energy">Energia</option>
            <option value="oracle">Oráculos</option>
            <option value="systemic">Sistêmico</option>
          </SelectField>
          <SelectField
            defaultValue={therapy?.publicContent.heroFocalPoint ?? "center"}
            help="Escolha onde está a parte mais importante da imagem. Isso ajuda a manter o assunto visível no recorte do topo da página."
            label="Foco da imagem"
            name="heroFocalPoint"
          >
            <option value="left">Esquerda</option>
            <option value="center">Centro</option>
            <option value="right">Direita</option>
          </SelectField>
        </div>
        <Textarea
          defaultValue={therapy?.publicContent.introduction}
          help="É a explicação principal que aparece na seção “O que é” da página pública. Explique a prática em linguagem simples e responsável."
          hint="Ex.: O Reiki é apresentado como uma prática complementar de cuidado energético, com acompanhamento online e respeito ao ritmo de cada pessoa."
          label="O que é"
          maxLength={contentLimits.introduction}
          name="introduction"
          onChange={(introduction) =>
            setPreview((current) => ({ ...current, introduction }))
          }
        />
        <Textarea
          defaultValue={therapy?.publicContent.complementaryDescription}
          help="É um segundo parágrafo para completar a explicação da página pública. Use para contextualizar limites, formato online ou cuidado complementar."
          hint="Ex.: Dentro do TES, a prática é apresentada como um caminho complementar de autocuidado, sem substituir cuidados de saúde."
          label="Descrição complementar"
          maxLength={contentLimits.complementaryDescription}
          name="complementaryDescription"
          onChange={(complementaryDescription) =>
            setPreview((current) => ({
              ...current,
              complementaryDescription,
            }))
          }
        />
        <Textarea
          defaultValue={therapy?.publicContent.safetyNote}
          help="Registre um cuidado importante sobre a linguagem da terapia, sem prometer cura, diagnóstico ou resultado. Nesta versão, esse texto orienta a curadoria do catálogo e não aparece na página pública."
          hint="Ex.: Esta prática complementar não substitui acompanhamento médico, psicológico ou tratamento de saúde."
          label="Nota responsável"
          maxLength={contentLimits.safetyNote}
          name="safetyNote"
        />
        <TherapyPublicPreview preview={preview} />
        <Textarea
          defaultValue={therapy?.publicContent.highlights
            .map((item) => item.title)
            .join("\n")}
          help="São frases curtas que aparecem no topo da página pública para destacar aspectos da experiência. Use um destaque por linha e evite promessas de resultado."
          hint="Um destaque por linha. Ex.: Cuidado complementar com escuta e presença."
          label="Destaques"
          name="highlights"
        />
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-1">
              <h4 className="text-sm font-extrabold text-brand-deep">
                Benefícios / experiência esperada
              </h4>
              <FieldInfo label="Benefícios e experiência esperada">
                Descreva possibilidades de experiência, como pausa, presença ou
                organização interna. Evite afirmar cura, diagnóstico ou resultado
                garantido.
              </FieldInfo>
            </div>
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
                <TherapyIconSelect
                  defaultValue={benefit?.iconKey}
                  label={`Ícone visual ${index + 1}`}
                  name="benefitIconKey"
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
            Os temas podem ser múltiplos e conectam esta terapia à jornada do
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
          Publicar e disponibilizar para novos serviços exige de um a três temas
          ativos e conteúdo público mínimo. A presença no Match é independente.
          Refinamentos são
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
        <div className="flex items-center gap-1">
          <h4 className="text-base font-extrabold text-brand-deep">
            Imagem da terapia
          </h4>
          <FieldInfo label="Imagem da terapia">
            Use uma imagem que ajude a apresentar a terapia sem prometer
            resultados. A imagem fallback aparece nos cartões; a imagem hero
            aparece no topo da página da terapia.
          </FieldInfo>
        </div>
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
            help="É a imagem usada nos cartões do catálogo quando não houver uma imagem principal específica."
            label="Imagem fallback"
            name="imageUrl"
            onChange={onImageChange}
            placeholder="/therapies/reiki.png"
            value={imageUrl}
          />
          <Field
            help="É a imagem ampla do topo da página pública da terapia."
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

function TherapyIconSelect({
  defaultValue,
  fallbackIconKey = "heart",
  help,
  label,
  name,
  onChange,
}: {
  defaultValue?: string | null;
  fallbackIconKey?: string;
  help?: string;
  label: string;
  name: string;
  onChange?: (value: string) => void;
}) {
  const normalizedDefault = normalizeTherapyIconKey(defaultValue, fallbackIconKey);
  const [selectedIconKey, setSelectedIconKey] = useState(normalizedDefault);
  const selectId = useId();

  return (
    <div>
      <FormFieldLabel help={help} htmlFor={selectId} label={label} />
      <div className="flex min-h-11 items-center gap-2 rounded-xl border border-brand-lavender bg-white px-3 focus-within:ring-4 focus-within:ring-ring/20">
        <span className="text-brand-primary" aria-hidden="true">
          <DetailIcon iconKey={selectedIconKey} />
        </span>
        <select
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-brand-deep outline-none"
          id={selectId}
          name={name}
          onChange={(event) => {
            setSelectedIconKey(event.target.value);
            onChange?.(event.target.value);
          }}
          value={selectedIconKey}
        >
          {therapyDetailIconOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
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

function TherapyPublicPreview({
  preview,
}: {
  preview: {
    aliases: string[];
    approachIconKey: string;
    approachLabel: string;
    calendarColorKey: string;
    complementaryDescription: string;
    description: string;
    introduction: string;
    name: string;
    shortDescription: string;
    subtitle: string;
  };
}) {
  const name = preview.name.trim() || "Nome da terapia";
  const approachLabel = preview.approachLabel.trim() || "Tipo de abordagem";
  const subtitle =
    preview.subtitle.trim() ||
    "Aqui aparecerá uma frase de apoio abaixo do nome da terapia.";
  const shortDescription =
    preview.shortDescription.trim() ||
    "Aqui aparecerá o resumo curto que apresenta a terapia no catálogo.";
  const introduction =
    preview.introduction.trim() ||
    preview.description.trim() ||
    "Aqui aparecerá uma explicação simples sobre como a terapia é apresentada.";

  return (
    <section
      aria-labelledby="therapy-public-preview-title"
      className="rounded-2xl border border-brand-lavender bg-surface-soft p-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-brand-primary shadow-card">
          <Eye aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h4
            className="text-base font-extrabold text-brand-deep"
            id="therapy-public-preview-title"
          >
            Como as informações aparecem
          </h4>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Esta é uma prévia de orientação. Ela acompanha os campos acima e
            não publica nem salva alterações.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-brand-lavender bg-white p-4">
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-brand-lavenderSoft px-3 text-sm font-extrabold text-brand-primary">
            <DetailIcon iconKey={preview.approachIconKey} />
            {approachLabel}
          </span>
          <h5 className="mt-4 text-2xl font-extrabold text-brand-deep">
            {name}
          </h5>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {subtitle}
          </p>
          <p className="mt-4 text-xs font-bold text-tesText-secondary">
            No topo da página pública da terapia
          </p>
        </article>

        <article className="rounded-xl border border-brand-lavender bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-primary">
            Cartão do catálogo
          </p>
          <h5 className="mt-2 text-lg font-extrabold text-brand-deep">{name}</h5>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {shortDescription}
          </p>
          <p className="mt-4 text-xs font-bold text-tesText-secondary">
            Na lista pública de terapias
          </p>
        </article>
      </div>

      <article className="mt-4 rounded-xl border border-brand-lavender bg-white p-4">
        <h5 className="text-lg font-extrabold text-brand-deep">
          O que é {name}?
        </h5>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {introduction}
        </p>
        {preview.complementaryDescription.trim() ? (
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
            {preview.complementaryDescription.trim()}
          </p>
        ) : null}
        <p className="mt-4 text-xs font-bold text-tesText-secondary">
          Na explicação da página pública da terapia
        </p>
      </article>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="flex gap-3 rounded-xl bg-white px-3 py-3">
          <span
            aria-hidden="true"
            className={`mt-1 size-3 shrink-0 rounded-full ${calendarColorPreviewClass(preview.calendarColorKey)}`}
          />
          <div>
            <p className="flex items-center gap-2 text-sm font-extrabold text-brand-deep">
              <CalendarDays aria-hidden="true" className="size-4 text-brand-primary" />
              Agenda do terapeuta
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
              A cor escolhida ajuda a reconhecer esta terapia na agenda. Ela
              não é exibida como conteúdo na página pública.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl bg-white px-3 py-3">
          <Search aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand-primary" />
          <div>
            <p className="text-sm font-extrabold text-brand-deep">
              Busca administrativa
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-tesText-secondary">
              {preview.aliases.length > 0
                ? `Também encontrada por: ${preview.aliases.join(", ")}.`
                : "Os nomes alternativos ajudam a localizar a terapia aqui no catálogo; eles não aparecem publicamente."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FormFieldLabel({
  help,
  htmlFor,
  label,
}: {
  help?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-1">
      <label
        className="text-sm font-extrabold text-brand-deep"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {help ? <FieldInfo label={label}>{help}</FieldInfo> : null}
    </div>
  );
}

function FieldInfo({ children, label }: { children: ReactNode; label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span className="relative inline-flex">
      <button
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={`Entenda o campo ${label}`}
        className="-my-2 inline-grid size-11 place-items-center rounded-full text-brand-primary transition hover:bg-brand-lavenderSoft focus:outline-none focus:ring-4 focus:ring-ring/20"
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            event.currentTarget.blur();
          }
        }}
        type="button"
      >
        <Info aria-hidden="true" className="size-4" />
      </button>
      {isOpen ? (
        <span
          className="absolute left-0 top-full z-30 mt-2 w-72 rounded-xl border border-brand-lavender bg-white p-3 text-left text-sm font-semibold leading-5 text-tesText-secondary shadow-card"
          id={tooltipId}
          role="tooltip"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

function Field({
  defaultValue,
  help,
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
  help?: string;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  showCounter?: boolean;
  value?: string;
}) {
  const inputId = useId();

  return (
    <div>
      <FormFieldLabel help={help} htmlFor={inputId} label={label} />
      <input
        className="min-h-11 w-full rounded-xl border border-brand-lavender px-3 text-sm font-bold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        defaultValue={value === undefined ? defaultValue ?? "" : undefined}
        id={inputId}
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
    </div>
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

function calendarColorPreviewClass(colorKey: string) {
  const previewClasses: Record<string, string> = {
    blue: "bg-blue-500",
    cyan: "bg-cyan-500",
    green: "bg-emerald-500",
    lavender: "bg-violet-300",
    mint: "bg-teal-400",
    orange: "bg-orange-400",
    pink: "bg-pink-400",
    purple: "bg-brand-primary",
  };

  return previewClasses[colorKey] ?? "bg-slate-400";
}

function SelectField({
  children,
  defaultValue,
  help,
  label,
  name,
}: {
  children: ReactNode;
  defaultValue: string;
  help: string;
  label: string;
  name: string;
}) {
  const selectId = useId();

  return (
    <div>
      <FormFieldLabel help={help} htmlFor={selectId} label={label} />
      <select
        className="min-h-11 w-full rounded-xl border border-brand-lavender px-3 text-sm font-bold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        defaultValue={defaultValue}
        id={selectId}
        name={name}
      >
        {children}
      </select>
    </div>
  );
}

function ColorSelect({
  defaultValue,
  onChange,
}: {
  defaultValue?: string | null;
  onChange?: (value: string) => void;
}) {
  const selectId = useId();

  return (
    <div>
      <FormFieldLabel
        help="É uma cor de identificação usada na agenda do terapeuta e em marcadores internos. Escolha a que ajuda a diferenciar esta terapia visualmente; ela não muda o conteúdo nem aparece como informação na página pública."
        htmlFor={selectId}
        label="Cor de identificação"
      />
      <select
        className="min-h-11 w-full rounded-xl border border-brand-lavender px-3 text-sm font-bold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        defaultValue={normalizeColorKey(defaultValue)}
        id={selectId}
        name="calendarColorKey"
        onChange={(event) => onChange?.(event.target.value)}
      >
        {colorOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs font-bold text-tesText-secondary">
        Ajuda a reconhecer a terapia na agenda. Não é uma cor livre nem muda a
        aparência da página pública.
      </span>
    </div>
  );
}

function Textarea({
  defaultValue,
  help,
  hint,
  label,
  maxLength,
  name,
  onChange,
  required,
  showCounter = true,
}: {
  defaultValue?: string | null;
  help?: string;
  hint?: string;
  label: string;
  maxLength?: number;
  name: string;
  onChange?: (value: string) => void;
  required?: boolean;
  showCounter?: boolean;
}) {
  const [length, setLength] = useState(() => (defaultValue ?? "").length);
  const textareaId = useId();

  return (
    <div>
      <FormFieldLabel help={help} htmlFor={textareaId} label={label} />
      <textarea
        className="min-h-24 w-full rounded-xl border border-brand-lavender px-3 py-2 text-sm font-semibold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        defaultValue={defaultValue ?? ""}
        id={textareaId}
        maxLength={maxLength}
        name={name}
        onChange={(event) => {
          setLength(event.target.value.length);
          onChange?.(event.target.value);
        }}
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
    </div>
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

function normalizeTherapyIconKey(value?: string | null, fallbackIconKey = "heart") {
  return typeof value === "string" &&
    therapyDetailIconOptions.some((option) => option.key === value)
    ? value
    : fallbackIconKey;
}

function parseFocalPoint(value: string): "center" | "left" | "right" {
  if (value === "left" || value === "right") return value;
  return "center";
}

function parseVisualTheme(value: string): "energy" | "oracle" | "systemic" {
  if (value === "oracle" || value === "systemic") return value;
  return "energy";
}
