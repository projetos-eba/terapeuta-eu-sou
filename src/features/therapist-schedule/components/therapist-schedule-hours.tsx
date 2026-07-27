"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Globe2,
  Info,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { TESDialog } from "@/components/tes";
import type {
  SaveTherapistScheduleInput,
  TherapistScheduleReadModel,
  TherapistScheduleRule,
  TherapistScheduleService,
} from "@/domain/tes";
import type { TherapistAgendaReadModel } from "@/features/bookings";
import {
  buildPopularScheduleTimes,
  buildUpcomingExceptions,
  calculateWeeklyAvailability,
  findDefaultScheduleScope,
  formatDuration,
  getRulesForScope,
  normalizeClock,
  scheduleWeekDays,
  type ScheduleScope,
} from "@/features/therapist-schedule/therapist-schedule-view-model";
import { routes } from "@/lib/routes";

type EditableRule = Omit<TherapistScheduleRule, "id"> & {
  id: string | null;
};

type SaveFeedback = { message: string; tone: "error" | "success" } | null;

const agendaTabs = [
  { href: `${routes.therapist.agenda}?aba=calendario`, label: "Calendário" },
  { href: `${routes.therapist.agenda}?aba=horarios`, label: "Horários" },
  { href: `${routes.therapist.agenda}?aba=bloqueios`, label: "Bloqueios" },
] as const;

export function TherapistScheduleHours({
  agenda,
  initialSchedule,
  referenceNow,
}: {
  agenda: TherapistAgendaReadModel | null;
  initialSchedule: TherapistScheduleReadModel;
  referenceNow: string;
}) {
  const router = useRouter();
  const [scheduleVersion, setScheduleVersion] = useState(
    initialSchedule.scheduleVersion,
  );
  const [rules, setRules] = useState<EditableRule[]>(() =>
    toEditableRules(initialSchedule.rules),
  );
  const [services, setServices] = useState(initialSchedule.services);
  const [timezone, setTimezone] = useState(initialSchedule.timezone);
  const [scope, setScope] = useState<ScheduleScope>(() =>
    findDefaultScheduleScope(initialSchedule.services, initialSchedule.rules),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedback>(null);
  const [dialog, setDialog] = useState<"add" | "copy" | null>(null);
  const [addDay, setAddDay] = useState(1);
  const [copySourceDay, setCopySourceDay] = useState(1);
  const [copyTargetDays, setCopyTargetDays] = useState<number[]>([]);

  useEffect(() => {
    if (initialSchedule.scheduleVersion <= scheduleVersion) return;

    setRules(toEditableRules(initialSchedule.rules));
    setServices(initialSchedule.services);
    setTimezone(initialSchedule.timezone);
    setScheduleVersion(initialSchedule.scheduleVersion);
    setIsDirty(false);
  }, [initialSchedule, scheduleVersion]);

  const currentService = useMemo(
    () => services.find((service) => service.id === scope) ?? null,
    [scope, services],
  );
  const scopeRules = useMemo(
    () => getRulesForScope(rules, scope),
    [rules, scope],
  );
  const summary = useMemo(
    () => calculateWeeklyAvailability(rules, scope),
    [rules, scope],
  );
  const popularTimes = useMemo(
    () =>
      buildPopularScheduleTimes({
        agenda,
        referenceNow,
        scope,
        timezone,
      }),
    [agenda, referenceNow, scope, timezone],
  );
  const upcomingExceptions = useMemo(
    () =>
      buildUpcomingExceptions({
        agenda,
        referenceNow,
        scope,
        timezone,
      }),
    [agenda, referenceNow, scope, timezone],
  );
  const inheritedRuleCount =
    scope === "all"
      ? 0
      : rules.filter((rule) => rule.serviceId === null && rule.isActive).length;

  function markChanged() {
    setIsDirty(true);
    setFeedback(null);
  }

  function updateRule(
    target: EditableRule,
    field: "endTime" | "startTime",
    value: string,
  ) {
    setRules((current) =>
      current.map((rule) =>
        rule === target ? { ...rule, [field]: value } : rule,
      ),
    );
    markChanged();
  }

  function toggleDay(dayOfWeek: number) {
    const dayRules = scopeRules.filter((rule) => rule.dayOfWeek === dayOfWeek);
    const shouldActivate = !dayRules.some((rule) => rule.isActive);

    if (dayRules.length === 0) {
      setRules((current) => [
        ...current,
        createRule(scope, dayOfWeek, "09:00", "17:00"),
      ]);
    } else {
      setRules((current) =>
        current.map((rule) =>
          rule.serviceId === toServiceId(scope) && rule.dayOfWeek === dayOfWeek
            ? { ...rule, isActive: shouldActivate }
            : rule,
        ),
      );
    }
    markChanged();
  }

  function addRange(dayOfWeek: number) {
    const activeRanges = scopeRules
      .filter((rule) => rule.dayOfWeek === dayOfWeek && rule.isActive)
      .sort((left, right) => left.endTime.localeCompare(right.endTime));
    const lastEnd = normalizeClock(activeRanges.at(-1)?.endTime ?? "08:00");
    const startTime = lastEnd < "22:00" ? lastEnd : "09:00";
    const endTime = addMinutesToClock(startTime, 60);

    setRules((current) => [
      ...current,
      createRule(scope, dayOfWeek, startTime, endTime),
    ]);
    markChanged();
  }

  function removeRange(target: EditableRule) {
    setRules((current) => current.filter((rule) => rule !== target));
    markChanged();
  }

  function updateServiceSetting(
    field:
      | "bufferAfterMinutes"
      | "bufferBeforeMinutes"
      | "minimumNoticeMinutes"
      | "slotStepMinutes",
    value: number,
  ) {
    if (!currentService) return;
    setServices((current) =>
      current.map((service) =>
        service.id === currentService.id
          ? {
              ...service,
              settings: { ...service.settings, [field]: value },
            }
          : service,
      ),
    );
    markChanged();
  }

  function copySchedule() {
    if (copyTargetDays.length === 0) return;
    const sourceRules = scopeRules.filter(
      (rule) => rule.dayOfWeek === copySourceDay,
    );

    setRules((current) => [
      ...current.filter(
        (rule) =>
          rule.serviceId !== toServiceId(scope) ||
          !copyTargetDays.includes(rule.dayOfWeek),
      ),
      ...copyTargetDays.flatMap((dayOfWeek) =>
        sourceRules.map((rule) => ({
          ...rule,
          dayOfWeek,
          id: null,
        })),
      ),
    ]);
    markChanged();
    setDialog(null);
    setCopyTargetDays([]);
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty || isSaving) return;

    const invalidRule = rules.find(
      (rule) => normalizeClock(rule.startTime) >= normalizeClock(rule.endTime),
    );
    if (invalidRule) {
      setFeedback({
        message: "O horário final deve ser posterior ao horário inicial.",
        tone: "error",
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    const payload: SaveTherapistScheduleInput = {
      expectedVersion: scheduleVersion,
      requestId: crypto.randomUUID(),
      rules: rules.map((rule) => ({
        ...rule,
        endTime: normalizeClock(rule.endTime),
        startTime: normalizeClock(rule.startTime),
      })),
      serviceSettings: services.map((service) => ({
        ...service.settings,
        serviceId: service.id,
      })),
      timezone,
    };

    try {
      const response = await fetch("/api/therapist/schedule", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as {
        data?: { scheduleVersion?: number };
        error?: { code?: string; message?: string };
        ok?: boolean;
      } | null;

      if (!response.ok || !result?.ok) {
        const conflict =
          response.status === 409 ||
          result?.error?.code === "SCHEDULE_VERSION_CONFLICT";
        throw new Error(
          conflict
            ? "Sua agenda foi alterada em outra janela. Atualize a página antes de salvar novamente."
            : (result?.error?.message ??
                "Não foi possível salvar os horários agora."),
        );
      }

      const nextVersion = result.data?.scheduleVersion;
      if (typeof nextVersion === "number") setScheduleVersion(nextVersion);
      setIsDirty(false);
      setFeedback({
        message: "Horários salvos com sucesso.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar os horários agora.",
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] pb-12 text-tesText-primary">
      <form id="therapist-schedule-form" onSubmit={saveSchedule}>
        <header className="flex flex-col gap-5 border-b border-brand-lavender pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-[34px] font-light text-brand-deep sm:text-[40px]">
              Minha agenda
            </h1>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              Organize seus horários e acompanhe sua disponibilidade.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!isDirty || isSaving}
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-primary bg-white px-5 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              onClick={() => setDialog("add")}
              type="button"
            >
              <Plus aria-hidden="true" size={17} />
              Adicionar faixa
            </button>
          </div>
        </header>

        <nav
          aria-label="Seções da agenda"
          className="mt-5 grid grid-cols-3 border-b border-brand-lavender"
        >
          {agendaTabs.map((tab) => (
            <Link
              aria-current={tab.label === "Horários" ? "page" : undefined}
              className={`flex min-h-12 items-center justify-center border-b-2 px-5 text-sm font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary ${
                tab.label === "Horários"
                  ? "border-brand-primary text-brand-primary"
                  : "border-transparent text-tesText-secondary hover:text-brand-primary"
              }`}
              href={tab.href}
              key={tab.label}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {feedback ? (
          <div
            className={`mt-5 flex items-start gap-3 rounded-lg border p-4 text-sm font-bold ${
              feedback.tone === "success"
                ? "border-status-success/30 bg-status-success/10 text-status-success"
                : "border-status-danger/30 bg-status-dangerBg text-status-danger"
            }`}
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            {feedback.tone === "success" ? (
              <Check aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
            ) : (
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                size={18}
              />
            )}
            {feedback.message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_292px]">
          <div className="grid min-w-0 gap-6">
            <section className="rounded-[14px] border border-brand-lavender bg-white shadow-card">
              <div className="flex flex-col gap-4 border-b border-brand-lavender p-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-brand-deep">
                    Disponibilidade semanal
                  </h2>
                  <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
                    Defina as faixas em que novos encontros podem ser
                    oferecidos.
                  </p>
                </div>
                <button
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                  onClick={() => setDialog("copy")}
                  type="button"
                >
                  <Copy aria-hidden="true" size={17} />
                  Copiar para outros dias
                </button>
              </div>

              <div className="border-b border-brand-lavender bg-brand-lavenderSoft/70 p-5">
                <label
                  className="block text-xs font-extrabold text-brand-deep"
                  htmlFor="schedule-scope"
                >
                  Configuração aplicada a
                </label>
                <select
                  className="mt-2 min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 sm:max-w-md"
                  id="schedule-scope"
                  onChange={(event) => setScope(event.target.value)}
                  value={scope}
                >
                  <option value="all">Todos os serviços</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.title}
                    </option>
                  ))}
                </select>
                {inheritedRuleCount > 0 ? (
                  <p className="mt-2 flex items-start gap-2 text-xs font-semibold leading-5 text-tesText-secondary">
                    <Info
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-brand-primary"
                      size={15}
                    />
                    Esta terapia também herda {inheritedRuleCount}{" "}
                    {inheritedRuleCount === 1 ? "faixa geral" : "faixas gerais"}
                    .
                  </p>
                ) : null}
              </div>

              <div className="divide-y divide-brand-lavender">
                {scheduleWeekDays.map((day) => {
                  const dayRules = scopeRules
                    .filter((rule) => rule.dayOfWeek === day.dayOfWeek)
                    .sort((left, right) =>
                      left.startTime.localeCompare(right.startTime),
                    );
                  const isActive = dayRules.some((rule) => rule.isActive);

                  return (
                    <div
                      className="grid gap-4 p-5 lg:grid-cols-[172px_minmax(0,1fr)] lg:items-start"
                      key={day.dayOfWeek}
                    >
                      <div className="flex min-h-11 items-center gap-3">
                        <button
                          aria-label={`${
                            isActive ? "Desativar" : "Ativar"
                          } ${day.label}`}
                          aria-pressed={isActive}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
                            isActive ? "bg-brand-primary" : "bg-brand-lavender"
                          }`}
                          onClick={() => toggleDay(day.dayOfWeek)}
                          type="button"
                        >
                          <span
                            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                              isActive ? "left-6" : "left-1"
                            }`}
                          />
                        </button>
                        <div>
                          <h3 className="text-sm font-extrabold text-brand-deep">
                            {day.label}
                          </h3>
                          <p className="mt-0.5 text-xs font-semibold text-tesText-muted">
                            {isActive ? "Disponível" : "Indisponível"}
                          </p>
                        </div>
                      </div>

                      {isActive ? (
                        <div className="grid gap-3">
                          {dayRules
                            .filter((rule) => rule.isActive)
                            .map((rule, index) => (
                              <div
                                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_44px] items-center gap-2"
                                key={rule.id ?? `${day.dayOfWeek}-${index}`}
                              >
                                <TimeInput
                                  ariaLabel={`Início de ${day.label}`}
                                  onChange={(value) =>
                                    updateRule(rule, "startTime", value)
                                  }
                                  value={normalizeClock(rule.startTime)}
                                />
                                <span
                                  aria-hidden="true"
                                  className="text-sm font-bold text-tesText-muted"
                                >
                                  até
                                </span>
                                <TimeInput
                                  ariaLabel={`Fim de ${day.label}`}
                                  onChange={(value) =>
                                    updateRule(rule, "endTime", value)
                                  }
                                  value={normalizeClock(rule.endTime)}
                                />
                                <button
                                  aria-label={`Excluir faixa ${index + 1} de ${day.label}`}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-tesText-muted transition hover:bg-status-dangerBg hover:text-status-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                                  onClick={() => removeRange(rule)}
                                  type="button"
                                >
                                  <Trash2 aria-hidden="true" size={18} />
                                </button>
                              </div>
                            ))}
                          <button
                            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                            onClick={() => addRange(day.dayOfWeek)}
                            type="button"
                          >
                            <Plus aria-hidden="true" size={16} />
                            Adicionar horário
                          </button>
                        </div>
                      ) : (
                        <button
                          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-3 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                          onClick={() => toggleDay(day.dayOfWeek)}
                          type="button"
                        >
                          <Plus aria-hidden="true" size={16} />
                          Tornar disponível
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <SessionRulesCard
              onSettingChange={updateServiceSetting}
              onTimezoneChange={(value) => {
                setTimezone(value);
                markChanged();
              }}
              service={currentService}
              timezone={timezone}
            />
          </div>

          <aside className="grid content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
            <AvailabilitySummaryCard
              configuredDays={summary.configuredDays}
              unconfiguredDays={summary.unconfiguredDays}
              weeklyAvailableMinutes={summary.weeklyAvailableMinutes}
            />
            <PopularTimesCard
              hasAgendaData={agenda !== null}
              popularTimes={popularTimes}
            />
            <UpcomingExceptionsCard
              exceptions={upcomingExceptions}
              hasAgendaData={agenda !== null}
            />
            <article className="rounded-[14px] border border-brand-lavender bg-brand-lavenderSoft/75 p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-primary">
                  <Sparkles aria-hidden="true" size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-brand-deep">
                    Dica TES
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
                    Revise seus horários ao mudar de rotina. Uma agenda
                    atualizada reduz conflitos e facilita novos agendamentos.
                  </p>
                </div>
              </div>
            </article>
          </aside>
        </div>
      </form>

      {dialog ? (
        <TESDialog
          className="max-w-md"
          description={
            dialog === "add"
              ? "Escolha o dia que receberá a nova faixa."
              : "As faixas dos dias escolhidos serão substituídas."
          }
          onClose={() => setDialog(null)}
          title={
            dialog === "add" ? "Adicionar faixa de horário" : "Copiar horários"
          }
        >
          {dialog === "add" ? (
            <div>
              <label
                className="text-sm font-extrabold text-brand-deep"
                htmlFor="add-range-day"
              >
                Dia da semana
              </label>
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                id="add-range-day"
                onChange={(event) => setAddDay(Number(event.target.value))}
                value={addDay}
              >
                {scheduleWeekDays.map((day) => (
                  <option key={day.dayOfWeek} value={day.dayOfWeek}>
                    {day.label}
                  </option>
                ))}
              </select>
              <button
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onClick={() => {
                  addRange(addDay);
                  setDialog(null);
                }}
                type="button"
              >
                <Plus aria-hidden="true" size={17} />
                Adicionar faixa
              </button>
            </div>
          ) : (
            <div>
              <label
                className="text-sm font-extrabold text-brand-deep"
                htmlFor="copy-source-day"
              >
                Copiar de
              </label>
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                id="copy-source-day"
                onChange={(event) => {
                  setCopySourceDay(Number(event.target.value));
                  setCopyTargetDays([]);
                }}
                value={copySourceDay}
              >
                {scheduleWeekDays.map((day) => (
                  <option key={day.dayOfWeek} value={day.dayOfWeek}>
                    {day.label}
                  </option>
                ))}
              </select>
              <fieldset className="mt-5 grid grid-cols-2 gap-2">
                <legend className="mb-2 text-sm font-extrabold text-brand-deep">
                  Aplicar em
                </legend>
                {scheduleWeekDays
                  .filter((day) => day.dayOfWeek !== copySourceDay)
                  .map((day) => (
                    <label
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-brand-lavender px-3 text-sm font-bold text-brand-deep has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-primary"
                      key={day.dayOfWeek}
                    >
                      <input
                        checked={copyTargetDays.includes(day.dayOfWeek)}
                        className="h-4 w-4 accent-brand-primary"
                        onChange={(event) =>
                          setCopyTargetDays((current) =>
                            event.target.checked
                              ? [...current, day.dayOfWeek]
                              : current.filter(
                                  (value) => value !== day.dayOfWeek,
                                ),
                          )
                        }
                        type="checkbox"
                      />
                      {day.shortLabel}
                    </label>
                  ))}
              </fieldset>
              <button
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-55"
                disabled={copyTargetDays.length === 0}
                onClick={copySchedule}
                type="button"
              >
                <Copy aria-hidden="true" size={17} />
                Copiar horários
              </button>
            </div>
          )}
        </TESDialog>
      ) : null}
    </main>
  );
}

function SessionRulesCard({
  onSettingChange,
  onTimezoneChange,
  service,
  timezone,
}: {
  onSettingChange: (
    field:
      | "bufferAfterMinutes"
      | "bufferBeforeMinutes"
      | "minimumNoticeMinutes"
      | "slotStepMinutes",
    value: number,
  ) => void;
  onTimezoneChange: (value: string) => void;
  service: TherapistScheduleService | null;
  timezone: string;
}) {
  return (
    <section className="rounded-[14px] border border-brand-lavender bg-white shadow-card">
      <div className="border-b border-brand-lavender p-5">
        <h2 className="text-lg font-extrabold text-brand-deep">
          Regras das sessões
        </h2>
        <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
          As regras abaixo respeitam a terapia selecionada.
        </p>
      </div>
      {service ? (
        <div className="divide-y divide-brand-lavender">
          <RuleRow
            description="Definida no cadastro da terapia."
            icon={Clock3}
            label="Duração da sessão"
          >
            <span className="text-sm font-extrabold text-brand-deep">
              {service.durationMinutes} min
            </span>
          </RuleRow>
          <RuleRow
            description="Frequência em que os inícios são oferecidos."
            icon={CalendarDays}
            label="Intervalo de oferta"
          >
            <MinutesSelect
              ariaLabel="Intervalo de oferta dos horários"
              onChange={(value) => onSettingChange("slotStepMinutes", value)}
              options={[15, 30, 45, 60]}
              value={service.settings.slotStepMinutes}
            />
          </RuleRow>
          <RuleRow
            description="Aplicado ao cálculo e à exibição dos horários."
            icon={Globe2}
            label="Fuso horário"
          >
            <select
              aria-label="Fuso horário"
              className="min-h-11 max-w-[220px] rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              onChange={(event) => onTimezoneChange(event.target.value)}
              value={timezone}
            >
              <option value="America/Sao_Paulo">Brasília (GMT-03)</option>
              <option value="America/Manaus">Manaus (GMT-04)</option>
              <option value="America/Rio_Branco">Rio Branco (GMT-05)</option>
              <option value="America/Noronha">
                Fernando de Noronha (GMT-02)
              </option>
            </select>
          </RuleRow>
          <RuleRow
            description="Tempo mínimo para um novo agendamento."
            icon={CalendarDays}
            label="Antecedência mínima"
          >
            <MinutesSelect
              ariaLabel="Antecedência mínima"
              onChange={(value) =>
                onSettingChange("minimumNoticeMinutes", value)
              }
              options={[0, 60, 120, 360, 720, 1440, 2880]}
              value={service.settings.minimumNoticeMinutes}
            />
          </RuleRow>
          <RuleRow
            description="Reservado antes e depois de cada encontro."
            icon={Clock3}
            label="Tempo de preparo"
          >
            <div className="grid grid-cols-2 gap-2">
              <LabeledMinutesSelect
                label="Antes"
                onChange={(value) =>
                  onSettingChange("bufferBeforeMinutes", value)
                }
                value={service.settings.bufferBeforeMinutes}
              />
              <LabeledMinutesSelect
                label="Depois"
                onChange={(value) =>
                  onSettingChange("bufferAfterMinutes", value)
                }
                value={service.settings.bufferAfterMinutes}
              />
            </div>
          </RuleRow>
        </div>
      ) : (
        <div className="p-6">
          <p className="flex items-start gap-3 text-sm font-semibold leading-6 text-tesText-secondary">
            <Info
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-brand-primary"
              size={18}
            />
            Selecione uma terapia para ajustar duração, oferta, antecedência e
            buffers. As faixas gerais continuam disponíveis para todos os
            serviços.
          </p>
        </div>
      )}
    </section>
  );
}

function RuleRow({
  children,
  description,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  description: string;
  icon: typeof Clock3;
  label: string;
}) {
  return (
    <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden="true" size={17} />
        </span>
        <div>
          <h3 className="text-sm font-extrabold text-brand-deep">{label}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-tesText-muted">
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

function AvailabilitySummaryCard({
  configuredDays,
  unconfiguredDays,
  weeklyAvailableMinutes,
}: {
  configuredDays: number;
  unconfiguredDays: number;
  weeklyAvailableMinutes: number;
}) {
  const circumference = 2 * Math.PI * 42;
  const progress = configuredDays / 7;

  return (
    <article className="rounded-[14px] border border-brand-lavender bg-white p-5 shadow-card">
      <h2 className="text-base font-extrabold text-brand-deep">
        Resumo da disponibilidade
      </h2>
      <div className="mt-5 flex items-center justify-center">
        <div className="relative h-32 w-32">
          <svg
            aria-label={`${configuredDays} de 7 dias configurados`}
            className="-rotate-90"
            height="128"
            role="img"
            viewBox="0 0 100 100"
            width="128"
          >
            <circle
              cx="50"
              cy="50"
              fill="none"
              r="42"
              stroke="var(--tes-color-brand-lavender)"
              strokeWidth="9"
            />
            <circle
              cx="50"
              cy="50"
              fill="none"
              r="42"
              stroke="var(--tes-color-brand-primary)"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              strokeWidth="9"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <strong className="text-2xl font-extrabold text-brand-deep">
              {formatDuration(weeklyAvailableMinutes)}
            </strong>
            <span className="text-xs font-bold text-tesText-muted">
              por semana
            </span>
          </div>
        </div>
      </div>
      <dl className="mt-5 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-2 font-semibold text-tesText-secondary">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
            Dias configurados
          </dt>
          <dd className="font-extrabold text-brand-deep">{configuredDays}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-2 font-semibold text-tesText-secondary">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-lavender" />
            Sem faixas
          </dt>
          <dd className="font-extrabold text-brand-deep">{unconfiguredDays}</dd>
        </div>
      </dl>
      <Link
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-primary text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={`${routes.therapist.agenda}?aba=calendario`}
      >
        Ver no calendário
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </article>
  );
}

function PopularTimesCard({
  hasAgendaData,
  popularTimes,
}: {
  hasAgendaData: boolean;
  popularTimes: Array<{ count: number; label: string }>;
}) {
  return (
    <article className="rounded-[14px] border border-brand-lavender bg-white p-5 shadow-card">
      <h2 className="text-base font-extrabold text-brand-deep">
        Horários mais procurados
      </h2>
      <p className="mt-1 text-xs font-semibold text-tesText-muted">
        Com base nos últimos 30 dias.
      </p>
      {popularTimes.length > 0 ? (
        <ol className="mt-4 grid gap-3">
          {popularTimes.map((item, index) => (
            <li
              className="flex min-h-10 items-center gap-3"
              key={`${item.label}-${index}`}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-lavenderSoft text-xs font-extrabold text-brand-primary">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold text-brand-deep">
                {item.label}
              </span>
              <span className="text-xs font-bold text-tesText-muted">
                {item.count} {item.count === 1 ? "sessão" : "sessões"}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-lg bg-brand-lavenderSoft/70 p-3 text-sm font-semibold leading-5 text-tesText-secondary">
          {hasAgendaData
            ? "Ainda não há volume suficiente neste período."
            : "Dados da agenda indisponíveis no momento."}
        </p>
      )}
    </article>
  );
}

function UpcomingExceptionsCard({
  exceptions,
  hasAgendaData,
}: {
  exceptions: Array<{
    dateLabel: string;
    id: string;
    label: string;
    timeLabel: string;
  }>;
  hasAgendaData: boolean;
}) {
  return (
    <article className="rounded-[14px] border border-brand-lavender bg-white p-5 shadow-card">
      <h2 className="text-base font-extrabold text-brand-deep">
        Próximas exceções
      </h2>
      {exceptions.length > 0 ? (
        <ul className="mt-4 grid gap-4">
          {exceptions.map((exception) => (
            <li className="flex gap-3" key={exception.id}>
              <span className="inline-flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-lavenderSoft text-center text-xs font-extrabold capitalize leading-4 text-brand-primary">
                {exception.dateLabel}
              </span>
              <span>
                <strong className="block text-sm font-extrabold text-brand-deep">
                  {exception.label}
                </strong>
                <span className="mt-1 block text-xs font-semibold text-tesText-muted">
                  {exception.timeLabel}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg bg-brand-lavenderSoft/70 p-3 text-sm font-semibold leading-5 text-tesText-secondary">
          {hasAgendaData
            ? "Nenhuma exceção futura neste período."
            : "Dados da agenda indisponíveis no momento."}
        </p>
      )}
      <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-tesText-muted">
        <Info
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand-primary"
          size={15}
        />
        A gestão de bloqueios será concluída na próxima etapa da Agenda.
      </p>
    </article>
  );
}

function TimeInput({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className="min-h-11 min-w-0 w-full rounded-lg border border-brand-lavender bg-white px-2 text-center text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      onChange={(event) => onChange(event.target.value)}
      step={900}
      type="time"
      value={value}
    />
  );
}

function MinutesSelect({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: number) => void;
  options: number[];
  value: number;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="min-h-11 rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      onChange={(event) => onChange(Number(event.target.value))}
      value={value}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {formatMinutesOption(option)}
        </option>
      ))}
    </select>
  );
}

function LabeledMinutesSelect({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="text-xs font-bold text-tesText-muted">
      {label}
      <span className="mt-1 block">
        <MinutesSelect
          ariaLabel={`${label} da sessão`}
          onChange={onChange}
          options={[0, 5, 10, 15, 20, 30, 45, 60]}
          value={value}
        />
      </span>
    </label>
  );
}

function createRule(
  scope: ScheduleScope,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): EditableRule {
  return {
    dayOfWeek,
    endTime,
    id: null,
    isActive: true,
    serviceId: toServiceId(scope),
    startTime,
  };
}

function toEditableRules(rules: TherapistScheduleRule[]): EditableRule[] {
  return rules.map((rule) => ({
    ...rule,
    endTime: normalizeClock(rule.endTime),
    startTime: normalizeClock(rule.startTime),
  }));
}

function toServiceId(scope: ScheduleScope) {
  return scope === "all" ? null : scope;
}

function addMinutesToClock(value: string, minutesToAdd: number) {
  const [hours = "0", minutes = "0"] = value.split(":");
  const total = Math.min(
    Number(hours) * 60 + Number(minutes) + minutesToAdd,
    23 * 60 + 59,
  );
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

function formatMinutesOption(minutes: number) {
  if (minutes === 0) return "Sem intervalo";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}
