"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ImagePlus,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { TESButton, TESDialog } from "@/components/tes";
import type {
  AdminMatchingContract,
  AdminMatchingInterest,
  AdminMatchingTheme,
} from "../admin-matching.types";
import {
  createStableRequestId,
  sendAdminMatchingCommand,
} from "../admin-matching.commands";

type AdminMatchingPageProps = {
  initialMatching: AdminMatchingContract;
};

type ThemeDraft = {
  description: string;
  imageUrl: string;
  name: string;
  reason: string;
  slug: string;
  sortOrder: string;
  themeId?: string;
};

type InterestDraft = {
  interestId?: string;
  name: string;
  reason: string;
  slug: string;
  sortOrder: string;
  themeId: string;
};

type TransitionDraft = {
  action: "activate" | "deactivate";
  entityId: string;
  entityName: string;
  entityType: "theme" | "interest";
  reason: string;
};

const emptyThemeDraft: ThemeDraft = {
  description: "",
  imageUrl: "",
  name: "",
  reason: "",
  slug: "",
  sortOrder: "0",
};

export function AdminMatchingPage({ initialMatching }: AdminMatchingPageProps) {
  const [matching, setMatching] = useState(initialMatching);
  const [query, setQuery] = useState("");
  const [themeDraft, setThemeDraft] = useState<ThemeDraft | null>(null);
  const [isThemeSlugTouched, setIsThemeSlugTouched] = useState(false);
  const [interestDraft, setInterestDraft] = useState<InterestDraft | null>(
    null,
  );
  const [isInterestSlugTouched, setIsInterestSlugTouched] = useState(false);
  const [transitionDraft, setTransitionDraft] =
    useState<TransitionDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [themeUploadStatus, setThemeUploadStatus] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  const filteredThemes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return matching.themes;

    return matching.themes.filter((theme) => {
      const interestMatch = theme.interests.some((interest) =>
        `${interest.name} ${interest.slug}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized),
      );

      return (
        `${theme.name} ${theme.slug}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized) || interestMatch
      );
    });
  }, [matching.themes, query]);

  const activeThemeCount = matching.themes.filter(
    (theme) => theme.isActive,
  ).length;
  const interestCount = matching.themes.reduce(
    (total, theme) => total + theme.interests.length,
    0,
  );
  const impactedServiceCount = matching.themes.reduce(
    (total, theme) =>
      total +
      theme.serviceCount +
      theme.interests.reduce(
        (interestTotal, interest) => interestTotal + interest.serviceCount,
        0,
      ),
    0,
  );

  function openTheme(theme?: AdminMatchingTheme) {
    setError(null);
    setThemeUploadStatus(null);
    setIsThemeSlugTouched(Boolean(theme));
    setThemeDraft(
      theme
        ? {
            description: theme.description,
            imageUrl: theme.imageUrl ?? "",
            name: theme.name,
            reason: "",
            slug: theme.slug,
            sortOrder: String(theme.sortOrder),
            themeId: theme.id,
          }
        : emptyThemeDraft,
    );
  }

  function openInterest(
    theme: AdminMatchingTheme,
    interest?: AdminMatchingInterest,
  ) {
    setError(null);
    setIsInterestSlugTouched(Boolean(interest));
    setInterestDraft(
      interest
        ? {
            interestId: interest.id,
            name: interest.name,
            reason: "",
            slug: interest.slug,
            sortOrder: String(interest.sortOrder),
            themeId: theme.id,
          }
        : {
            name: "",
            reason: "",
            slug: "",
            sortOrder: String(theme.interests.length + 1),
            themeId: theme.id,
          },
    );
  }

  async function submitTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!themeDraft) return;

    setIsSaving(true);
    setError(null);
    const result = await sendAdminMatchingCommand({
      action: "matchingSaveTheme",
      payload: {
        description: themeDraft.description.trim(),
        imageUrl: themeDraft.imageUrl.trim() || null,
        name: themeDraft.name.trim(),
        reason: themeDraft.reason.trim(),
        slug: themeDraft.slug.trim(),
        sortOrder: Number(themeDraft.sortOrder) || 0,
        themeId: themeDraft.themeId,
      },
      requestId: createStableRequestId(),
    });
    applyResult(result, () => setThemeDraft(null));
  }

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!interestDraft) return;

    setIsSaving(true);
    setError(null);
    const result = await sendAdminMatchingCommand({
      action: "matchingSaveInterest",
      payload: {
        interestId: interestDraft.interestId,
        name: interestDraft.name.trim(),
        reason: interestDraft.reason.trim(),
        slug: interestDraft.slug.trim(),
        sortOrder: Number(interestDraft.sortOrder) || 0,
        themeId: interestDraft.themeId,
      },
      requestId: createStableRequestId(),
    });
    applyResult(result, () => setInterestDraft(null));
  }

  async function submitTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transitionDraft) return;

    setIsSaving(true);
    setError(null);
    const result = await sendAdminMatchingCommand({
      action: "matchingTransition",
      entityId: transitionDraft.entityId,
      entityType: transitionDraft.entityType,
      matchingAction: transitionDraft.action,
      reason: transitionDraft.reason.trim(),
      requestId: createStableRequestId(),
    });
    applyResult(result, () => setTransitionDraft(null));
  }

  function applyResult(
    result: Awaited<ReturnType<typeof sendAdminMatchingCommand>>,
    onSuccess: () => void,
  ) {
    setIsSaving(false);
    if (result.status === "success") {
      setMatching(result.matching);
      onSuccess();
      return;
    }

    setError(result.error.message);
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <section className="rounded-2xl border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
              Governança
            </p>
            <h1 className="mt-3 font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
              Match
            </h1>
            <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-tesText-secondary">
              Temas recomendam terapias. Refinamentos recomendam profissionais
              dentro da terapia escolhida.
            </p>
          </div>
          <TESButton onClick={() => openTheme()} className="min-h-12">
            <Plus className="size-4" />
            Novo tema
          </TESButton>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Temas ativos" value={activeThemeCount} />
        <MetricCard label="Refinamentos" value={interestCount} />
        <MetricCard
          label="Vínculos operacionais"
          value={impactedServiceCount}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-4">
          <label className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-white px-4 shadow-sm">
            <Search className="size-4 text-brand-primary" aria-hidden="true" />
            <span className="sr-only">Buscar temas e refinamentos</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 flex-1 bg-transparent text-sm font-bold text-tesText-primary outline-none"
              placeholder="Buscar por nome ou slug"
            />
          </label>

          {filteredThemes.map((theme) => (
            <ThemePanel
              key={theme.id}
              onEditInterest={openInterest}
              onEditTheme={openTheme}
              onTransition={setTransitionDraft}
              theme={theme}
            />
          ))}

          {filteredThemes.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-brand-lavender bg-white p-8 text-center">
              <h2 className="text-lg font-extrabold text-brand-deep">
                Nenhum resultado para a busca
              </h2>
              <p className="mt-2 text-sm font-semibold text-tesText-secondary">
                Ajuste o termo ou crie um novo tema do Match.
              </p>
            </section>
          ) : null}
        </main>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-brand-lavender bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-lavenderSoft text-brand-primary">
                <SlidersHorizontal aria-hidden="true" className="size-5" />
              </span>
              <h2 className="text-lg font-extrabold text-brand-deep">
                Regras ativas
              </h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm font-semibold leading-6 text-tesText-secondary">
              <li>Cliente seleciona até três temas.</li>
              <li>Refinamentos são opcionais e limitados a três por tema.</li>
              <li>Terapias são ranqueadas somente por temas coincidentes.</li>
              <li>Profissionais são ordenados por refinamentos no serviço.</li>
              <li>Desativação preserva histórico e exige motivo.</li>
            </ul>
          </section>
        </aside>
      </div>

      {themeDraft ? (
        <TESDialog
          description="Informe nome, slug, ordem e motivo para auditoria."
          onClose={() => setThemeDraft(null)}
          title={themeDraft.themeId ? "Editar tema" : "Novo tema"}
        >
          <form onSubmit={submitTheme} className="space-y-4">
            <TextField
              label="Nome"
              value={themeDraft.name}
              onChange={(value) =>
                setThemeDraft({
                  ...themeDraft,
                  name: value,
                  slug: isThemeSlugTouched
                    ? themeDraft.slug
                    : slugifyMatchEntity(value),
                })
              }
              required
            />
            <TextField
              label="Slug"
              value={themeDraft.slug}
              onChange={(value) => {
                setIsThemeSlugTouched(true);
                setThemeDraft({
                  ...themeDraft,
                  slug: slugifyMatchEntity(value),
                });
              }}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
            <TextField
              label="Descrição"
              value={themeDraft.description}
              onChange={(value) =>
                setThemeDraft({ ...themeDraft, description: value })
              }
              required
            />
            <ThemeImageField
              value={themeDraft.imageUrl}
              uploadStatus={themeUploadStatus}
              onChange={(value) =>
                setThemeDraft({ ...themeDraft, imageUrl: value })
              }
              onUpload={async (file) => {
                setThemeUploadStatus("Enviando imagem...");
                const result = await uploadThemeImage(file);
                if (result.ok) {
                  setThemeDraft((current) => ({
                    ...(current ?? themeDraft),
                    imageUrl: result.publicUrl,
                  }));
                  setThemeUploadStatus("Imagem enviada com sucesso.");
                  return;
                }

                setThemeUploadStatus(result.message);
              }}
            />
            <TextField
              label="Ordem"
              type="number"
              value={themeDraft.sortOrder}
              onChange={(value) =>
                setThemeDraft({ ...themeDraft, sortOrder: value })
              }
              required
            />
            <TextArea
              label="Motivo"
              value={themeDraft.reason}
              onChange={(value) =>
                setThemeDraft({ ...themeDraft, reason: value })
              }
              required
            />
            <DialogActions error={error} isSaving={isSaving} />
          </form>
        </TESDialog>
      ) : null}

      {interestDraft ? (
        <TESDialog
          description="Refinamentos sempre pertencem ao tema selecionado."
          onClose={() => setInterestDraft(null)}
          title={
            interestDraft.interestId ? "Editar refinamento" : "Novo refinamento"
          }
        >
          <form onSubmit={submitInterest} className="space-y-4">
            <TextField
              label="Nome"
              value={interestDraft.name}
              onChange={(value) =>
                setInterestDraft({
                  ...interestDraft,
                  name: value,
                  slug: isInterestSlugTouched
                    ? interestDraft.slug
                    : slugifyMatchEntity(value),
                })
              }
              required
            />
            <TextField
              label="Slug"
              value={interestDraft.slug}
              onChange={(value) => {
                setIsInterestSlugTouched(true);
                setInterestDraft({
                  ...interestDraft,
                  slug: slugifyMatchEntity(value),
                });
              }}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
            <TextField
              label="Ordem"
              type="number"
              value={interestDraft.sortOrder}
              onChange={(value) =>
                setInterestDraft({ ...interestDraft, sortOrder: value })
              }
              required
            />
            <TextArea
              label="Motivo"
              value={interestDraft.reason}
              onChange={(value) =>
                setInterestDraft({ ...interestDraft, reason: value })
              }
              required
            />
            <DialogActions error={error} isSaving={isSaving} />
          </form>
        </TESDialog>
      ) : null}

      {transitionDraft ? (
        <TESDialog
          description="Ação com impacto operacional e registro de auditoria."
          onClose={() => setTransitionDraft(null)}
          title={
            transitionDraft.action === "activate"
              ? "Ativar no Match"
              : "Desativar no Match"
          }
        >
          <form onSubmit={submitTransition} className="space-y-4">
            <p className="text-sm font-semibold leading-6 text-tesText-secondary">
              {transitionDraft.entityName}
            </p>
            <TextArea
              label="Motivo"
              value={transitionDraft.reason}
              onChange={(value) =>
                setTransitionDraft({ ...transitionDraft, reason: value })
              }
              required
            />
            <DialogActions error={error} isSaving={isSaving} />
          </form>
        </TESDialog>
      ) : null}
    </div>
  );
}

function ThemePanel({
  onEditInterest,
  onEditTheme,
  onTransition,
  theme,
}: {
  onEditInterest: (
    theme: AdminMatchingTheme,
    interest?: AdminMatchingInterest,
  ) => void;
  onEditTheme: (theme: AdminMatchingTheme) => void;
  onTransition: (draft: TransitionDraft) => void;
  theme: AdminMatchingTheme;
}) {
  return (
    <section className="rounded-2xl border border-brand-lavender bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-lavenderSoft text-brand-primary">
            <GitBranch aria-hidden="true" className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-brand-deep">
                {theme.name}
              </h2>
              <StatusBadge isActive={theme.isActive} />
            </div>
            <p className="mt-1 text-sm font-bold text-tesText-secondary">
              {theme.slug} · ordem {theme.sortOrder}
            </p>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
              {theme.description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconAction label="Editar tema" onClick={() => onEditTheme(theme)}>
            <Pencil className="size-4" />
          </IconAction>
          <button
            type="button"
            onClick={() =>
              onTransition({
                action: theme.isActive ? "deactivate" : "activate",
                entityId: theme.id,
                entityName: theme.name,
                entityType: "theme",
                reason: "",
              })
            }
            className="min-h-10 rounded-full border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
          >
            {theme.isActive ? "Desativar" : "Ativar"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ImpactPill label="Terapias" value={theme.therapyCount} />
        <ImpactPill label="Serviços" value={theme.serviceCount} />
        <ImpactPill label="Refinamentos" value={theme.interests.length} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-primary">
            Refinamentos
          </h3>
          <button
            type="button"
            onClick={() => onEditInterest(theme)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
          >
            <Plus className="size-4" />
            Novo
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {theme.interests.map((interest) => (
            <div
              key={interest.id}
              className="rounded-md border border-border bg-brand-lavenderSoft/40 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold text-brand-deep">
                      {interest.name}
                    </p>
                    <StatusBadge isActive={interest.isActive} />
                  </div>
                  <p className="mt-1 text-xs font-bold text-tesText-secondary">
                    {interest.slug} · ordem {interest.sortOrder} ·{" "}
                    {interest.serviceCount} serviços
                  </p>
                </div>
                <div className="flex gap-1">
                  <IconAction
                    label="Editar refinamento"
                    onClick={() => onEditInterest(theme, interest)}
                  >
                    <Pencil className="size-4" />
                  </IconAction>
                  <IconAction
                    label={interest.isActive ? "Desativar" : "Ativar"}
                    onClick={() =>
                      onTransition({
                        action: interest.isActive ? "deactivate" : "activate",
                        entityId: interest.id,
                        entityName: interest.name,
                        entityType: "interest",
                        reason: "",
                      })
                    }
                  >
                    <Activity className="size-4" />
                  </IconAction>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-brand-lavender bg-white p-5 shadow-card">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-primary">
        {label}
      </p>
      <p className="mt-3 font-display text-4xl font-light italic text-brand-deep">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
        isActive
          ? "bg-status-successBg text-status-success"
          : "bg-status-warningBg text-status-warning"
      }`}
    >
      {isActive ? "Ativo" : "Inativo"}
    </span>
  );
}

function ImpactPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-brand-lavender px-3 py-1 text-xs font-bold text-tesText-secondary">
      {value} {label}
    </span>
  );
}

function IconAction({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-full border border-brand-lavender text-brand-primary transition hover:bg-brand-lavenderSoft"
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  onChange,
  pattern,
  required,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  pattern?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-extrabold text-brand-deep">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        pattern={pattern}
        required={required}
        type={type}
        className="mt-2 min-h-11 w-full rounded-md border border-border bg-white px-4 text-sm font-bold text-tesText-primary outline-none focus:ring-4 focus:ring-ring/20"
      />
    </label>
  );
}

function ThemeImageField({
  onChange,
  onUpload,
  uploadStatus,
  value,
}: {
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
  uploadStatus: string | null;
  value: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <span className="text-sm font-extrabold text-brand-deep">Imagem</span>
        <p className="mt-1 text-xs font-bold text-tesText-secondary">
          Use as imagens da Sua Jornada como referência visual ou envie uma nova
          imagem para este tema.
        </p>
      </div>
      <div className="grid gap-4 rounded-2xl border border-brand-lavender bg-surface-soft p-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <ThemeImagePreview imageUrl={value} />
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-extrabold text-brand-deep">
              URL da imagem
            </span>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-border bg-white px-4 text-sm font-bold text-tesText-primary outline-none focus:ring-4 focus:ring-ring/20"
              onChange={(event) => onChange(event.target.value)}
              placeholder="/journey/emocoes-bem-estar.png"
              type="text"
              value={value}
            />
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-brand-lavender bg-white px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-within:ring-4 focus-within:ring-ring/20">
            <ImagePlus className="size-4" aria-hidden="true" />
            Enviar arquivo
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onUpload(file);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
          {uploadStatus ? (
            <p className="text-xs font-bold text-tesText-secondary">
              {uploadStatus}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ThemeImagePreview({ imageUrl }: { imageUrl: string }) {
  if (!imageUrl) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-brand-lavender bg-white text-xs font-extrabold text-brand-primary">
        Preview
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="Preview da imagem do tema"
      className="aspect-[4/3] w-full rounded-xl bg-white object-cover"
      loading="lazy"
      src={imageUrl}
    />
  );
}

async function uploadThemeImage(file: File) {
  const formData = new FormData();
  formData.set("context", "matching-theme");
  formData.set("file", file);

  try {
    const response = await fetch("/api/admin/media", {
      body: formData,
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      data?: { publicUrl?: unknown };
      error?: { message?: unknown };
      ok?: boolean;
    } | null;

    if (
      response.ok &&
      payload?.ok &&
      typeof payload.data?.publicUrl === "string"
    ) {
      return { ok: true as const, publicUrl: payload.data.publicUrl };
    }

    return {
      message:
        typeof payload?.error?.message === "string"
          ? payload.error.message
          : "Não foi possível enviar a imagem agora.",
      ok: false as const,
    };
  } catch {
    return {
      message: "Não foi possível conectar para enviar a imagem.",
      ok: false as const,
    };
  }
}

function TextArea({
  label,
  onChange,
  required,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-extrabold text-brand-deep">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        rows={4}
        className="mt-2 w-full rounded-md border border-border bg-white px-4 py-3 text-sm font-bold text-tesText-primary outline-none focus:ring-4 focus:ring-ring/20"
      />
    </label>
  );
}

function DialogActions({
  error,
  isSaving,
}: {
  error: string | null;
  isSaving: boolean;
}) {
  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-md bg-status-dangerBg p-3 text-sm font-bold text-status-danger">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSaving}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-5 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
        Salvar
      </button>
    </div>
  );
}

function slugifyMatchEntity(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
