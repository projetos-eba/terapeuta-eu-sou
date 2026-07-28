"use client";

import type { FormEvent } from "react";

import { TESButton } from "@/components/tes";

import type {
  AdminTherapy,
  AdminTherapyCatalogContract,
  AdminTherapyDraftCommand,
} from "../admin-therapy-catalog.types";

export function AdminTherapyEditor({
  categories,
  isSaving,
  onCancel,
  onSave,
  therapy,
}: {
  categories: AdminTherapyCatalogContract["categories"];
  isSaving: boolean;
  onCancel: () => void;
  onSave: (command: AdminTherapyDraftCommand) => Promise<void>;
  therapy: AdminTherapy | null;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await onSave({
      aliases: splitLines(String(form.get("aliases") ?? "")),
      benefits: splitLines(String(form.get("benefits") ?? "")).map((title) => ({
        description: null,
        iconKey: "heart",
        title,
      })),
      calendarColorKey: String(form.get("calendarColorKey") || "neutral"),
      categoryId: String(form.get("categoryId") ?? ""),
      description: nullable(String(form.get("description") ?? "")),
      faqs: splitLines(String(form.get("faqs") ?? "")).map((line) => {
        const [question, ...answer] = line.split("|");
        return {
          answer: answer.join("|").trim() || "Resposta editorial em revisão.",
          question: question.trim(),
        };
      }),
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
          <Field
            defaultValue={therapy?.calendarColorKey}
            label="Chave semântica de cor"
            name="calendarColorKey"
            placeholder="purple, green, orange, blue, pink, neutral"
          />
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
        <Textarea
          defaultValue={therapy?.publicContent.benefits
            .map((item) => item.title)
            .join("\n")}
          hint="Um item por linha. Evite promessas de resultado."
          label="Benefícios / experiência esperada"
          name="benefits"
        />
        <Textarea
          defaultValue={therapy?.publicContent.faqs
            .map((item) => `${item.question} | ${item.answer}`)
            .join("\n")}
          hint="Use o formato: Pergunta | Resposta"
          label="FAQs"
          name="faqs"
        />
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

      <Section title="Governança">
        <Textarea
          hint="Obrigatório para rastreabilidade administrativa."
          label="Motivo da alteração"
          name="reason"
          required
        />
        <div className="rounded-xl bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
          Publicar exige categoria ativa e conteúdo público mínimo. Disponível
          no Match não edita pesos; apenas usa configuração e versão publicada
          já existentes.
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
}: {
  defaultChecked?: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-lavender px-3 text-sm font-extrabold text-brand-deep">
      <input defaultChecked={defaultChecked} name={name} type="checkbox" />
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

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseFocalPoint(value: string): "center" | "left" | "right" {
  if (value === "left" || value === "right") return value;
  return "center";
}

function parseVisualTheme(value: string): "energy" | "oracle" | "systemic" {
  if (value === "oracle" || value === "systemic") return value;
  return "energy";
}
