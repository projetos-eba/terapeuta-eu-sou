"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TESDialog } from "@/components/tes";

type ActorRole = "patient" | "therapist";
type DialogMode = "cancel" | "reschedule";
type Screen = "calendar" | "cancel" | "confirm" | "schedule";

export type RescheduleSlot = { endsAt: string; startsAt: string };
type Availability = {
  booking: { id: string; startsAt: string; version: number };
  horizonEndsAt: string;
  service: {
    currency: string;
    durationMinutes: number;
    id: string;
    priceCents: number;
    therapyName: string;
    title: string;
  };
  slots: RescheduleSlot[];
  timezone: string;
};

type Props = {
  actorRole: ActorRole;
  bookingId: string;
  errorMessage: string | null;
  impactLabel: string;
  isSubmitting: boolean;
  mode: DialogMode;
  onClose: () => void;
  onSubmitCancel: (userReason: string) => void;
  onSubmitReschedule: (input: {
    proposedStartsAt: string;
    reason: string;
  }) => void;
};

type LoadState = "error" | "loading" | "ready";
const weekDays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function SessionChangeDialog({
  actorRole,
  bookingId,
  errorMessage,
  impactLabel,
  isSubmitting,
  mode,
  onClose,
  onSubmitCancel,
  onSubmitReschedule,
}: Props) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [screen, setScreen] = useState<Screen>(
    mode === "cancel" && actorRole === "therapist" ? "cancel" : "schedule",
  );
  const [selectedSlot, setSelectedSlot] = useState<RescheduleSlot | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthStart(new Date()),
  );
  const [monthSlots, setMonthSlots] = useState<RescheduleSlot[]>([]);
  const [monthState, setMonthState] = useState<LoadState>("loading");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const subject = actorRole === "patient" ? "encontro" : "sessão";

  useEffect(() => {
    if (mode === "cancel" && actorRole === "therapist") return;
    const controller = new AbortController();
    setLoadState("loading");
    void loadAvailability(bookingId, actorRole, "next", null, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setAvailability(result);
        setVisibleMonth(
          monthStart(
            dateFromKey(dateKeyInTimezone(new Date(), result.timezone)),
          ),
        );
        setLoadState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState("error");
      });
    return () => controller.abort();
  }, [actorRole, bookingId, mode]);

  useEffect(() => {
    if (screen !== "calendar" || !availability) return;
    const controller = new AbortController();
    setMonthState("loading");
    setSelectedDate(null);
    void loadAvailability(
      bookingId,
      actorRole,
      "month",
      dateKey(visibleMonth),
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setMonthSlots(result.slots);
        setMonthState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setMonthState("error");
      });
    return () => controller.abort();
  }, [actorRole, availability, bookingId, screen, visibleMonth]);

  const compactGroups = useMemo(
    () =>
      groupNextAvailableSlots(
        availability?.slots ?? [],
        availability?.timezone ?? "America/Sao_Paulo",
      ),
    [availability],
  );
  const monthGroups = useMemo(
    () => groupSlots(monthSlots, availability?.timezone ?? "America/Sao_Paulo"),
    [availability?.timezone, monthSlots],
  );
  const availableDates = useMemo(
    () => new Set(monthGroups.map((group) => group.date)),
    [monthGroups],
  );
  const selectedDay = monthGroups.find((group) => group.date === selectedDate);

  const title =
    screen === "cancel"
      ? `Cancelar ${subject}`
      : screen === "calendar"
        ? "Escolha um dia e horário"
        : screen === "confirm"
          ? actorRole === "patient"
            ? "Confirmar reagendamento"
            : "Confirmar proposta"
          : mode === "cancel"
            ? "Antes de cancelar"
            : actorRole === "patient"
              ? "Reagendar encontro"
              : "Solicitar reagendamento";
  const description =
    screen === "cancel"
      ? "A plataforma aplica a política financeira e registra o cancelamento com segurança."
      : screen === "confirm"
        ? actorRole === "patient"
          ? "O novo horário será confirmado imediatamente após a validação final da agenda."
          : "O reagendamento só será concluído depois que a outra parte aceitar a proposta."
        : mode === "cancel" && screen === "schedule"
          ? "Antes de cancelar, podemos tentar um horário que combine melhor com sua rotina."
          : "A terapia, a duração e o valor contratados permanecem os mesmos.";

  function choose(slot: RescheduleSlot) {
    setSelectedSlot(slot);
    if (screen === "calendar" || mode === "reschedule") {
      setScreen("confirm");
    }
  }

  return (
    <TESDialog
      className={screen === "calendar" ? "max-w-4xl" : "max-w-3xl"}
      description={description}
      onClose={onClose}
      title={title}
    >
      {errorMessage ? (
        <p
          className="mb-5 rounded-xl border border-status-danger/25 bg-status-dangerBg p-4 text-sm font-semibold text-status-danger"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      {screen === "schedule" ? (
        <div className="grid gap-5">
          {availability ? (
            <LockedServiceSummary availability={availability} />
          ) : null}
          {loadState === "loading" ? <LoadingState /> : null}
          {loadState === "error" ? (
            <p
              className="rounded-xl border border-status-warning/30 bg-status-warningBg p-4 text-sm font-semibold leading-6 text-brand-deep"
              role="alert"
            >
              Não foi possível carregar os horários agora.
              {mode === "cancel"
                ? " Você ainda pode continuar com o cancelamento."
                : " Tente novamente em instantes."}
            </p>
          ) : null}
          {loadState === "ready" && compactGroups.length ? (
            <CompactSchedule
              groups={compactGroups}
              onChoose={choose}
              selected={selectedSlot?.startsAt ?? null}
              timezone={availability?.timezone ?? "America/Sao_Paulo"}
            />
          ) : null}
          {loadState === "ready" && !compactGroups.length ? (
            <p className="rounded-xl bg-brand-lavenderSoft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
              Não há novos horários disponíveis dentro das regras atuais da
              agenda.
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="min-h-11 text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline disabled:opacity-40"
              disabled={!availability}
              onClick={() => setScreen("calendar")}
              type="button"
            >
              Ver agenda completa e mais horários →
            </button>
            {mode === "cancel" ? (
              <div className="sticky bottom-0 z-10 -mx-2 flex flex-col-reverse gap-3 border-t border-brand-lavender bg-white/95 px-2 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <button
                  className="min-h-11 rounded-lg px-4 text-sm font-bold text-tesText-secondary underline-offset-4 hover:underline"
                  onClick={() => setScreen("cancel")}
                  type="button"
                >
                  Continuar com o cancelamento
                </button>
                <button
                  className="min-h-11 rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!selectedSlot}
                  onClick={() => setScreen("confirm")}
                  type="button"
                >
                  Reagendar encontro
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {screen === "calendar" && availability ? (
        <FullCalendar
          availability={availability}
          availableDates={availableDates}
          monthState={monthState}
          onBack={() => setScreen("schedule")}
          onChoose={choose}
          onMoveMonth={(direction) =>
            setVisibleMonth((current) => addMonths(current, direction))
          }
          onSelectDate={setSelectedDate}
          selectedDate={selectedDate}
          selectedDay={selectedDay}
          visibleMonth={visibleMonth}
        />
      ) : null}

      {screen === "confirm" && availability && selectedSlot ? (
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitReschedule({
              proposedStartsAt: selectedSlot.startsAt,
              reason: rescheduleReason,
            });
          }}
        >
          <LockedServiceSummary availability={availability} />
          <div className="rounded-xl border border-brand-lavender bg-brand-lavenderSoft p-4">
            <p className="text-sm font-extrabold text-brand-deep">
              {actorRole === "patient"
                ? "Novo horário escolhido"
                : "Novo horário proposto"}
            </p>
            <p className="mt-1 text-sm font-semibold text-tesText-secondary">
              {formatDateTime(selectedSlot.startsAt, availability.timezone)}
            </p>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-extrabold text-brand-deep">
              Motivo opcional
            </span>
            <textarea
              className="min-h-[92px] rounded-lg border border-brand-lavender px-4 py-3 text-sm font-semibold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              maxLength={500}
              onChange={(event) => setRescheduleReason(event.target.value)}
              placeholder="Explique a necessidade de ajuste, se quiser."
              value={rescheduleReason}
            />
          </label>
          <DialogActions
            backLabel="Escolher outro horário"
            isSubmitting={isSubmitting}
            onBack={() => setScreen("schedule")}
            submitLabel={
              actorRole === "patient"
                ? "Confirmar reagendamento"
                : "Enviar proposta"
            }
          />
        </form>
      ) : null}

      {screen === "cancel" ? (
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (actorRole === "therapist" || cancellationReason.trim()) {
              onSubmitCancel(cancellationReason.trim());
            }
          }}
        >
          <p className="rounded-xl border border-status-warning/30 bg-status-warningBg px-4 py-3 text-sm font-bold leading-6 text-brand-deep">
            {impactLabel}
          </p>
          <label className="grid gap-2">
            <span className="text-sm font-extrabold text-brand-deep">
              Motivo {actorRole === "patient" ? "do cancelamento" : "opcional"}
            </span>
            <textarea
              aria-describedby="cancellation-reason-help"
              className="min-h-[110px] rounded-lg border border-brand-lavender px-4 py-3 text-sm font-semibold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              maxLength={500}
              onChange={(event) => setCancellationReason(event.target.value)}
              placeholder="Conte brevemente o motivo."
              required={actorRole === "patient"}
              value={cancellationReason}
            />
            <span
              className="text-xs font-semibold text-tesText-muted"
              id="cancellation-reason-help"
            >
              {actorRole === "patient"
                ? "Este motivo é privado e não será compartilhado com a terapeuta."
                : "Se desejar, registre uma observação interna sobre o cancelamento."}
            </span>
          </label>
          <DialogActions
            backLabel={
              actorRole === "patient" ? "Voltar aos horários" : "Voltar"
            }
            disabled={actorRole === "patient" && !cancellationReason.trim()}
            isSubmitting={isSubmitting}
            onBack={
              actorRole === "patient" ? () => setScreen("schedule") : onClose
            }
            submitLabel="Confirmar cancelamento"
            tone="danger"
          />
        </form>
      ) : null}
    </TESDialog>
  );
}

function LockedServiceSummary({
  availability,
}: {
  availability: Availability;
}) {
  const service = availability.service;
  return (
    <div className="rounded-xl border border-brand-lavender bg-white p-4">
      <div className="flex items-start gap-3">
        <CalendarDays
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-brand-primary"
        />
        <div>
          <p className="text-sm font-extrabold text-brand-deep">
            {service.title}
          </p>
          <p className="mt-1 text-sm font-semibold text-tesText-secondary">
            {service.therapyName} · {service.durationMinutes} min ·{" "}
            {formatCurrency(service.priceCents, service.currency)}
          </p>
          <p className="mt-1 text-xs font-semibold text-tesText-muted">
            Terapia contratada — não pode ser alterada neste reagendamento.
          </p>
        </div>
      </div>
    </div>
  );
}

type SlotGroup = { date: string; slots: RescheduleSlot[] };
function CompactSchedule({
  groups,
  onChoose,
  selected,
  timezone,
}: {
  groups: SlotGroup[];
  onChoose: (slot: RescheduleSlot) => void;
  selected: string | null;
  timezone: string;
}) {
  return (
    <section
      className="rounded-[20px] bg-brand-primary p-5 text-white sm:p-6"
      aria-label="Próximos horários disponíveis"
    >
      <h3 className="font-display text-2xl font-light italic">
        Próximos horários disponíveis
      </h3>
      <div className="mt-5 grid gap-4">
        {groups.map((group) => (
          <div
            className="grid gap-3 sm:grid-cols-[92px_minmax(0,1fr)]"
            key={group.date}
          >
            <p className="text-sm font-semibold leading-5">
              {formatDay(group.date)}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {group.slots.map((slot) => (
                <button
                  aria-pressed={selected === slot.startsAt}
                  className="min-h-11 rounded-lg bg-brand-primaryPressed px-3 text-sm font-bold text-white outline-none transition hover:bg-white hover:text-brand-primary focus-visible:ring-4 focus-visible:ring-white/30"
                  key={slot.startsAt}
                  onClick={() => onChoose(slot)}
                  type="button"
                >
                  {formatTime(slot.startsAt, timezone)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FullCalendar({
  availability,
  availableDates,
  monthState,
  onBack,
  onChoose,
  onMoveMonth,
  onSelectDate,
  selectedDate,
  selectedDay,
  visibleMonth,
}: {
  availability: Availability;
  availableDates: Set<string>;
  monthState: LoadState;
  onBack: () => void;
  onChoose: (slot: RescheduleSlot) => void;
  onMoveMonth: (direction: -1 | 1) => void;
  onSelectDate: (date: string) => void;
  selectedDate: string | null;
  selectedDay: SlotGroup | undefined;
  visibleMonth: Date;
}) {
  const dates = calendarDates(visibleMonth);
  const currentMonth = monthKey(visibleMonth);
  const firstMonth = monthKey(
    monthStart(
      dateFromKey(dateKeyInTimezone(new Date(), availability.timezone)),
    ),
  );
  const lastMonth = monthKey(
    monthStart(
      dateFromKey(
        dateKeyInTimezone(
          new Date(availability.horizonEndsAt),
          availability.timezone,
        ),
      ),
    ),
  );
  return (
    <div>
      <LockedServiceSummary availability={availability} />
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-brand-primary">
        Agenda completa
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <MonthButton
              disabled={currentMonth <= firstMonth}
              direction="previous"
              onClick={() => onMoveMonth(-1)}
            />
            <p className="text-base font-bold text-brand-deep">
              {formatMonth(visibleMonth)}
            </p>
            <MonthButton
              disabled={currentMonth >= lastMonth}
              direction="next"
              onClick={() => onMoveMonth(1)}
            />
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2 text-center">
            {weekDays.map((day) => (
              <span
                className="text-xs font-bold uppercase text-tesText-muted"
                key={day}
              >
                {day}
              </span>
            ))}
            {dates.map((date) => {
              const key = dateKey(date);
              const available =
                monthKey(date) === currentMonth && availableDates.has(key);
              return (
                <button
                  aria-pressed={selectedDate === key}
                  className={
                    available
                      ? selectedDate === key
                        ? "min-h-12 rounded-xl bg-brand-primary text-sm font-bold text-white"
                        : "min-h-12 rounded-xl border border-brand-lavender bg-brand-lavenderSoft text-sm font-bold text-brand-primary hover:bg-brand-lavender"
                      : "min-h-12 rounded-xl text-sm text-tesText-muted/40"
                  }
                  disabled={!available || monthState === "loading"}
                  key={key}
                  onClick={() => onSelectDate(key)}
                  type="button"
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          {monthState === "loading" ? <LoadingState /> : null}
          {monthState === "error" ? (
            <p
              className="mt-4 text-sm font-semibold text-status-danger"
              role="alert"
            >
              Não foi possível carregar este mês.
            </p>
          ) : null}
          {monthState === "ready" && !availableDates.size ? (
            <p className="mt-4 text-sm font-semibold text-tesText-muted">
              Não há horários disponíveis neste mês.
            </p>
          ) : null}
        </div>
        <aside className="rounded-[18px] border border-brand-lavender bg-brand-lavenderSoft p-4">
          <h3 className="font-display text-2xl font-light italic text-brand-deep">
            {selectedDate ? formatDateLabel(selectedDate) : "Selecione um dia"}
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {selectedDay?.slots.map((slot) => (
              <button
                className="min-h-11 rounded-lg bg-white px-4 text-sm font-bold text-brand-primary shadow-sm hover:bg-brand-primary hover:text-white"
                key={slot.startsAt}
                onClick={() => onChoose(slot)}
                type="button"
              >
                {formatTime(slot.startsAt, availability.timezone)}
              </button>
            ))}
            {!selectedDay ? (
              <p className="col-span-full text-sm font-semibold leading-6 text-tesText-muted">
                Os dias com horários aparecem destacados.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
      <button
        className="mt-5 min-h-11 rounded-lg border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary"
        onClick={onBack}
        type="button"
      >
        Voltar
      </button>
    </div>
  );
}

function DialogActions({
  backLabel,
  disabled = false,
  isSubmitting,
  onBack,
  submitLabel,
  tone = "brand",
}: {
  backLabel: string;
  disabled?: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  submitLabel: string;
  tone?: "brand" | "danger";
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        className="min-h-11 rounded-lg border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary"
        onClick={onBack}
        type="button"
      >
        {backLabel}
      </button>
      <button
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold text-white disabled:opacity-45 ${tone === "danger" ? "bg-status-danger" : "bg-brand-primary"}`}
        disabled={disabled || isSubmitting}
        type="submit"
      >
        {isSubmitting ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={17} />
        ) : null}
        {submitLabel}
      </button>
    </div>
  );
}

function MonthButton({
  disabled,
  direction,
  onClick,
}: {
  disabled: boolean;
  direction: "next" | "previous";
  onClick: () => void;
}) {
  const Icon = direction === "next" ? ChevronRight : ChevronLeft;
  return (
    <button
      aria-label={direction === "next" ? "Próximo mês" : "Mês anterior"}
      className="grid size-11 place-items-center rounded-full border border-brand-lavender text-brand-primary disabled:opacity-35"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" size={20} />
    </button>
  );
}

function LoadingState() {
  return (
    <p
      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-tesText-muted"
      role="status"
    >
      <Loader2 aria-hidden="true" className="animate-spin" size={17} />
      Carregando horários…
    </p>
  );
}

async function loadAvailability(
  bookingId: string,
  actorRole: ActorRole,
  scope: "day" | "month" | "next",
  anchor: string | null,
  signal: AbortSignal,
) {
  const search = new URLSearchParams({ actorRole, bookingId, scope });
  if (anchor) search.set("anchor", anchor);
  const response = await fetch(
    `/api/session/reschedule/availability?${search}`,
    { cache: "no-store", signal },
  );
  const payload = (await response.json()) as unknown;
  if (
    !response.ok ||
    !isRecord(payload) ||
    payload.ok !== true ||
    !isAvailability(payload.data)
  )
    throw new Error("availability_failed");
  return payload.data;
}

function isAvailability(value: unknown): value is Availability {
  if (!isRecord(value) || !isRecord(value.booking) || !isRecord(value.service))
    return false;
  return (
    typeof value.timezone === "string" &&
    typeof value.horizonEndsAt === "string" &&
    typeof value.booking.startsAt === "string" &&
    typeof value.booking.version === "number" &&
    typeof value.service.title === "string" &&
    typeof value.service.therapyName === "string" &&
    typeof value.service.durationMinutes === "number" &&
    typeof value.service.priceCents === "number" &&
    typeof value.service.currency === "string" &&
    Array.isArray(value.slots) &&
    value.slots.every(
      (slot) =>
        isRecord(slot) &&
        typeof slot.startsAt === "string" &&
        typeof slot.endsAt === "string",
    )
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function groupNextAvailableSlots(
  slots: RescheduleSlot[],
  timezone: string,
) {
  return groupSlots(slots, timezone, 3, 5);
}

function groupSlots(
  slots: RescheduleSlot[],
  timezone: string,
  maxDays = Number.POSITIVE_INFINITY,
  maxPerDay = Number.POSITIVE_INFINITY,
): SlotGroup[] {
  const groups = new Map<string, RescheduleSlot[]>();
  for (const slot of slots) {
    const key = dateKeyInTimezone(new Date(slot.startsAt), timezone);
    const current = groups.get(key) ?? [];
    if (current.length < maxPerDay) current.push(slot);
    groups.set(key, current);
  }
  return [...groups.entries()]
    .slice(0, maxDays)
    .map(([date, grouped]) => ({ date, slots: grouped }));
}
function dateKeyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}
function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function monthKey(date: Date) {
  return dateKey(date).slice(0, 7);
}
function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}
function calendarDates(month: Date) {
  const first = monthStart(month);
  first.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}
function formatMonth(date: Date) {
  const value = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}
function formatDay(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
  }).format(dateFromKey(value));
}
function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    dateFromKey(value),
  );
}
function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { currency, style: "currency" }).format(
    cents / 100,
  );
}
