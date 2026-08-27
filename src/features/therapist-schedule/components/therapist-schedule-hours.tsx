"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
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
import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";

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
  hasOverlappingAvailabilityRules,
  normalizeClock,
  scheduleWeekDays,
  type ScheduleScope,
} from "@/features/therapist-schedule/therapist-schedule-view-model";
import { routes } from "@/lib/routes";

import { TherapistAgendaHeader } from "@/features/therapist-agenda/components/therapist-agenda-chrome";

type EditableRule = Omit<TherapistScheduleRule, "id"> & {
  id: string | null;
};

type SaveFeedback = { message: string; tone: "error" | "success" } | null;

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
    const nextRules = rules.map((rule) =>
      rule === target ? { ...rule, [field]: value } : rule,
    );

    setRules(nextRules);
    markChanged();
  }

  function validateEditedRange() {
    if (hasOverlappingAvailabilityRules(rules)) {
      showOverlapFeedback();
    }
  }

  function toggleDay(dayOfWeek: number) {
    const dayRules = scopeRules.filter((rule) => rule.dayOfWeek === dayOfWeek);
    const shouldActivate = !dayRules.some((rule) => rule.isActive);

    const nextRules =
      dayRules.length === 0
        ? [...rules, createRule(scope, dayOfWeek, "09:00", "17:00")]
        : rules.map((rule) =>
            rule.serviceId === toServiceId(scope) &&
            rule.dayOfWeek === dayOfWeek
              ? { ...rule, isActive: shouldActivate }
              : rule,
          );

    if (hasOverlappingAvailabilityRules(nextRules)) {
      showOverlapFeedback();
      return;
    }

    setRules(nextRules);
    markChanged();
  }

  function addRange(dayOfWeek: number) {
    const range = findNextAvailableRange({ dayOfWeek, rules, scope });
    if (!range) {
      setFeedback({
        message:
          "Não há uma nova faixa livre neste dia. Ajuste ou remova uma faixa existente antes de continuar.",
        tone: "error",
      });
      return;
    }

    setRules([...rules, range]);
    markChanged();
  }

  function removeRange(target: EditableRule) {
    setRules((current) => current.filter((rule) => rule !== target));
    markChanged();
  }

  function updateServiceSetting(
    field: "minimumNoticeMinutes" | "slotStepMinutes",
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

    const nextRules = [
      ...rules.filter(
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
    ];

    if (hasOverlappingAvailabilityRules(nextRules)) {
      showOverlapFeedback();
      return;
    }

    setRules(nextRules);
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

    if (hasOverlappingAvailabilityRules(rules)) {
      showOverlapFeedback();
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    const schedulableServices = services.filter(
      (service) => service.status !== "archived",
    );
    const schedulableServiceIds = new Set(
      schedulableServices.map((service) => service.id),
    );
    const payload: SaveTherapistScheduleInput = {
      expectedVersion: scheduleVersion,
      requestId: crypto.randomUUID(),
      rules: rules
        .filter(
          (rule) =>
            rule.serviceId === null ||
            schedulableServiceIds.has(rule.serviceId),
        )
        .map((rule) => ({
          ...rule,
          endTime: normalizeClock(rule.endTime),
          startTime: normalizeClock(rule.startTime),
        })),
      serviceSettings: schedulableServices.map((service) => ({
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

  function showOverlapFeedback() {
    setFeedback({
      message:
        "Essa faixa se sobrepõe a outro horário disponível no mesmo dia. Ajuste os horários antes de continuar.",
      tone: "error",
    });
  }

  return (
    <main className="mx-auto min-w-0 w-full max-w-[1210px] pb-14 text-tesText-primary">
      <form id="therapist-schedule-form" onSubmit={saveSchedule}>
        <TherapistAgendaHeader
          activeTab="horarios"
          actions={
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-deep transition hover:border-brand-primary hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!isDirty || isSaving}
                type="submit"
              >
                <Save aria-hidden="true" size={17} />
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </button>
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onClick={() => setDialog("add")}
                type="button"
              >
                <Plus aria-hidden="true" size={17} />
                Adicionar faixa
              </button>
            </div>
          }
        />

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

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid min-w-0 gap-5">
            <section className="rounded-[14px] border border-brand-lavender bg-white shadow-card">
              <div className="flex flex-col gap-4 border-b border-brand-lavender p-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-brand-deep">
                    Disponibilidade semanal
                  </h2>
                  <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
                    Defina as faixas em que novas sessões podem ser oferecidos.
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
                  <option value="all">Todas as terapias</option>
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
                                <TimeSelect
                                  ariaLabel={`Início de ${day.label}`}
                                  onChange={(value) =>
                                    updateRule(rule, "startTime", value)
                                  }
                                  onBlur={validateEditedRange}
                                  value={normalizeClock(rule.startTime)}
                                />
                                <span
                                  aria-hidden="true"
                                  className="text-sm font-bold text-tesText-muted"
                                >
                                  até
                                </span>
                                <TimeSelect
                                  ariaLabel={`Fim de ${day.label}`}
                                  onChange={(value) =>
                                    updateRule(rule, "endTime", value)
                                  }
                                  onBlur={validateEditedRange}
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
                <Sparkles
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-brand-primary"
                  size={18}
                />
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
    field: "minimumNoticeMinutes" | "slotStepMinutes",
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
            info="De quanto em quanto tempo uma nova sessão pode começar. Por exemplo: 30 minutos organiza os horários com início a cada 30 minutos."
            label="Intervalo das sessões"
          >
            <MinutesSelect
              ariaLabel="Intervalo das sessões"
              onChange={(value) => onSettingChange("slotStepMinutes", value)}
              options={[15, 30, 45, 60]}
              value={service.settings.slotStepMinutes}
            />
          </RuleRow>
          <RuleRow
            description="Aplicado ao cálculo e à exibição dos horários."
            icon={Globe2}
            info="Este fuso define como os horários da sua agenda serão calculados e exibidos. O TES usa São Paulo (Brasília) como referência; se você atende de outro país, organize sua disponibilidade considerando esse horário."
            label="Fuso horário"
          >
            <select
              aria-label="Fuso horário"
              className="min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 sm:w-[220px] sm:max-w-full"
              onChange={(event) => onTimezoneChange(event.target.value)}
              value={timezone}
            >
              <option value="America/Sao_Paulo">
                São Paulo (Brasília, GMT-03)
              </option>
              <option value="America/Manaus">Manaus (GMT-04)</option>
              <option value="America/Rio_Branco">Rio Branco (GMT-05)</option>
              <option value="America/Noronha">
                Fernando de Noronha (GMT-02)
              </option>
            </select>
          </RuleRow>
          <p className="border-t border-brand-lavender bg-brand-lavenderSoft/60 px-5 py-4 text-sm font-semibold leading-6 text-tesText-secondary">
            O TES organiza a agenda no fuso de São Paulo (Brasília). Isso vale
            para a disponibilidade e para as reservas, inclusive quando você ou
            a pessoa atendida estiverem fora do Brasil.
          </p>
          <RuleRow
            description="Tempo mínimo para um novo agendamento."
            icon={CalendarDays}
            info="É o tempo mínimo entre o momento do agendamento e o início da sessão. Por exemplo: 120 minutos significa que a pessoa precisa agendar com pelo menos 2 horas de antecedência."
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
        </div>
      ) : (
        <div className="p-6">
          <p className="flex items-start gap-3 text-sm font-semibold leading-6 text-tesText-secondary">
            <Info
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-brand-primary"
              size={18}
            />
            Selecione uma terapia para ajustar duração, oferta e antecedência.
            As faixas gerais continuam disponíveis para todas as terapias.
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
  info,
  label,
}: {
  children: React.ReactNode;
  description: string;
  icon: typeof Clock3;
  info?: string;
  label: string;
}) {
  return (
    <div className="grid min-w-0 gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-lavenderSoft text-brand-primary">
          <Icon aria-hidden="true" size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-extrabold text-brand-deep">
            <span>{label}</span>
            {info ? <RuleInfoPopover label={label} text={info} /> : null}
          </h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-tesText-muted">
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

function RuleInfoPopover({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  function updatePosition() {
    const anchor = rootRef.current?.getBoundingClientRect();
    if (!anchor) return;

    const viewportPadding = 16;
    const tooltipWidth = Math.min(288, window.innerWidth - viewportPadding * 2);
    const maxLeft = window.innerWidth - tooltipWidth - viewportPadding;

    setPosition({
      left: Math.min(
        Math.max(viewportPadding, anchor.right - tooltipWidth),
        maxLeft,
      ),
      top: anchor.bottom + 8,
    });
  }

  useEffect(() => {
    if (!open) return;

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <span className="relative inline-flex" ref={rootRef}>
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-label={`Saiba mais sobre ${label}`}
        className="inline-flex size-11 items-center justify-center rounded-full text-brand-primary outline-none hover:bg-brand-lavenderSoft focus-visible:ring-4 focus-visible:ring-ring/20"
        onClick={() => {
          if (!open) updatePosition();
          setOpen((current) => !current);
        }}
        type="button"
      >
        <Info aria-hidden="true" size={16} />
      </button>
      {open && position ? (
        <span
          className="fixed z-20 max-h-[calc(100dvh-2rem)] w-[18rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-brand-lavender bg-white p-4 text-left text-sm font-semibold leading-6 text-tesText-secondary shadow-float"
          id={id}
          role="tooltip"
          style={position}
        >
          {text}
        </span>
      ) : null}
    </span>
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
  const progressPercent = Math.round(progress * 100);
  const averageDailyMinutes =
    configuredDays > 0
      ? Math.round(weeklyAvailableMinutes / configuredDays)
      : 0;

  return (
    <article className="rounded-[20px] border border-brand-lavender bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <CalendarDays
          aria-hidden="true"
          className="shrink-0 text-brand-primary"
          size={19}
        />
        <h2 className="font-display text-[22px] font-light italic leading-tight text-brand-deep">
          Resumo da disponibilidade
        </h2>
      </div>
      <div className="mt-6">
        <p className="text-sm font-bold text-tesText-secondary">
          Disponibilidade configurada
        </p>
        <p className="mt-1 text-[42px] font-extrabold leading-none tracking-tight text-brand-deep">
          {formatDuration(weeklyAvailableMinutes)}
        </p>
        <p className="mt-2 text-sm font-semibold text-tesText-secondary">
          {configuredDays > 0
            ? `Média de ${formatDuration(averageDailyMinutes)} por dia disponível`
            : "Defina uma faixa para começar a receber reservas."}
        </p>
      </div>
      <div className="mt-6 flex items-center justify-center">
        <div className="relative h-32 w-32">
          <svg
            aria-label={`${configuredDays} de 7 dias configurados (${progressPercent}%)`}
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
              {configuredDays}/7
            </strong>
            <span className="text-xs font-bold text-tesText-muted">dias</span>
          </div>
        </div>
      </div>
      <dl className="mt-5 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-2 font-semibold text-tesText-secondary">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
            Disponível
          </dt>
          <dd className="font-extrabold text-brand-deep">
            {configuredDays} dias ({progressPercent}%)
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-2 font-semibold text-tesText-secondary">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-lavender" />
            Sem faixas
          </dt>
          <dd className="font-extrabold text-brand-deep">
            {unconfiguredDays} dias ({100 - progressPercent}%)
          </dd>
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
    <article className="rounded-[20px] border border-brand-lavender bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-3 text-lg font-extrabold text-brand-deep">
        <BarChart3
          aria-hidden="true"
          className="shrink-0 text-brand-primary"
          size={19}
        />
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
    <article className="rounded-[20px] border border-brand-lavender bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-3 text-lg font-extrabold text-brand-deep">
        <CalendarDays
          aria-hidden="true"
          className="shrink-0 text-brand-primary"
          size={19}
        />
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

const scheduleTimeOptions = Array.from({ length: 96 }, (_, index) =>
  minutesToClock(index * 15),
);

function TimeSelect({
  ariaLabel,
  onBlur,
  onChange,
  value,
}: {
  ariaLabel: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  value: string;
}) {
  const options = scheduleTimeOptions.includes(value)
    ? scheduleTimeOptions
    : [...scheduleTimeOptions, value].sort();

  return (
    <select
      aria-label={ariaLabel}
      className="min-h-11 min-w-0 w-full rounded-lg border border-brand-lavender bg-white px-3 text-center text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      value={value}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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
      className="min-h-11 w-full rounded-lg border border-brand-lavender bg-white px-3 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 sm:w-[220px] sm:max-w-full"
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

function findNextAvailableRange({
  dayOfWeek,
  rules,
  scope,
}: {
  dayOfWeek: number;
  rules: EditableRule[];
  scope: ScheduleScope;
}) {
  const durationMinutes = 60;
  const scopedRangeEnds = rules
    .filter(
      (rule) =>
        rule.serviceId === toServiceId(scope) &&
        rule.dayOfWeek === dayOfWeek &&
        rule.isActive,
    )
    .map((rule) => clockToMinutes(rule.endTime));
  const firstStartMinute = Math.max(8 * 60, ...scopedRangeEnds);

  for (
    let startMinutes = firstStartMinute;
    startMinutes + durationMinutes < 24 * 60;
    startMinutes += 15
  ) {
    const candidate = createRule(
      scope,
      dayOfWeek,
      minutesToClock(startMinutes),
      minutesToClock(startMinutes + durationMinutes),
    );

    if (!hasOverlappingAvailabilityRules([...rules, candidate])) {
      return candidate;
    }
  }

  return null;
}

function clockToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = normalizeClock(value).split(":");
  return Number(hours) * 60 + Number(minutes);
}

function minutesToClock(totalMinutes: number) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(
    totalMinutes % 60,
  ).padStart(2, "0")}`;
}

function formatMinutesOption(minutes: number) {
  if (minutes === 0) return "Sem intervalo";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}
