"use client";

import { Plus, Trash2 } from "lucide-react";
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
  const initialFaqs = therapy?.publicContent.faqs ?? [];
  const [benefitCount, setBenefitCount] = useState(() =>
    Math.max(2, initialBenefits.length),
  );
  const [selectedThemeIds, setSelectedThemeIds] = useState(() =>
    (therapy?.matchingThemeIds ?? []).slice(0, 3),
  );
  const [faqCount, setFaqCount] = useState(() =>
    Math.max(1, initialFaqs.length),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await onSave({
      aliases: splitLines(String(form.get("aliases") ?? "")),
      benefits: collectBenefits(form),
      calendarColorKey: String(form.get("calendarColorKey") || "neutral"),
      categoryId: String(form.get("categoryId") ?? ""),
      description: nullable(String(form.get("description") ?? "")),
      faqs: collectFaqs(form),
      highlights: splitLines(String(form.get("highlights") ?? "")).map(
        (title) => ({
          iconKey: "sparkles",
          title,
        }),
      ),
      imageUrl: nullable(String(form.get("imageUrl") ?? "")),
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
        heroImageUrl: nullable(String(form.get("heroImageUrl") ?? "")),
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
          name="shortDescription"
          required
        />
        <Textarea
          defaultValue={therapy?.description}
          label="Abordagem / descrição editorial"
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
          <Field
            defaultValue={therapy?.imageUrl}
            label="Imagem fallback"
            name="imageUrl"
            placeholder="/therapies/reiki.png"
          />
          <Field
            defaultValue={therapy?.publicContent.heroImageUrl}
            label="Imagem hero"
            name="heroImageUrl"
          />
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
          name="introduction"
        />
        <Textarea
          defaultValue={therapy?.publicContent.complementaryDescription}
          label="Descrição complementar"
          name="complementaryDescription"
        />
        <Textarea
          defaultValue={therapy?.publicContent.safetyNote}
          label="Nota responsável"
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
                  name="benefitDescription"
                  placeholder="Ex.: Apoia um momento de escuta e organização interna."
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
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-extrabold text-brand-deep">FAQs</h4>
            <p className="mt-1 text-xs font-bold text-tesText-secondary">
              Separe pergunta e resposta para revisar a experiência editorial
              com mais clareza.
            </p>
          </div>
          {Array.from({ length: faqCount }).map((_, index) => {
            const faq = initialFaqs[index];

            return (
              <div
                className="grid gap-3 rounded-xl border border-brand-lavender bg-surface-soft p-3 md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)_auto]"
                key={`faq-${index}`}
              >
                <Field
                  defaultValue={faq?.question}
                  label={`Pergunta ${index + 1}`}
                  name="faqQuestion"
                  placeholder="Ex.: Como acontece uma sessão online?"
                />
                <Textarea
                  defaultValue={faq?.answer}
                  label="Resposta"
                  name="faqAnswer"
                />
                {index === faqCount - 1 && faqCount > 1 ? (
                  <button
                    aria-label={`Remover FAQ ${index + 1}`}
                    className="mt-7 grid size-11 place-items-center rounded-full border border-brand-lavender text-brand-primary transition hover:bg-white"
                    onClick={() => setFaqCount((current) => current - 1)}
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
            onClick={() => setFaqCount((current) => current + 1)}
            type="button"
          >
            <Plus className="size-4" aria-hidden="true" />
            Adicionar FAQ
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
  placeholder,
  required,
}: {
  defaultValue?: string | null;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-extrabold text-brand-deep">
        {label}
      </span>
      <input
        className="min-h-11 w-full rounded-xl border border-brand-lavender px-3 text-sm font-bold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        defaultValue={defaultValue ?? ""}
        name={name}
        placeholder={placeholder}
        required={required}
      />
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
  name,
  required,
}: {
  defaultValue?: string | null;
  hint?: string;
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-extrabold text-brand-deep">
        {label}
      </span>
      <textarea
        className="min-h-24 w-full rounded-xl border border-brand-lavender px-3 py-2 text-sm font-semibold text-brand-deep outline-none focus:ring-4 focus:ring-ring/20"
        defaultValue={defaultValue ?? ""}
        name={name}
        required={required}
      />
      {hint ? (
        <span className="mt-1 block text-xs font-bold text-tesText-secondary">
          {hint}
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

function collectFaqs(form: FormData) {
  const questions = form.getAll("faqQuestion").map(String);
  const answers = form.getAll("faqAnswer").map(String);

  return questions
    .map((question, index) => ({
      answer: answers[index]?.trim() ?? "",
      question: question.trim(),
    }))
    .filter((faq) => faq.question.length > 0 && faq.answer.length > 0);
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
