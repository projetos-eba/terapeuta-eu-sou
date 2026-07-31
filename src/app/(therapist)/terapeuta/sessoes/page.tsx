import Link from "next/link";
import type { Route } from "next";
import {
  Calendar,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleX,
  Clock,
  Clock4,
  Download,
  Filter,
  MoreVertical,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Video,
  Wifi,
} from "lucide-react";

import {
  BookingStatus,
  SessionFinancialStatus,
  type BookingStatus as BookingStatusValue,
  type SessionFinancialStatus as SessionFinancialStatusValue,
} from "@/domain/tes";
import {
  formatSessionDateTime,
  formatSessionMoney,
  getZoomAccessLabel,
  mapSessionPresentation,
  type SessionPresentation,
  type SessionReadModelItem,
} from "@/features/bookings";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import {
  buildNextSessionsHref,
  getTherapistSessionsPage,
  parseTherapistSessionFilters,
} from "@/features/therapist-sessions";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

export default async function TherapistSessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireTherapistSession(
    therapistRoutePolicies.sessions,
  );
  const rawSearchParams = await searchParams;
  const parsedFilters = parseTherapistSessionFilters(rawSearchParams);
  const searchQuery = getSearchQuery(rawSearchParams.q);

  if (!parsedFilters.valid) {
    return <SessionsErrorState message={parsedFilters.message} />;
  }

  const result = await getTherapistSessionsPage({
    accessToken: session.accessToken,
    filters: parsedFilters.filters,
    profileId: session.profileId,
  });

  const filteredData =
    result.status === "success"
      ? {
          ...result.data,
          items: filterSessionsByQuery(result.data.items, searchQuery),
        }
      : null;
  const metrics = filteredData ? getSessionMetrics(filteredData.items) : null;
  const csvHref = filteredData ? buildCsvDataHref(filteredData.items) : "#";
  const hasActiveFilters = hasFilterState(parsedFilters.filters, searchQuery);

  return (
    <main className="pb-10 text-tesText-primary">
      <section className="relative overflow-hidden rounded-[18px] border border-brand-lavender/60 bg-[linear-gradient(180deg,#FFFFFF_0%,#FBF8FF_100%)] p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-[36px] font-light italic leading-tight text-brand-deep sm:text-[42px]">
              Sessões
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
              Gerencie seus atendimentos e acompanhe cada sessão com praticidade
              e organização.
            </p>
          </div>
          <a
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary shadow-sm transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            download="sessoes-tes.csv"
            href={csvHref}
          >
            <Download aria-hidden="true" size={18} />
            Exportar
          </a>
        </div>
      </section>

      {result.status === "error" ? (
        <SessionsErrorState
          correlationId={result.error.correlationId}
          message={result.error.message}
        />
      ) : result.status === "empty" ? (
        <SessionsEmptyState />
      ) : (
        <>
          {metrics ? <SessionMetricsGrid metrics={metrics} /> : null}
          {metrics ? <SessionSummaryStrip metrics={metrics} /> : null}
          <SessionsFilterBar
            bookingStatus={parsedFilters.filters.bookingStatus}
            financialStatus={parsedFilters.filters.financialStatus}
            hasActiveFilters={hasActiveFilters}
            searchQuery={searchQuery}
          />

          {filteredData && filteredData.items.length > 0 ? (
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <section aria-label="Lista de sessões" className="min-w-0">
                <SessionsMobileList items={filteredData.items} />
                <SessionsTable items={filteredData.items} />
                <p className="mt-4 text-xs font-semibold text-tesText-muted">
                  Mostrando {filteredData.items.length} de{" "}
                  {result.data.items.length} sessões carregadas.
                </p>
              </section>
              <SessionsRightRail items={filteredData.items} />
            </div>
          ) : (
            <SessionsNoFilterResults />
          )}

          {result.data.page.hasMore && result.data.page.nextCursor ? (
            <div className="mt-6 flex justify-center">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender bg-white px-5 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft"
                href={
                  withSearchQuery(
                    buildNextSessionsHref(
                      parsedFilters.filters,
                      result.data.page.nextCursor,
                    ),
                    searchQuery,
                  ) as Route
                }
              >
                Carregar próximas
              </Link>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

function SessionMetricsGrid({ metrics }: { metrics: SessionMetrics }) {
  return (
    <section
      aria-label="Indicadores de sessões"
      className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <MetricCard
        description="na semana atual"
        icon={<CalendarDays aria-hidden="true" size={20} />}
        label="Sessões da semana"
        tone="brand"
        value={metrics.weekSessions}
      />
      <MetricCard
        description="com realização registrada"
        icon={<Check aria-hidden="true" size={20} />}
        label="Realizadas"
        tone="success"
        value={metrics.completed}
      />
      <MetricCard
        description="aguardando confirmação"
        icon={<Clock4 aria-hidden="true" size={20} />}
        label="Pendentes"
        tone="warning"
        value={metrics.pending}
      />
      <MetricCard
        description="sem reserva ativa"
        icon={<CircleX aria-hidden="true" size={20} />}
        label="Canceladas"
        tone="danger"
        value={metrics.cancelled}
      />
    </section>
  );
}

function MetricCard({
  description,
  icon,
  label,
  tone,
  value,
}: {
  description: string;
  icon: React.ReactNode;
  label: string;
  tone: "brand" | "danger" | "success" | "warning";
  value: number;
}) {
  const toneClasses = {
    brand: "bg-brand-lavenderSoft text-brand-primary",
    danger: "bg-status-dangerBg text-status-danger",
    success: "bg-status-successBg text-status-success",
    warning: "bg-status-warningBg text-status-warning",
  };

  return (
    <article className="min-h-[172px] rounded-[16px] border border-brand-lavender/45 bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full ${toneClasses[tone]}`}
        >
          {icon}
        </span>
        <h2 className="text-xs font-extrabold leading-5 text-brand-primary">
          {label}
        </h2>
      </div>
      <p className="mt-6 text-4xl font-extrabold leading-none text-brand-deep">
        {value}
      </p>
      <p className="mt-2 text-xs font-semibold text-tesText-secondary">
        {description}
      </p>
    </article>
  );
}

function SessionSummaryStrip({ metrics }: { metrics: SessionMetrics }) {
  const items = [
    {
      icon: <Calendar aria-hidden="true" size={20} />,
      label: "Horário mais agendado",
      value: metrics.mostBookedWindow,
    },
    {
      icon: <Star aria-hidden="true" size={20} />,
      label: "Terapia mais realizada",
      value: metrics.topService,
    },
    {
      icon: <CheckCheck aria-hidden="true" size={20} />,
      label: "Taxa de presença",
      value: `${metrics.attendanceRate}% das sessões confirmadas`,
    },
  ];

  return (
    <section className="mt-5 grid gap-4 rounded-[16px] border border-brand-lavender/35 bg-white p-4 shadow-card md:grid-cols-3">
      {items.map((item) => (
        <div
          className="flex min-w-0 gap-3 border-brand-lavender/60 md:border-r md:last:border-r-0"
          key={item.label}
        >
          <span className="mt-1 shrink-0 text-brand-primary">{item.icon}</span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-tesText-secondary">
              {item.label}
            </span>
            <span className="mt-1 block text-sm font-extrabold leading-5 text-brand-primary">
              {item.value}
            </span>
          </span>
        </div>
      ))}
    </section>
  );
}

function SessionsFilterBar({
  bookingStatus,
  financialStatus,
  hasActiveFilters,
  searchQuery,
}: {
  bookingStatus?: BookingStatusValue;
  financialStatus?: SessionFinancialStatusValue;
  hasActiveFilters: boolean;
  searchQuery: string;
}) {
  return (
    <form
      action={routes.therapist.sessions}
      className="mt-5 grid gap-3 rounded-[16px] border border-brand-lavender/40 bg-white p-4 shadow-card lg:grid-cols-[minmax(220px,1fr)_160px_160px_auto]"
    >
      <label className="relative block min-w-0">
        <span className="sr-only">Buscar por cliente ou terapia</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary"
          size={20}
        />
        <input
          className="min-h-12 w-full rounded-xl border border-brand-lavender/60 bg-white py-2 pl-4 pr-12 text-sm font-semibold text-brand-deep outline-none placeholder:text-tesText-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          defaultValue={searchQuery}
          maxLength={80}
          name="q"
          placeholder="Buscar por cliente ou terapia..."
        />
      </label>
      <SelectField
        icon={<Filter aria-hidden="true" size={18} />}
        label="Status"
        name="status"
        options={bookingStatusOptions}
        value={bookingStatus}
      />
      <SelectField
        label="Pagamento"
        name="payment"
        options={financialStatusOptions}
        value={financialStatus}
      />
      <div className="flex gap-2">
        <button
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary lg:flex-none"
          type="submit"
        >
          Filtrar
        </button>
        {hasActiveFilters ? (
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={routes.therapist.sessions as Route}
          >
            Limpar
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function SelectField({
  icon,
  label,
  name,
  options,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
  value?: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-primary">
          {icon}
        </span>
      ) : null}
      <select
        className={`min-h-12 w-full appearance-none rounded-xl border border-brand-lavender/60 bg-white py-2 pr-10 text-sm font-semibold text-brand-deep outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 ${
          icon ? "pl-10" : "pl-4"
        }`}
        defaultValue={value ?? ""}
        name={name}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary"
        size={17}
      />
    </label>
  );
}

function SessionsTable({ items }: { items: SessionReadModelItem[] }) {
  return (
    <div className="hidden overflow-hidden rounded-[16px] border border-brand-lavender bg-white shadow-card lg:block">
      <table className="w-full table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-brand-lavender/70 text-[11px] font-extrabold text-brand-primary">
            <th className="w-[20%] px-4 py-4">Cliente</th>
            <th className="w-[16%] px-3 py-4">Terapia</th>
            <th className="w-[17%] px-3 py-4">Data e horário</th>
            <th className="w-[15%] px-3 py-4">Status</th>
            <th className="w-[12%] px-3 py-4">Link Zoom</th>
            <th className="w-[12%] px-3 py-4">Valor</th>
            <th className="w-[8%] px-2 py-4 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-lavender/50">
          {items.map((booking) => {
            const presentation = mapSessionPresentation(booking);
            const detailHref = routes.therapist.sessionDetail(
              booking.bookingId,
            ) as Route;

            return (
              <tr
                className="text-xs font-semibold text-tesText-secondary transition hover:bg-surface-soft/70"
                key={booking.bookingId}
              >
                <td className="px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <AvatarInitials name={booking.patientName} />
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold text-brand-deep">
                        {booking.patientName}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-4">
                  <span className="block truncate font-extrabold text-brand-primary">
                    {booking.serviceTitle}
                  </span>
                  <span className="mt-1 inline-flex max-w-full rounded-full bg-brand-lavenderSoft px-2 py-1 text-[9px] font-bold text-brand-primary">
                    <span className="truncate">Online</span>
                  </span>
                </td>
                <td className="px-3 py-4 text-brand-deep">
                  {formatCompactSessionDateTime(
                    booking.startsAt,
                    booking.timezone,
                  )}
                </td>
                <td className="px-3 py-4">
                  <StatusBadge presentation={presentation} />
                </td>
                <td className="px-3 py-4">
                  <Link
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-brand-lavender px-3 text-[11px] font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                    href={detailHref}
                  >
                    <Video aria-hidden="true" size={14} />
                    {presentation.actions.canAccessZoom ? "Entrar" : "Ver"}
                  </Link>
                </td>
                <td className="px-3 py-4 font-extrabold text-brand-deep">
                  {formatSessionMoney(booking.priceCents, booking.currency)}
                </td>
                <td className="px-2 py-4 text-center">
                  <Link
                    aria-label={`Abrir detalhes da sessão com ${booking.patientName}`}
                    className="inline-grid size-9 place-items-center rounded-lg border border-brand-lavender text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
                    href={detailHref}
                  >
                    <MoreVertical aria-hidden="true" size={17} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SessionsMobileList({ items }: { items: SessionReadModelItem[] }) {
  return (
    <div className="grid gap-3 lg:hidden">
      {items.map((booking) => {
        const presentation = mapSessionPresentation(booking);
        return (
          <Link
            className="grid gap-4 rounded-[16px] border border-brand-lavender bg-white p-4 shadow-card transition hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={routes.therapist.sessionDetail(booking.bookingId) as Route}
            key={booking.bookingId}
          >
            <span className="flex min-w-0 items-start gap-3">
              <AvatarInitials name={booking.patientName} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-extrabold text-brand-deep">
                  {booking.patientName}
                </span>
                <span className="mt-1 block truncate text-sm font-semibold text-brand-primary">
                  {booking.serviceTitle}
                </span>
                <span className="mt-1 block text-xs font-semibold text-tesText-secondary">
                  {formatSessionDateTime(booking.startsAt, booking.timezone)}
                </span>
              </span>
              <StatusBadge presentation={presentation} />
            </span>
            <span className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-tesText-secondary">
              <span>{getZoomAccessLabel(booking.zoomAccess)}</span>
              <span className="font-extrabold text-brand-deep">
                {formatSessionMoney(booking.priceCents, booking.currency)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function SessionsRightRail({ items }: { items: SessionReadModelItem[] }) {
  const nextSession = getNextSession(items);

  return (
    <aside className="grid gap-5 xl:sticky xl:top-28 xl:self-start">
      <section className="rounded-[16px] border border-brand-lavender/40 bg-white p-5 shadow-card">
        <h2 className="font-display text-xl font-light italic text-brand-deep">
          Próxima sessão
        </h2>
        {nextSession ? (
          <div className="mt-4 rounded-[14px] border border-brand-lavender/40 bg-white p-4">
            <div className="flex items-start gap-3">
              <AvatarInitials name={nextSession.patientName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-brand-deep">
                  {nextSession.patientName}
                </p>
                <p className="mt-1 truncate text-xs font-semibold text-brand-primary">
                  {nextSession.serviceTitle}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold leading-5 text-tesText-secondary">
              {formatSessionDateTime(
                nextSession.startsAt,
                nextSession.timezone,
              )}
            </p>
            <Link
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 text-xs font-extrabold text-white transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              href={
                routes.therapist.sessionDetail(nextSession.bookingId) as Route
              }
            >
              <Video aria-hidden="true" size={16} />
              {mapSessionPresentation(nextSession).actions.primary.label}
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
            Nenhuma próxima sessão encontrada nos itens carregados.
          </p>
        )}
        <Link
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand-lavender text-xs font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
          href={routes.therapist.agenda as Route}
        >
          Ver agenda completa
        </Link>
      </section>

      <section className="rounded-[16px] border border-brand-lavender/40 bg-white p-5 shadow-card">
        <h2 className="font-display text-xl font-light italic text-brand-deep">
          Atalhos rápidos
        </h2>
        <div className="mt-4 grid gap-3">
          <RailLink
            description="Gerenciar horários"
            href={`${routes.therapist.agenda}?aba=horarios`}
            icon={<CalendarClock aria-hidden="true" size={18} />}
            label="Disponibilidade"
          />
          <RailLink
            description="Gerenciar abordagens"
            href={routes.therapist.services}
            icon={<Sparkles aria-hidden="true" size={18} />}
            label="Tipos de terapia"
          />
        </div>
      </section>

      <section className="rounded-[16px] border border-brand-lavender/40 bg-white p-5 shadow-card">
        <h2 className="font-display text-xl font-light italic text-brand-deep">
          Dicas para uma ótima sessão
        </h2>
        <RailTip
          description="Verifique internet, câmera e microfone antes do encontro."
          icon={<Wifi aria-hidden="true" size={18} />}
          label="Teste sua conexão"
        />
        <RailTip
          description="Escolha um espaço reservado, confortável e silencioso."
          icon={<ShieldCheck aria-hidden="true" size={18} />}
          label="Ambiente tranquilo"
        />
        <RailTip
          description="Esteja pronto alguns minutos antes do início combinado."
          icon={<Clock aria-hidden="true" size={18} />}
          label="Seja pontual"
        />
      </section>

      <section className="rounded-[16px] border border-brand-lavender/40 bg-white p-5 shadow-card">
        <h2 className="font-display text-xl font-light italic text-brand-deep">
          Política de reagendamento
        </h2>
        <ul className="mt-4 grid gap-4 text-xs font-semibold leading-5 text-tesText-secondary">
          <li className="flex gap-3">
            <CheckCheck
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-status-success"
              size={17}
            />
            O reagendamento deve ser feito com antecedência mínima registrada na
            política da sessão.
          </li>
          <li className="flex gap-3">
            <CheckCheck
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-status-success"
              size={17}
            />
            Cancelamentos e reembolsos seguem exclusivamente os estados
            financeiros confirmados pelo Stripe.
          </li>
        </ul>
        <Link
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand-lavender text-xs font-extrabold text-brand-primary transition hover:bg-brand-lavenderSoft"
          href={routes.public.terms as Route}
        >
          Ver política completa
        </Link>
      </section>
    </aside>
  );
}

function RailLink({
  description,
  href,
  icon,
  label,
}: {
  description: string;
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      className="flex min-h-[68px] items-center gap-3 rounded-xl border border-brand-lavender/60 px-3 text-left transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary"
      href={href as Route}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-extrabold text-brand-primary">
          {label}
        </span>
        <span className="mt-1 block truncate text-[10px] font-semibold text-tesText-secondary">
          {description}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="shrink-0 text-brand-primary"
        size={16}
      />
    </Link>
  );
}

function RailTip({
  description,
  icon,
  label,
}: {
  description: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="mt-5 flex gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-brand-lavender text-brand-primary">
        {icon}
      </span>
      <span>
        <span className="block text-xs font-extrabold text-brand-primary">
          {label}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-tesText-secondary">
          {description}
        </span>
      </span>
    </div>
  );
}

function StatusBadge({ presentation }: { presentation: SessionPresentation }) {
  const toneClasses = {
    danger: "bg-status-dangerBg text-status-danger",
    info: "bg-brand-lavenderSoft text-brand-primary",
    neutral: "bg-surface-soft text-tesText-secondary",
    success: "bg-status-successBg text-status-success",
    warning: "bg-status-warningBg text-status-warning",
  };

  return (
    <span
      className={`inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-extrabold ${toneClasses[presentation.tone]}`}
    >
      <span className="truncate">
        {getCompactPresentationLabel(presentation)}
      </span>
    </span>
  );
}

function AvatarInitials({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-sm font-extrabold text-brand-primary">
      {initials || "P"}
    </span>
  );
}

function SessionsEmptyState() {
  return (
    <section className="mt-6 rounded-card border border-brand-lavender bg-white p-8 text-center shadow-card">
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Nenhuma sessão encontrada
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        Não há sessões para o período e os filtros informados.
      </p>
    </section>
  );
}

function SessionsNoFilterResults() {
  return (
    <section className="mt-6 rounded-card border border-brand-lavender bg-white p-8 text-center shadow-card">
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Nenhuma sessão neste recorte
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        Ajuste a busca ou limpe os filtros para voltar à lista carregada.
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-lavender px-5 text-sm font-extrabold text-brand-primary hover:bg-brand-lavenderSoft"
        href={routes.therapist.sessions as Route}
      >
        Limpar filtros
      </Link>
    </section>
  );
}

function SessionsErrorState({
  correlationId,
  message,
}: {
  correlationId?: string;
  message: string;
}) {
  return (
    <section
      className="mt-6 rounded-card border border-status-error/30 bg-white p-8 text-center shadow-card"
      role="alert"
    >
      <h2 className="font-display text-3xl font-light italic text-brand-deep">
        Sessões temporariamente indisponíveis
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {message}
      </p>
      {correlationId ? (
        <p className="mt-2 text-xs font-semibold text-tesText-muted">
          Referência: {correlationId.slice(0, 8)}
        </p>
      ) : null}
    </section>
  );
}

type SessionMetrics = {
  attendanceRate: number;
  cancelled: number;
  completed: number;
  mostBookedWindow: string;
  pending: number;
  topService: string;
  weekSessions: number;
};

const bookingStatusOptions = [
  { label: "Confirmadas", value: BookingStatus.Confirmed },
  { label: "Pagamento pendente", value: BookingStatus.PendingPayment },
  { label: "Realizadas", value: BookingStatus.Completed },
  {
    label: "Canceladas pelo paciente",
    value: BookingStatus.CancelledByPatient,
  },
  {
    label: "Canceladas pelo terapeuta",
    value: BookingStatus.CancelledByTherapist,
  },
  { label: "Reembolsadas", value: BookingStatus.Refunded },
];

const financialStatusOptions = [
  { label: "Pago", value: SessionFinancialStatus.Paid },
  { label: "Pendente", value: SessionFinancialStatus.Pending },
  { label: "Processando", value: SessionFinancialStatus.Processing },
  { label: "Falhou", value: SessionFinancialStatus.Failed },
  { label: "Contestação", value: SessionFinancialStatus.Disputed },
  { label: "Reembolsado", value: SessionFinancialStatus.Refunded },
];

function getSessionMetrics(items: SessionReadModelItem[]): SessionMetrics {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const completed = items.filter(isCompletedSession).length;
  const confirmed = items.filter(
    (item) => item.bookingStatus === BookingStatus.Confirmed,
  ).length;

  return {
    attendanceRate: confirmed
      ? Math.round((completed / Math.max(confirmed, completed)) * 100)
      : 0,
    cancelled: items.filter(isCancelledSession).length,
    completed,
    mostBookedWindow: getMostBookedWindow(items),
    pending: items.filter(isPendingSession).length,
    topService: getTopService(items),
    weekSessions: items.filter((item) => {
      const startsAt = new Date(item.startsAt);
      return startsAt >= weekStart && startsAt < weekEnd;
    }).length,
  };
}

function filterSessionsByQuery(
  items: SessionReadModelItem[],
  searchQuery: string,
) {
  const normalizedQuery = normalizeSearchText(searchQuery);
  if (!normalizedQuery) return items;

  return items.filter((item) => {
    const haystack = normalizeSearchText(
      `${item.patientName} ${item.serviceTitle}`,
    );
    return haystack.includes(normalizedQuery);
  });
}

function getNextSession(items: SessionReadModelItem[]) {
  const now = Date.now();
  return [...items]
    .filter(
      (item) =>
        new Date(item.startsAt).getTime() >= now && !isCancelledSession(item),
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )[0];
}

function isCompletedSession(item: SessionReadModelItem) {
  const presentation = mapSessionPresentation(item);
  return presentation.state === "completed";
}

function isPendingSession(item: SessionReadModelItem) {
  const presentation = mapSessionPresentation(item);
  return (
    presentation.state === "payment_pending" ||
    presentation.state === "requires_attention" ||
    presentation.state === "reschedule_requested" ||
    presentation.state === "room_preparing"
  );
}

function isCancelledSession(item: SessionReadModelItem) {
  return (
    item.bookingStatus === BookingStatus.CancelledByPatient ||
    item.bookingStatus === BookingStatus.CancelledByTherapist ||
    item.bookingStatus === BookingStatus.NoShowPatient ||
    item.bookingStatus === BookingStatus.NoShowTherapist ||
    item.bookingStatus === BookingStatus.Refunded
  );
}

function getMostBookedWindow(items: SessionReadModelItem[]) {
  if (!items.length) return "Sem dados suficientes";
  const counts = new Map<string, number>();

  for (const item of items) {
    const date = new Date(item.startsAt);
    const key = `${formatWeekday(item.startsAt, item.timezone)}|${date.getUTCHours()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const [winner] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!winner) return "Sem dados suficientes";

  const [weekday, hour] = winner.split("|");
  const startHour = Number(hour);
  return `${weekday}s · ${startHour}h - ${startHour + 2}h`;
}

function getTopService(items: SessionReadModelItem[]) {
  if (!items.length) return "Sem dados suficientes";
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.serviceTitle, (counts.get(item.serviceTitle) ?? 0) + 1);
  }

  const [winner] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!winner) return "Sem dados suficientes";

  const ratio = Math.round(((counts.get(winner) ?? 0) / items.length) * 100);
  return `${winner} · ${ratio}% das sessões`;
}

function buildCsvDataHref(items: SessionReadModelItem[]) {
  const rows = [
    [
      "Paciente",
      "Terapia",
      "Inicio",
      "Fim",
      "Status",
      "Pagamento",
      "Valor",
      "Formato",
    ],
    ...items.map((item) => [
      item.patientName,
      item.serviceTitle,
      formatSessionDateTime(item.startsAt, item.timezone),
      formatSessionDateTime(item.endsAt, item.timezone),
      mapSessionPresentation(item).label,
      formatFinancialStatus(item.financialStatus),
      formatSessionMoney(item.priceCents, item.currency),
      "Online",
    ]),
  ];
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function formatCompactSessionDateTime(value: string, timezone: string) {
  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: timezone,
    weekday: "short",
  })
    .format(new Date(value))
    .replace(".", "");
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));

  return `${date} · ${time}`;
}

function formatWeekday(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "long",
  }).format(new Date(value));
}

function formatFinancialStatus(value: string | null) {
  const labels: Record<string, string> = {
    canceled: "Cancelado",
    disputed: "Em contestação",
    failed: "Falhou",
    paid: "Pago",
    partially_refunded: "Reembolso parcial",
    pending: "Pendente",
    processing: "Processando",
    refunded: "Reembolsado",
  };

  return value ? (labels[value] ?? "Em análise") : "Não iniciado";
}

function getCompactPresentationLabel(presentation: SessionPresentation) {
  if (presentation.state === "payment_pending") return "Pag. pendente";
  if (presentation.state === "reschedule_requested") return "Reagendamento";
  if (presentation.state === "requires_attention") return "Atenção";
  if (presentation.state === "room_preparing") return "Sala preparando";
  return presentation.label;
}

function getSearchQuery(value: string | string[] | undefined) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return firstValue ? firstValue.trim().slice(0, 80) : "";
}

function hasFilterState(
  filters: { bookingStatus?: string; financialStatus?: string },
  searchQuery: string,
) {
  return Boolean(
    searchQuery || filters.bookingStatus || filters.financialStatus,
  );
}

function withSearchQuery(href: string, searchQuery: string) {
  if (!searchQuery) return href;
  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("q", searchQuery);
  return `${pathname}?${params.toString()}`;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + mondayOffset);
  return result;
}
