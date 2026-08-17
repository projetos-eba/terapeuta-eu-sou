import Link from "next/link";
import type { Route } from "next";
import { AlertCircle, CalendarDays } from "lucide-react";

import {
  getTherapistAgendaPage,
  getTherapistCalendar,
  type TherapistCalendarView,
} from "@/features/therapist-agenda";
import { TherapistAgendaHeader } from "@/features/therapist-agenda/components/therapist-agenda-chrome";
import { TherapistCalendar } from "@/features/therapist-agenda/components/therapist-calendar";
import { getTherapistBlocks } from "@/features/therapist-blocks";
import { TherapistBlocksPanel } from "@/features/therapist-blocks/components/therapist-blocks-panel";
import { getTherapistSchedule } from "@/features/therapist-schedule";
import { TherapistScheduleHours } from "@/features/therapist-schedule/components/therapist-schedule-hours";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

type AgendaTab = "bloqueios" | "calendario" | "horarios";

export default async function TherapistAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    busca?: string;
    motivo?: string;
    periodo?: string;
    status?: string;
    data?: string;
    visao?: string;
  }>;
}) {
  const params = await searchParams;
  const tab = parseAgendaTab(params.aba);
  const session = await requireTherapistSession(therapistRoutePolicies.agenda);
  const referenceNow = new Date();
  const rangeStart = new Date(referenceNow);
  const rangeEnd = new Date(referenceNow);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 30);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 61);

  if (tab === "horarios") {
    const [agendaResult, scheduleResult] = await Promise.all([
      getTherapistAgendaPage({
        accessToken: session.accessToken,
        profileId: session.profileId,
        rangeEnd: rangeEnd.toISOString(),
        rangeStart: rangeStart.toISOString(),
      }),
      getTherapistSchedule({
        accessToken: session.accessToken,
        profileId: session.profileId,
      }),
    ]);

    if (scheduleResult.status === "error") {
      return (
        <AgendaFrame activeTab="horarios">
          <section
            className="mt-6 rounded-[14px] border border-status-danger/30 bg-white p-8 text-center shadow-card"
            role="alert"
          >
            <AlertCircle
              aria-hidden="true"
              className="mx-auto text-status-danger"
              size={28}
            />
            <h2 className="mt-4 font-display text-3xl font-light text-brand-deep">
              Horários temporariamente indisponíveis
            </h2>
            <p className="mt-3 text-sm font-semibold text-tesText-secondary">
              {scheduleResult.error.message}
            </p>
            <p className="mt-2 text-xs font-semibold text-tesText-muted">
              Referência: {scheduleResult.error.correlationId.slice(0, 8)}
            </p>
          </section>
        </AgendaFrame>
      );
    }

    return (
      <TherapistScheduleHours
        agenda={agendaResult.status === "success" ? agendaResult.data : null}
        initialSchedule={scheduleResult.data}
        referenceNow={referenceNow.toISOString()}
      />
    );
  }

  if (tab === "bloqueios") {
    const blockRangeEnd = new Date(referenceNow);
    blockRangeEnd.setUTCDate(
      blockRangeEnd.getUTCDate() + parseBlockPeriod(params.periodo),
    );
    const [blocksResult, scheduleResult] = await Promise.all([
      getTherapistBlocks({
        accessToken: session.accessToken,
        filters: {
          rangeEnd: blockRangeEnd.toISOString(),
          rangeStart: referenceNow.toISOString(),
          reasonCode: normalizeReasonFilter(params.motivo),
          search: normalizeSearch(params.busca),
          status: normalizeStatusFilter(params.status),
        },
        profileId: session.profileId,
      }),
      getTherapistSchedule({
        accessToken: session.accessToken,
        profileId: session.profileId,
      }),
    ]);

    if (blocksResult.status === "error") {
      return (
        <BlocksErrorState
          correlationId={blocksResult.error.correlationId}
          message={blocksResult.error.message}
        />
      );
    }

    if (scheduleResult.status === "error") {
      return (
        <BlocksErrorState
          correlationId={scheduleResult.error.correlationId}
          message={scheduleResult.error.message}
        />
      );
    }

    return (
      <TherapistBlocksPanel
        initialData={blocksResult.data}
        services={scheduleResult.data.services}
      />
    );
  }

  const [calendarResult, scheduleResult] = await Promise.all([
    getTherapistCalendar({
      accessToken: session.accessToken,
      anchorDate: normalizeCalendarDate(params.data),
      profileId: session.profileId,
      view: parseCalendarView(params.visao),
    }),
    getTherapistSchedule({
      accessToken: session.accessToken,
      profileId: session.profileId,
    }),
  ]);

  if (calendarResult.status === "error") {
    return (
      <AgendaFrame activeTab="calendario">
        <section
          className="mt-6 rounded-[14px] border border-status-danger/30 bg-white p-8 text-center shadow-card"
          role="alert"
        >
          <h2 className="font-display text-3xl font-light text-brand-deep">
            Agenda temporariamente indisponível
          </h2>
          <p className="mt-3 text-sm font-semibold text-tesText-secondary">
            {calendarResult.error.message}
          </p>
          <p className="mt-2 text-xs font-semibold text-tesText-muted">
            Referência: {calendarResult.error.correlationId.slice(0, 8)}
          </p>
        </section>
      </AgendaFrame>
    );
  }

  if (calendarResult.status === "empty") {
    return (
      <AgendaFrame activeTab="calendario">
        <section className="mt-6 rounded-[14px] border border-brand-lavender/60 bg-white p-8 text-center shadow-card">
          <CalendarDays
            aria-hidden="true"
            className="mx-auto text-brand-primary"
            size={28}
          />
          <h2 className="mt-4 font-display text-3xl font-light text-brand-deep">
            Sua agenda está pronta para começar
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-6 text-tesText-secondary">
            Defina seus horários de atendimento para que novos encontros possam
            ser agendados.
          </p>
          <Link
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-extrabold text-white hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
            href={`${routes.therapist.agenda}?aba=horarios` as Route}
          >
            Configurar horários
          </Link>
        </section>
      </AgendaFrame>
    );
  }

  return (
    <TherapistCalendar
      data={calendarResult.data}
      scheduleRules={
        scheduleResult.status === "success" ? scheduleResult.data.rules : null
      }
    />
  );
}

function BlocksErrorState({
  correlationId,
  message,
}: {
  correlationId: string;
  message: string;
}) {
  return (
    <AgendaFrame activeTab="bloqueios">
      <section
        className="mt-6 rounded-lg border border-status-danger/30 bg-white p-8 text-center shadow-card"
        role="alert"
      >
        <AlertCircle
          aria-hidden="true"
          className="mx-auto text-status-danger"
          size={28}
        />
        <h2 className="mt-4 font-display text-3xl font-light text-brand-deep">
          Bloqueios temporariamente indisponíveis
        </h2>
        <p className="mt-3 text-sm font-semibold text-tesText-secondary">
          {message}
        </p>
        <p className="mt-2 text-xs font-semibold text-tesText-muted">
          Referência: {correlationId.slice(0, 8)}
        </p>
      </section>
    </AgendaFrame>
  );
}

function AgendaFrame({
  activeTab,
  children,
}: {
  activeTab: AgendaTab;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[1210px] pb-14 text-tesText-primary">
      <TherapistAgendaHeader activeTab={activeTab} />
      {children}
    </main>
  );
}

function parseAgendaTab(value: string | undefined): AgendaTab {
  if (value === "horarios" || value === "bloqueios") return value;
  return "calendario";
}

function parseBlockPeriod(value: string | undefined) {
  if (value === "60") return 60;
  if (value === "90") return 90;
  return 30;
}

function normalizeStatusFilter(
  value: string | undefined,
): "active" | "all" | "cancelled" {
  if (value === "all" || value === "cancelled") return value;
  return "active";
}

function normalizeReasonFilter(value: string | undefined) {
  const allowed = new Set([
    "administrative",
    "health",
    "other",
    "personal",
    "training",
    "vacation",
  ]);
  return value && allowed.has(value) ? value : undefined;
}

function normalizeSearch(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 80) : undefined;
}

function parseCalendarView(value: string | undefined): TherapistCalendarView {
  if (value === "day" || value === "month") return value;
  return "week";
}

function normalizeCalendarDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}
