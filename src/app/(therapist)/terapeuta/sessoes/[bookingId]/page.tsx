import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CheckCheck,
  CircleHelp,
  Clock3,
  CreditCard,
  ExternalLink,
  Info,
  Laptop,
  ShieldCheck,
  Video,
} from "lucide-react";

import {
  AppPageContainer,
  AppPageGrid,
  AppPageMain,
} from "@/components/app-page/app-page";
import {
  BookingReference,
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
  const therapist = await requireTherapistSession(
    therapistRoutePolicies.sessions,
  );
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
    <AppPageContainer className="max-w-[1146px] gap-5 pb-14 sm:gap-6 lg:gap-7">
      <SessionDetailHeader />
      <SessionOverview
        booking={booking}
        feedbackStatus={feedbackStatus}
        presentation={presentation}
      />
      <SessionStatusStrip
        booking={booking}
        feedbackStatus={feedbackStatus}
        presentation={presentation}
      />

      <AppPageGrid className="gap-5 xl:grid-cols-[minmax(0,1fr)_296px] xl:items-start xl:gap-6">
        <aside className="order-1 grid min-w-0 gap-5 lg:order-2 xl:col-start-2 xl:row-start-1 xl:sticky xl:top-28">
          <SessionSupportCard bookingId={booking.bookingId} />
          <SessionGuidanceCard />
        </aside>

        <AppPageMain className="order-2 gap-5 lg:order-1 xl:col-start-1 xl:row-span-2">
          <SessionAbout booking={booking} presentation={presentation} />
          <SessionOnlineAccess
            booking={booking}
            feedbackStatus={feedbackStatus}
            presentation={presentation}
          />
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

        <div className="order-3 grid gap-5 lg:order-3 xl:col-start-2 xl:row-start-2">
          <SessionPreparation />
        </div>
      </AppPageGrid>
    </AppPageContainer>
  );
}

function SessionOverview({
  booking,
  feedbackStatus,
  presentation,
}: {
  booking: TherapistSessionDetailReadModel;
  feedbackStatus: TherapistSessionFeedbackStatus;
  presentation: SessionPresentation;
}) {
  const patientJourneyRoute = routes.therapist.patientJourney(
    booking.patientProfileId,
  );
  const statusSurfaceClass = {
    brand: "xl:border-brand-lavender xl:bg-brand-lavenderSoft/45",
    danger: "xl:border-status-danger/25 xl:bg-status-dangerBg/45",
    info: "xl:border-brand-lavender xl:bg-brand-lavenderSoft/45",
    neutral: "xl:border-border xl:bg-surface-soft",
    success: "xl:border-status-success/25 xl:bg-status-successBg/45",
    warning: "xl:border-status-warning/25 xl:bg-status-warningBg/45",
  }[presentation.tone];

  return (
    <>
      <section className="rounded-card border border-border bg-white p-5 shadow-card sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(14rem,0.9fr)_minmax(16rem,1.05fr)] xl:gap-0">
          <div className="min-w-0 xl:pr-7">
            <div className="flex items-center gap-4 sm:gap-5">
              <AvatarInitials name={booking.patientName} size="lg" />
              <div className="min-w-0">
                <h2
                  className="truncate text-[1.65rem] font-extrabold leading-tight text-brand-deep sm:text-[1.9rem]"
                  title={booking.patientName}
                >
                  {booking.patientName}
                </h2>
                <BookingReference
                  id={booking.bookingId}
                  reference={booking.sessionReference}
                />
                <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
                  {booking.serviceTitle} · Atendimento online
                </p>
                <Link
                  className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                  href={patientJourneyRoute}
                >
                  Ver jornada da pessoa
                  <ExternalLink aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 border-t border-border pt-5 sm:gap-4 xl:grid-cols-1 xl:border-l xl:border-t-0 xl:px-7 xl:pt-0">
            <SessionFact
              icon={CalendarDays}
              label="Data"
              value={formatSessionDate(booking)}
            />
            <SessionFact
              icon={Clock3}
              label="Horário"
              supporting={formatDuration(booking.durationMinutes)}
              value={formatSessionTimeRange(booking)}
            />
            <SessionFact
              icon={Video}
              label="Sala"
              supporting="Videoconferência"
              value={getZoomAccessLabel(booking.zoomAccess)}
            />
          </dl>

          <div
            className={`grid gap-4 border-t border-border pt-5 xl:ml-3 xl:border xl:p-4 xl:pt-4 ${statusSurfaceClass}`}
          >
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
                Status
              </p>
              <div className="mt-2">
                <SessionStatusBadge presentation={presentation} />
              </div>
            </div>
            <p className="text-sm font-semibold leading-6 text-tesText-secondary">
              {presentation.description}
            </p>
            <div className="hidden xl:block">
              <SessionPrimaryAction
                booking={booking}
                feedbackStatus={feedbackStatus}
                presentation={presentation}
              />
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-3 xl:hidden">
        <SessionPrimaryAction
          booking={booking}
          feedbackStatus={feedbackStatus}
          presentation={presentation}
        />
      </div>
    </>
  );
}

function SessionStatusStrip({
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
  return (
    <section
      className="grid grid-cols-3 overflow-hidden rounded-card border border-border bg-white shadow-card"
      aria-label="Resumo do estado da sessão"
    >
      <StatusStripItem
        description={getFinancialStatusDescription(booking.financialStatus)}
        icon={CreditCard}
        label="Pagamento"
        tone={booking.financialStatus === "paid" ? "success" : "warning"}
        value={formatFinancialStatus(booking.financialStatus)}
      />
      <StatusStripItem
        description={
          sessionEnded
            ? "O horário agendado foi encerrado. A confirmação da sessão segue disponível conforme o seu estado atual."
            : "O acesso é avaliado novamente ao abrir a sala."
        }
        icon={Video}
        label="Sala de atendimento"
        tone={
          sessionEnded
            ? "brand"
            : presentation.actions.canAccessZoom
              ? "success"
              : "brand"
        }
        value={
          sessionEnded
            ? "Horário encerrado"
            : getZoomAccessLabel(booking.zoomAccess)
        }
      />
      <StatusStripItem
        description={
          sessionEnded
            ? feedbackStatusDescription(postSessionAction)
            : presentation.description
        }
        icon={sessionEnded ? CheckCheck : ShieldCheck}
        label="Sessão"
        tone={
          sessionEnded && postSessionAction === "confirm" ? "success" : "brand"
        }
        value={
          sessionEnded
            ? feedbackStatusLabel(postSessionAction)
            : presentation.label
        }
      />
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
    <section className="rounded-card border border-border bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Info aria-hidden="true" className="size-5" />
        </span>
        <h2 className="font-display text-[1.9rem] font-light italic leading-none text-brand-deep sm:text-[2.2rem]">
          Sobre esta sessão
        </h2>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
            Contexto operacional
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
            Esta sessão está reservada para o acompanhamento com{" "}
            <span className="font-extrabold text-brand-deep">
              {booking.patientName}
            </span>
            . As informações aqui ajudam a organizar o atendimento, sem expor
            registros privados da pessoa.
          </p>
        </div>
        <div className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
            Estado atual
          </p>
          <p className="mt-3 text-sm font-extrabold leading-6 text-brand-deep sm:text-base">
            {presentation.label}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {presentation.description}
          </p>
        </div>
        <div className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
            Sessão contratada
          </p>
          <p className="mt-3 text-sm font-extrabold leading-6 text-brand-deep sm:text-base">
            {formatSessionMoney(booking.priceCents, booking.currency)}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Atendimento online · {booking.serviceTitle}
          </p>
        </div>
      </div>
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
    <section className="rounded-card border border-border bg-white p-5 shadow-card sm:p-7">
      <h2 className="font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]">
        Antes da sessão
      </h2>
      <div className="mt-6 rounded-[24px] bg-surface-soft p-5 sm:p-6">
        <p className="text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          Use este tempo para deixar o ambiente reservado e entrar na sala com
          tranquilidade.
        </p>
        <ul className="mt-5 space-y-3">
          {items.map((item) => (
            <li
              className="flex gap-3 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base"
              key={item}
            >
              <CheckCircle2
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-brand-primary"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SessionAdditionalLinks({
  booking,
}: {
  booking: TherapistSessionDetailReadModel;
}) {
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
          <span className="block text-sm font-semibold text-brand-deep">
            Jornada da pessoa
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-tesText-secondary">
            Consulte informações compartilhadas e permitidas para o
            acompanhamento.
          </span>
        </span>
        <ExternalLink
          aria-hidden="true"
          className="size-4 shrink-0 text-brand-primary"
        />
      </Link>
      <Link
        className="flex min-h-16 items-center gap-4 px-5 py-4 transition-colors hover:bg-brand-lavenderSoft/35 sm:px-6"
        href={routes.public.terms}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-brand-deep">
            Política de cancelamento e reagendamento
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-tesText-secondary">
            Consulte as regras aplicáveis à sessão contratada.
          </span>
        </span>
        <ExternalLink
          aria-hidden="true"
          className="size-4 shrink-0 text-brand-primary"
        />
      </Link>
    </section>
  );
}

function SessionSupportCard({ bookingId }: { bookingId: string }) {
  return (
    <section className="rounded-card border border-border bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <CircleHelp aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-tesText-muted sm:text-xs">
            Suporte
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-brand-deep sm:text-xl">
            Precisa de ajuda?
          </h2>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
        Se algo não sair como o esperado, envie uma mensagem para o suporte.
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-brand-lavender px-4 text-sm font-extrabold text-brand-primary transition-colors hover:border-brand-primary hover:text-brand-deep"
        href={`${routes.therapist.messages}?context=suporte&booking=${bookingId}`}
      >
        Abrir Mensagens
      </Link>
    </section>
  );
}

function SessionGuidanceCard() {
  return (
    <section className="rounded-card border border-border bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Laptop aria-hidden="true" className="size-5" />
        </span>
        <h2 className="font-display text-[2rem] font-light italic leading-none text-brand-deep">
          Orientações rápidas
        </h2>
      </div>
      <ul className="mt-5 space-y-3 text-sm font-semibold leading-6 text-tesText-secondary">
        <li>O acesso à sala é revalidado sempre que ela é aberta.</li>
        <li>Reagendamentos e cancelamentos seguem as regras desta sessão.</li>
      </ul>
      <Link
        className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-brand-primary underline-offset-4 hover:underline"
        href={routes.public.zoomHelp}
      >
        Como funciona a sala online
        <ExternalLink aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}

function SessionDetailHeader() {
  return (
    <header className="pt-1 sm:pt-2">
      <nav
        aria-label="Trilha de navegação"
        className="hidden items-center gap-2 text-sm font-semibold text-tesText-secondary sm:flex"
      >
        <Link
          className="inline-flex min-h-11 items-center rounded-md px-1 text-brand-primary transition hover:text-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.therapist.sessions}
        >
          Sessões
        </Link>
        <span aria-hidden="true" className="text-brand-lavender">
          /
        </span>
        <span aria-current="page" className="text-brand-deep">
          Detalhes da sessão
        </span>
      </nav>
      <div className="flex items-center gap-3 sm:hidden">
        <Link
          aria-label="Voltar para sessões"
          className="grid size-11 place-items-center rounded-full text-brand-primary transition hover:bg-brand-lavenderSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          href={routes.therapist.sessions}
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <span className="text-sm font-extrabold text-brand-deep">Sessões</span>
      </div>
      <div className="mt-5 sm:mt-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-primary sm:text-xs">
          Rotina de atendimento
        </p>
        <h1 className="mt-2 font-display text-[2.5rem] font-light italic leading-[0.96] text-brand-deep sm:text-5xl">
          Detalhes da sessão
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          Acompanhe o status, prepare a sala e gerencie esta sessão com clareza.
        </p>
      </div>
    </header>
  );
}

function SessionOnlineAccess({
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

  return (
    <section className="grid gap-6 rounded-card border border-border bg-white p-5 shadow-card sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Video aria-hidden="true" className="size-5" />
        </span>
        <h2 className="font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]">
          Sala de atendimento
        </h2>
      </div>
      <div className="grid gap-5 rounded-[24px] border border-brand-lavender p-4 sm:p-5 lg:grid-cols-2 lg:gap-0">
        <div className="grid gap-4 lg:border-r lg:border-border lg:pr-6">
          <div>
            <p className="text-base font-extrabold text-brand-deep sm:text-lg">
              Acesso à sessão
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
              {sessionEnded
                ? feedbackStatusDescription(postSessionAction)
                : "A entrada é avaliada novamente ao abrir a sala."}
            </p>
          </div>
          <SessionPrimaryAction
            booking={booking}
            feedbackStatus={feedbackStatus}
            presentation={presentation}
          />
        </div>
        <div className="grid gap-3 border-t border-border pt-5 lg:border-t-0 lg:pl-6 lg:pt-0">
          <p className="text-base font-extrabold text-brand-deep sm:text-lg">
            Preparação técnica
          </p>
          <ul className="grid gap-2">
            <li className="flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary">
              <ShieldCheck
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-status-success"
              />
              Mantenha câmera, microfone e conexão prontos para o horário.
            </li>
            <li className="flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary">
              <ShieldCheck
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-status-success"
              />
              A sala não exibe nem compartilha credenciais de acesso.
            </li>
          </ul>
        </div>
      </div>
      <div className="rounded-[22px] bg-surface-soft p-4 sm:p-5">
        <p className="flex gap-2 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-brand-primary"
          />
          A abertura da sala depende da janela da sessão, do pagamento e das
          permissões válidas naquele momento.
        </p>
      </div>
    </section>
  );
}

function SessionPrimaryAction({
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

  if (postSessionAction === "confirm") {
    return (
      <Link
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-6 text-base font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        href={`${routes.therapist.sessionVideo(booking.bookingId)}?feedback=1`}
      >
        <CheckCheck aria-hidden="true" className="size-5" />
        Confirmar sessão
      </Link>
    );
  }

  if (postSessionAction !== "room") {
    return (
      <p className="rounded-[22px] bg-surface-soft px-4 py-3 text-center text-sm font-semibold leading-5 text-tesText-secondary">
        {feedbackStatusDescription(postSessionAction)}
      </p>
    );
  }

  return (
    <Link
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-6 text-base font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      href={routes.therapist.sessionVideo(booking.bookingId)}
    >
      <Video aria-hidden="true" className="size-5" />
      {presentation.actions.canAccessZoom ? "Abrir sala" : "Acompanhar a sala"}
    </Link>
  );
}

function feedbackStatusLabel(
  status: ReturnType<typeof getTherapistPostSessionAction>,
) {
  if (status === "confirm") return "Confirmação disponível";
  if (status === "submitted") return "Confirmação registrada";
  return "Confirmação indisponível";
}

function feedbackStatusDescription(
  status: ReturnType<typeof getTherapistPostSessionAction>,
) {
  if (status === "confirm") {
    return "Registre como a sessão aconteceu para concluir sua confirmação operacional.";
  }
  if (status === "submitted") {
    return "Sua confirmação desta sessão já foi registrada.";
  }
  return "A confirmação desta sessão não está disponível no momento.";
}

function StatusStripItem({
  description,
  icon: Icon,
  label,
  tone,
  value,
}: {
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
    <div className="flex min-w-0 flex-col gap-2 border-l border-border p-3 first:border-l-0 sm:flex-row sm:gap-3 sm:p-5">
      <span
        className={`grid size-9 shrink-0 place-items-center self-start rounded-full ${tones[tone]} sm:size-10`}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-5 text-brand-deep sm:text-base">
          {label}
        </p>
        <p className="mt-1 text-sm font-extrabold leading-5 text-brand-deep sm:text-base">
          {value}
        </p>
        <p className="mt-1 text-[11px] font-semibold leading-4 text-tesText-secondary sm:text-sm sm:leading-5">
          {description}
        </p>
      </div>
    </div>
  );
}

function SessionFact({
  icon: Icon,
  label,
  supporting,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  supporting?: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex min-w-0 items-center gap-1 text-[13px] font-extrabold text-brand-deep sm:gap-2 sm:text-sm">
        <Icon
          aria-hidden="true"
          className="size-[19px] shrink-0 text-brand-primary"
        />
        {label}
      </dt>
      <dd
        className="mt-1 break-words text-sm font-extrabold leading-5 text-brand-deep sm:text-base sm:leading-6"
        title={value}
      >
        {value}
      </dd>
      {supporting ? (
        <p className="break-words text-[13px] font-semibold leading-5 text-tesText-secondary sm:text-sm">
          {supporting}
        </p>
      ) : null}
    </div>
  );
}

function SessionStatusBadge({
  presentation,
}: {
  presentation: SessionPresentation;
}) {
  const toneClasses = {
    brand: "bg-brand-lavenderSoft text-brand-primary",
    danger: "bg-state-dangerSoft text-state-danger",
    info: "bg-brand-lavenderSoft text-brand-primary",
    neutral: "bg-tesSurface-subtle text-tesText-secondary",
    success: "bg-state-successSoft text-state-success",
    warning: "bg-state-warningSoft text-state-warning",
  };

  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ${toneClasses[presentation.tone]}`}
    >
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
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-brand-lavenderSoft font-semibold text-brand-primary ${sizeClass}`}
    >
      {initials || "P"}
    </span>
  );
}

function SessionDetailErrorState({
  error,
}: {
  error: { correlationId: string };
}) {
  return (
    <AppPageContainer>
      <section className="max-w-2xl rounded-panel border border-state-danger/30 bg-white p-6 shadow-card">
        <h1 className="font-display text-4xl italic text-brand-deep">
          Não foi possível carregar esta sessão
        </h1>
        <p className="mt-3 text-sm leading-6 text-tesText-secondary">
          Tente novamente em instantes. Se o problema continuar, entre em
          contato com o suporte.
        </p>
        <p className="mt-4 text-xs text-tesText-secondary">
          Referência: {error.correlationId}
        </p>
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

  return status
    ? (descriptions[status] ??
        "A confirmação de pagamento ainda não está disponível.")
    : "A confirmação de pagamento ainda não está disponível.";
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
  return hours > 0
    ? `${hours}h${String(minutes).padStart(2, "0")}`
    : `${minutes} min`;
}
