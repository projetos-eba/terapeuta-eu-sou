"use client";

import {
  Activity,
  Baby,
  Brain,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Compass,
  Ellipsis,
  Heart,
  HeartHandshake,
  HeartPulse,
  ListChecks,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { TESButton } from "@/components/tes";
import { cn } from "@/lib/utils";

import {
  JOURNEY_THEME_LABEL_BY_KEY,
  JOURNEY_THEME_OPTIONS,
  type JourneyThemeKey,
} from "../session-journey-themes";

type StoredSelection = {
  bookingId: string;
  selectedAt: string;
  taxonomyVersion: string;
  themeKeys: JourneyThemeKey[];
};

const JOURNEY_THEME_ICON_BY_KEY: Record<JourneyThemeKey, LucideIcon> = {
  body_and_presence: Activity,
  communication: MessageCircle,
  emotional_wellbeing: HeartPulse,
  family: UsersRound,
  habits_and_organization: ListChecks,
  life_transitions: RefreshCw,
  other_topic: Ellipsis,
  parenting: Baby,
  partnership: Heart,
  personal_boundaries: ShieldCheck,
  purpose_and_life_projects: Compass,
  relationships_and_bonds: HeartHandshake,
  routine_and_self_care: Heart,
  self_esteem_and_confidence: Sparkles,
  self_knowledge: Brain,
  work_and_career: BriefcaseBusiness,
};

type TherapistJourneyThemesFormProps = {
  bookingId: string;
  presentation?: "inline" | "standalone";
};

export function TherapistJourneyThemesForm({
  bookingId,
  presentation = "inline",
}: TherapistJourneyThemesFormProps) {
  const titleId = useId();
  const [status, setStatus] = useState<
    "loading" | "available" | "saved" | "error"
  >("loading");
  const [selectedKeys, setSelectedKeys] = useState<JourneyThemeKey[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [storedSelection, setStoredSelection] =
    useState<StoredSelection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSelection() {
      try {
        const response = await fetch(
          `/api/therapist/session-journey-themes?bookingId=${encodeURIComponent(bookingId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as {
          data?: { selection?: StoredSelection | null };
          ok?: boolean;
        } | null;
        if (!response.ok || !payload?.ok) throw new Error("themes_unavailable");
        if (cancelled) return;

        const selection = payload.data?.selection ?? null;
        setStoredSelection(selection);
        setStatus(selection ? "saved" : "available");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("Não foi possível consultar os temas agora.");
        }
      }
    }

    void loadSelection();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const canSave =
    (status === "available" || status === "error") &&
    acknowledged &&
    selectedKeys.length >= 1 &&
    selectedKeys.length <= 3;

  function toggleTheme(key: JourneyThemeKey) {
    setSelectedKeys((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      if (current.length === 3) return current;
      return [...current, key];
    });
  }

  async function saveThemes() {
    if (!canSave) return;

    setStatus("loading");
    setErrorMessage(null);
    requestIdRef.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/therapist/session-journey-themes", {
        body: JSON.stringify({
          acknowledged: true,
          bookingId,
          requestId: requestIdRef.current,
          themeKeys: selectedKeys,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { selection?: StoredSelection };
        error?: { message?: string };
        ok?: boolean;
      } | null;
      const selection = payload?.data?.selection;

      if (!response.ok || !payload?.ok || !selection) {
        throw new Error(payload?.error?.message ?? "themes_save_failed");
      }

      setStoredSelection(selection);
      setStatus("saved");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error && error.message !== "themes_save_failed"
          ? error.message
          : "Não foi possível registrar os temas agora. Sua confirmação permanece registrada.",
      );
    }
  }

  const Heading = presentation === "standalone" ? "h2" : "h3";

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        presentation === "standalone"
          ? "rounded-card border border-brand-lavender bg-white p-5 shadow-card sm:p-7"
          : "border-t border-brand-lavender/70 pt-6",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Sparkles aria-hidden="true" size={19} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Heading
              className="text-lg font-extrabold leading-6 text-brand-deep"
              id={titleId}
            >
              Quais foram os temas da sua sessão?
            </Heading>
            <span className="rounded-full bg-surface-soft px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-tesText-muted">
              Opcional
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Registre até três temas para acompanhar essa jornada no seu
            histórico com o cliente.
          </p>
        </div>
      </div>

      {status === "loading" && !storedSelection ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-tesText-secondary">
          <Loader2
            aria-hidden="true"
            className="animate-spin text-brand-primary"
            size={18}
          />
          Preparando os temas…
        </p>
      ) : null}

      {status === "saved" && storedSelection ? (
        <div className="mt-4 rounded-2xl border border-status-success/30 bg-status-successBg/60 p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-brand-deep">
            <CheckCircle2
              aria-hidden="true"
              className="text-status-success"
              size={18}
            />
            Temas registrados para esta sessão
          </p>
          <ul
            className="mt-3 flex flex-wrap gap-2"
            aria-label="Temas registrados"
          >
            {storedSelection.themeKeys.map((key) => {
              const ThemeIcon = JOURNEY_THEME_ICON_BY_KEY[key];
              return (
                <li
                  className="flex min-h-9 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-brand-deep"
                  key={key}
                >
                  <ThemeIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-brand-primary"
                  />
                  {JOURNEY_THEME_LABEL_BY_KEY.get(key) ?? key}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
            Este registro fica disponível somente para você e não pode ser
            alterado.
          </p>
        </div>
      ) : null}

      {status === "available" || status === "error" ? (
        <div className="mt-4 grid gap-4">
          <fieldset>
            <legend className="sr-only">Selecione de um a três temas</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {JOURNEY_THEME_OPTIONS.map((theme) => {
                const checked = selectedKeys.includes(theme.key);
                const disabled = !checked && selectedKeys.length === 3;
                const ThemeIcon = JOURNEY_THEME_ICON_BY_KEY[theme.key];
                return (
                  <label
                    className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      checked
                        ? "border-brand-primary bg-brand-lavenderSoft text-brand-deep"
                        : "border-brand-lavender bg-white text-tesText-secondary"
                    } ${disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-surface-soft"}`}
                    key={theme.key}
                  >
                    <input
                      checked={checked}
                      className="size-4 accent-brand-primary"
                      disabled={disabled}
                      onChange={() => toggleTheme(theme.key)}
                      type="checkbox"
                    />
                    <ThemeIcon
                      aria-hidden="true"
                      className="size-[18px] shrink-0 text-brand-primary"
                    />
                    <span>{theme.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="text-xs font-semibold text-tesText-muted">
            {selectedKeys.length}/3 temas selecionados
          </p>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-surface-soft px-3 py-3 text-sm font-semibold leading-6 text-tesText-secondary">
            <input
              checked={acknowledged}
              className="mt-1 size-4 accent-brand-primary"
              onChange={(event) => setAcknowledged(event.target.checked)}
              type="checkbox"
            />
            Confirmo que os temas selecionados refletem assuntos tratados nesta
            sessão.
          </label>
          {errorMessage ? (
            <p
              aria-live="assertive"
              className="flex items-start gap-2 text-sm font-semibold leading-6 text-status-error"
            >
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                size={18}
              />
              {errorMessage}
            </p>
          ) : null}
          <TESButton
            disabled={!canSave}
            onClick={() => void saveThemes()}
            type="button"
            variant="secondary"
          >
            Registrar temas
          </TESButton>
        </div>
      ) : null}
    </section>
  );
}
