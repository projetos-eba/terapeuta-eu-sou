import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCheck,
  CircleHelp,
  Clock3,
  CreditCard,
  ExternalLink,
  Info,
  Laptop,
  ShieldCheck,
  Star,
  Video,
} from "lucide-react";

import {
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page/app-page";
import {
  BookingReference,
  formatSessionDateTime,
  formatSessionMoney,
  getSessionOperationDisabledReason,
  getZoomAccessLabel,
  mapSessionPresentation,
  type SessionPresentation,
  type TherapistSessionDetailReadModel,
} from "@/features/bookings";
import { SessionOperationActions } from "@/features/session-actions/session-operation-actions";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import {
  getTherapistSessionDetail,
  getTherapistSessionFeedbackStatus,
  getTherapistSessionPendingReschedule,
  type TherapistSessionFeedbackStatus,
} from "@/features/therapist-sessions";
import { getTherapistPostSessionAction } from "@/features/therapist-sessions/session-feedback-action";
import { requireTherapistSession } from "@/lib/auth/therapist-session";
import { routes } from "@/lib/routes";

type SessionDetailPageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function TherapistSessionDetailPage({
  params,
}: SessionDetailPageProps) {
  const { bookingId } = await params;
  const therapist = await requireTherapistSession(therapistRoutePolicies.sessions);
  const result = await getTherapistSessionDetail({
    accessToken: therapist.accessToken,
    bookingId,
    profileId: therapist.profileId,
  });

  if (result.status === "empty") {
    notFound();
  }

  if (result.status === "error") {
    return <SessionDetailErrorState error={result.error} />;
  }

  const booking = result.data;
  const presentation = mapSessionPresentation(booking);
  const [pendingReschedule, feedbackStatus] = await Promise.all([
    getTherapistSessionPendingReschedule({
      accessToken: therapist.accessToken,
      bookingId: booking.bookingId,
      userId: therapist.userId,
    }),
    getTherapistSessionFeedbackStatus({
      accessToken: therapist.accessToken,
      bookingId: booking.bookingId,
    }),
  ]);

  return (
    <AppPageContainer className="gap-6 lg:gap-8">
      <Link
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-brand-primary transition-colors hover:text-brand-deep"
        href={routes.therapist.sessions}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Sessões
      </Link>

      <AppPageGrid className="xl:grid-cols-[minmax(0,1fr)_320px]">
        <AppPageMain className="gap-6">
          <header className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">
              Rotina de atendimento
            </p>
            <h1 className="font-display text-4xl italic leading-[0.98] text-brand-deep sm:text-5xl">
              Detalhes da sessão
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-tesText-secondary sm:text-base">
              Acompanhe o status, prepare a sala e gerencie esta sessão com clareza.
            </p>
          </header>

          <SessionOverview booking={booking} presentation={presentation} />
          <SessionReadiness
            booking={booking}
            feedbackStatus={feedbackStatus}
            presentation={presentation}
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <SessionAbout booking={booking} presentation={presentation} />
            <SessionPreparation />
          </div>

          <SessionOperationActions
            actorRole="therapist"
            bookingId={booking.bookingId}
            bookingVersion={booking.bookingVersion}
            canCancel={presentation.actions.canCancel}
            canRequestReschedule={presentation.actions.canReschedule}
            cancelDisabledReason={
              presentation.actions.canCancel
                ? null
                : getSessionOperationDisabledReason(booking, "cancel")
            }
            cancellationImpactLabel="A política operacional será aplicada antes de alterar agenda, pagamento ou repasse."
            reschedule={pendingReschedule}
            rescheduleDisabledReason={
              presentation.actions.canReschedule
                ? null
                : getSessionOperationDisabledReason(booking, "reschedule")
            }
          />

          <SessionAdditionalLinks booking={booking} />
        </AppPageMain>

        <AppPageAside className="auto-rows-min self-start content-start !grid-cols-1 lg:!grid-cols-2 xl:!block">
          <SessionActionRail
            booking={booking}
            feedbackStatus={feedbackStatus}
            presentation={presentation}
          />
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}

function SessionOverview({
  booking,
  presentation,
}: {
  booking: TherapistSessionDetailReadModel;
  presentation: SessionPresentation;
}) {
  const patientJourneyRoute = routes.therapist.patientJourney(booking.patientProfileId);

  return (
    <section className="overflow-hidden rounded-panel border border-brand-lavender/60 bg-white shadow-card">
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <AvatarInitials name={booking.patientName} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-semibold text-brand-deep sm:text-2xl">
                {booking.patientName}
              </p>
              <BookingReference id={booking.bookingId} />
              <p className="mt-1 text-sm text-tesText-secondary">
                {booking.serviceTitle} · Atendimento online
              </p>
            </div>
            <SessionStatusBadge presentation={presentation} />
          </div>

          <dl className="grid gap-x-5 gap-y-4 border-t border-brand-lavender/50 pt-5 sm:grid-cols-2 xl:grid-cols-4">
            <SessionFact icon={CalendarDays} label="Data" value={formatSessionDate(booking)} />
            <SessionFact icon={Clock3} label="Horário" value={formatSessionTimeRange(booking)} />
            <SessionFact icon={Clock3} label="Duração" value={formatDuration(booking.durationMinutes)} />
            <SessionFact icon={CheckCheck} label="Terapia" value={booking.serviceTitle} />
          </dl>
        </div>

        <div className="rounded-card bg-brand-lavenderSoft/55 p-5">
          <div className="flex items-center gap-2 text-brand-primary">
            <ShieldCheck aria-hidden="true" className="size-5" />
            <h2 className="text-base font-semibold text-brand-deep">O que precisa agora</h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-5 text-tesText-secondary">
            <li className="flex gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-state-success" />
              {presentation.description}
            </li>
            <li className="flex gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-state-success" />
              Confirme se o seu ambiente está confortável e reservado antes do horário.
            </li>
            <li className="flex gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-state-success" />
              A entrada na sala será revalidada quando você a abrir.
            </li>
          </ul>
          <Link
            className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-control border border-brand-lavender bg-white px-3 text-sm font-semibold text-brand-primary transition-colors hover:border-brand-primary hover:text-brand-deep"
            href={patientJourneyRoute}
          >
            Ver jornada da pessoa
            <ExternalLink aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SessionReadiness({
  booking,
  feedbackStatus,
  presentation,
}: {
  booking: TherapistSessionDetailReadModel;
  feedbackStatus: TherapistSessionFeedbackStatus;
  presentation: SessionPresentation;
}) {
  const postSessionAction = getTherapistPostSessionAction({
    endsAt: booking.endsAt,
    feedbackStatus,
  });
  const sessionEnded = postSessionAction !== "room";
  const canOpenRoom = presentation.actions.canAccessZoom;

  return (
    <section className="grid gap-5 md:grid-cols-2" aria-label="Status operacional da sessão">
      <StatusSurface
        description={getFinancialStatusDescription(booking.financialStatus)}
        icon={CreditCard}
        label="Pagamento"
        tone={booking.financialStatus === "paid" ? "success" : "warning"}
        value={formatFinancialStatus(booking.financialStatus)}
      />
      <StatusSurface
        action={
          sessionEnded ? undefined : (
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-brand-lavender px-3 text-sm font-semibold text-brand-primary transition-colors hover:border-brand-primary hover:text-brand-deep"
            href={routes.therapist.sessionVideo(booking.bookingId)}
          >
            <Video aria-hidden="true" className="size-4" />
            {canOpenRoom ? "Abrir sala" : "Ver status da sala"}
          </Link>
          )
        }
        description={
          sessionEnded
            ? "O horário agendado foi encerrado. A confirmação da sessão segue disponível conforme o seu estado atual."
            : "O acesso é avaliado novamente ao abrir a sala."
        }
        icon={Video}
        label="Sala de atendimento"
        tone={sessionEnded ? "brand" : canOpenRoom ? "success" : "brand"}
        value={sessionEnded ? "Horário encerrado" : getZoomAccessLabel(booking.zoomAccess)}
      />
      {sessionEnded ? (
        <StatusSurface
          action={
            postSessionAction === "confirm" ? (
              <Link
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-brand-lavender px-3 text-sm font-semibold text-brand-primary transition-colors hover:border-brand-primary hover:text-brand-deep"
                href={`${routes.therapist.sessionVideo(booking.bookingId)}?feedback=1`}
              >
                <Star aria-hidden="true" className="size-4" />
                Confirmar sessão
              </Link>
            ) : undefined
          }
          description={feedbackStatusDescription(postSessionAction)}
          icon={CheckCheck}
          label="Confirmação da sessão"
          tone={postSessionAction === "confirm" ? "success" : "brand"}
          value={feedbackStatusLabel(postSessionAction)}
        />
      ) : null}
    </section>
  );
}

function SessionAbout({
  booking,
  presentation,
}: {
  booking: TherapistSessionDetailReadModel;
  presentation: SessionPresentation;
}) {
  return (
    <section className="rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Info aria-hidden="true" className="size-5" />
        </span>
        <h2 className="font-display text-3xl italic leading-none text-brand-deep">Sobre esta sessão</h2>
      </div>
      <p className="mt-5 text-sm leading-6 text-tesText-secondary">
        Esta sessão faz parte do acompanhamento com {booking.patientName}. As informações abaixo ajudam a organizar o atendimento, sem expor registros privados da pessoa.
      </p>
      <dl className="mt-5 divide-y divide-brand-lavender/50 border-y border-brand-lavender/50">
        <SummaryRow label="Estado atual" value={presentation.label} />
        <SummaryRow label="Valor reservado" value={formatSessionMoney(booking.priceCents, booking.currency)} />
        <SummaryRow label="Formato" value="Atendimento online" />
      </dl>
    </section>
  );
}

function SessionPreparation() {
  const items = [
    "Escolha um ambiente tranquilo e reservado.",
    "Tenha água e os materiais de apoio por perto.",
    "Verifique câmera, microfone e conexão com antecedência.",
    "Chegue alguns minutos antes para acolher a pessoa com calma.",
  ];

  return (
    <section className="rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-state-successSoft text-state-success">
          <Check aria-hidden="true" className="size-5" />
        </span>
        <h2 className="font-display text-3xl italic leading-none text-brand-deep">Preparação antes do encontro</h2>
      </div>
      <ul className="mt-5 space-y-4">
        {items.map((item) => (
          <li className="flex gap-3 text-sm leading-5 text-tesText-secondary" key={item}>
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-state-success" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SessionAdditionalLinks({ booking }: { booking: TherapistSessionDetailReadModel }) {
  return (
    <section className="overflow-hidden rounded-panel border border-brand-lavender/60 bg-white shadow-card">
      <Link
        className="flex min-h-16 items-center gap-4 border-b border-brand-lavender/50 px-5 py-4 transition-colors hover:bg-brand-lavenderSoft/35 sm:px-6"
        href={routes.therapist.patientJourney(booking.patientProfileId)}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Info aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-brand-deep">Jornada da pessoa</span>
          <span className="mt-0.5 block text-xs leading-5 text-tesText-secondary">Consulte informações compartilhadas e permitidas para o acompanhamento.</span>
        </span>
        <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-brand-primary" />
      </Link>
      <Link
        className="flex min-h-16 items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-lavenderSoft/35 sm:px-6"
        href={routes.public.terms}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-brand-deep">Política de cancelamento e reagendamento</span>
          <span className="mt-0.5 block text-xs leading-5 text-tesText-secondary">Consulte as regras aplicáveis à sessão contratada.</span>
        </span>
        <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-brand-primary" />
      </Link>
    </section>
  );
}

function SessionActionRail({
  booking,
  feedbackStatus,
  presentation,
}: {
  booking: TherapistSessionDetailReadModel;
  feedbackStatus: TherapistSessionFeedbackStatus;
  presentation: SessionPresentation;
}) {
  const postSessionAction = getTherapistPostSessionAction({
    endsAt: booking.endsAt,
    feedbackStatus,
  });
  const sessionEnded = postSessionAction !== "room";
  const canOpenRoom = presentation.actions.canAccessZoom;

  return (
    <>
      <section className="h-auto self-start rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card xl:mb-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <Clock3 aria-hidden="true" className="size-5" />
          </span>
          <h2 className="font-display text-3xl italic leading-none text-brand-deep">Próximas ações</h2>
        </div>
        <p className="mt-5 text-sm font-semibold text-brand-deep">{presentation.label}</p>
        <p className="mt-1 text-sm leading-5 text-tesText-secondary">{presentation.description}</p>
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-deep">
          <CalendarDays aria-hidden="true" className="size-4 text-brand-primary" />
          {formatSessionDateTime(booking.startsAt, booking.timezone)}
        </p>
        {sessionEnded ? (
          postSessionAction === "confirm" ? (
            <Link
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
              href={`${routes.therapist.sessionVideo(booking.bookingId)}?feedback=1`}
            >
              <CheckCheck aria-hidden="true" className="size-4" />
              Confirmar sessão
            </Link>
          ) : (
            <p className="mt-5 rounded-control bg-brand-lavenderSoft px-4 py-3 text-sm font-semibold leading-5 text-tesText-secondary">
              {feedbackStatusDescription(postSessionAction)}
            </p>
          )
        ) : (
          <Link
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
            href={routes.therapist.sessionVideo(booking.bookingId)}
          >
            <Video aria-hidden="true" className="size-4" />
            {canOpenRoom ? "Abrir sala" : "Acompanhar a sala"}
          </Link>
        )}
        <Link
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-control border border-brand-lavender px-3 text-sm font-semibold text-brand-primary transition-colors hover:border-brand-primary hover:text-brand-deep"
          href={routes.therapist.agenda}
        >
          Ver agenda completa
        </Link>
      </section>

      <section className="h-auto self-start rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card xl:mb-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <CircleHelp aria-hidden="true" className="size-5" />
          </span>
          <h2 className="font-display text-3xl italic leading-none text-brand-deep">Suporte rápido</h2>
        </div>
        <p className="mt-4 text-sm leading-6 text-tesText-secondary">
          Se algo não sair como o esperado, envie uma mensagem para o suporte.
        </p>
        <Link
          className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-control border border-brand-lavender px-3 text-sm font-semibold text-brand-primary transition-colors hover:border-brand-primary hover:text-brand-deep"
          href={`${routes.therapist.messages}?context=suporte`}
        >
          Abrir Mensagens
        </Link>
      </section>

      <section className="h-auto self-start rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card xl:last:mb-0 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <Laptop aria-hidden="true" className="size-5" />
          </span>
          <h2 className="font-display text-3xl italic leading-none text-brand-deep">Orientações rápidas</h2>
        </div>
        <ul className="mt-5 space-y-3 text-sm leading-5 text-tesText-secondary">
          <li>O acesso à sala é revalidado sempre que ela é aberta.</li>
          <li>Reagendamentos e cancelamentos seguem as regras desta sessão.</li>
          <li>Envie uma mensagem ao suporte se precisar de orientação adicional.</li>
        </ul>
        <Link
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-deep"
          href={routes.public.zoomHelp}
        >
          Como funciona a sala online
          <ExternalLink aria-hidden="true" className="size-4" />
        </Link>
      </section>
    </>
  );
}

function feedbackStatusLabel(status: ReturnType<typeof getTherapistPostSessionAction>) {
  if (status === "confirm") return "Confirmação disponível";
  if (status === "submitted") return "Confirmação registrada";
  return "Confirmação indisponível";
}

function feedbackStatusDescription(status: ReturnType<typeof getTherapistPostSessionAction>) {
  if (status === "confirm") {
    return "Registre como a sessão aconteceu para concluir sua confirmação operacional.";
  }
  if (status === "submitted") {
    return "Sua confirmação desta sessão já foi registrada.";
  }
  return "A confirmação desta sessão não está disponível no momento.";
}

function StatusSurface({
  action,
  description,
  icon: Icon,
  label,
  tone,
  value,
}: {
  action?: React.ReactNode;
  description: string;
  icon: typeof CreditCard;
  label: string;
  tone: "brand" | "success" | "warning";
  value: string;
}) {
  const tones = {
    brand: "bg-brand-lavenderSoft text-brand-primary",
    success: "bg-state-successSoft text-state-success",
    warning: "bg-state-warningSoft text-state-warning",
  };

  return (
    <section className="rounded-panel border border-brand-lavender/60 bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${tones[tone]}`}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-deep">{label}</p>
          <p className="mt-1 text-lg font-semibold text-brand-deep">{value}</p>
          <p className="mt-1 text-sm leading-5 text-tesText-secondary">{description}</p>
        </div>
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

function SessionFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-tesText-secondary">
        <Icon aria-hidden="true" className="size-3.5 text-brand-primary" />
        {label}
      </dt>
      <dd className="mt-1.5 truncate text-sm font-semibold text-brand-deep" title={value}>
        {value}
      </dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-tesText-secondary">{label}</dt>
      <dd className="text-right text-sm font-semibold text-brand-deep">{value}</dd>
    </div>
  );
}

function SessionStatusBadge({ presentation }: { presentation: SessionPresentation }) {
  const toneClasses = {
    brand: "bg-brand-lavenderSoft text-brand-primary",
    danger: "bg-state-dangerSoft text-state-danger",
    info: "bg-brand-lavenderSoft text-brand-primary",
    neutral: "bg-tesSurface-subtle text-tesText-secondary",
    success: "bg-state-successSoft text-state-success",
    warning: "bg-state-warningSoft text-state-warning",
  };

  return (
    <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ${toneClasses[presentation.tone]}`}>
      {presentation.label}
    </span>
  );
}

function AvatarInitials({ name, size }: { name: string; size: "lg" | "md" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const sizeClass = size === "lg" ? "size-16 text-xl" : "size-11 text-base";

  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-brand-lavenderSoft font-semibold text-brand-primary ${sizeClass}`}>
      {initials || "P"}
    </span>
  );
}

function SessionDetailErrorState({ error }: { error: { correlationId: string } }) {
  return (
    <AppPageContainer>
      <section className="max-w-2xl rounded-panel border border-state-danger/30 bg-white p-6 shadow-card">
        <h1 className="font-display text-4xl italic text-brand-deep">Não foi possível carregar esta sessão</h1>
        <p className="mt-3 text-sm leading-6 text-tesText-secondary">
          Tente novamente em instantes. Se o problema continuar, entre em contato com o suporte.
        </p>
        <p className="mt-4 text-xs text-tesText-secondary">Referência: {error.correlationId}</p>
        <Link
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-control bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-deep"
          href={routes.therapist.sessions}
        >
          Voltar para sessões
        </Link>
      </section>
    </AppPageContainer>
  );
}

function formatFinancialStatus(status: string | null) {
  const labels: Record<string, string> = {
    canceled: "Cancelado",
    paid: "Confirmado",
    pending: "Aguardando confirmação",
    processing: "Em processamento",
    failed: "Não confirmado",
    refunded: "Reembolsado",
    partially_refunded: "Reembolso parcial",
    disputed: "Em análise",
  };

  return status ? labels[status] : "Aguardando confirmação";
}

function getFinancialStatusDescription(status: string | null) {
  const descriptions: Record<string, string> = {
    canceled: "Esta sessão foi cancelada.",
    paid: "O pagamento desta sessão foi confirmado.",
    pending: "A confirmação do pagamento ainda está em andamento.",
    processing: "A confirmação do pagamento ainda está em andamento.",
    failed: "Há uma pendência de pagamento para esta sessão.",
    refunded: "Um reembolso foi registrado para esta sessão.",
    partially_refunded: "Há um reembolso parcial registrado para esta sessão.",
    disputed: "Há uma ocorrência de pagamento em análise.",
  };

  return status ? descriptions[status] ?? "A confirmação de pagamento ainda não está disponível." : "A confirmação de pagamento ainda não está disponível.";
}

function formatSessionDate(booking: TherapistSessionDetailReadModel) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: booking.timezone,
  })
    .format(new Date(booking.startsAt))
    .replace(".", "");
}

function formatSessionTimeRange(booking: TherapistSessionDetailReadModel) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: booking.timezone,
  });

  return `${formatter.format(new Date(booking.startsAt))} – ${formatter.format(new Date(booking.endsAt))}`;
}

function formatDuration(durationMinutes: number) {
  if (durationMinutes % 60 === 0) {
    return `${durationMinutes / 60}h`;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, "0")}` : `${minutes} min`;
}
