"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  CreditCard,
  Info,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import { PublicLogo, TESButton, TESCard } from "@/components/tes";
import {
  PromotionCodeField,
  type PromotionCheckoutAmounts,
} from "@/features/payments";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import {
  buildClientAuthHref,
  buildReservationHref,
  buildReservationReturnHref,
  buildReservationSchedule,
} from "../reservation-data";
import type { AvailabilityDay } from "@/features/therapist-profile/types";
import type {
  ReservationContext,
  ReservationSchedule,
  ReservationStep,
} from "../types";
import { CheckoutButton, ReservationLinkButton } from "./checkout-button";
import { HoldCountdown } from "./hold-countdown";
import { PrepareForm } from "./prepare-form";

export function ReservationPage({
  availabilityDays,
  context,
}: {
  availabilityDays?: AvailabilityDay[];
  context: ReservationContext;
}) {
  const router = useRouter();
  const schedule = buildReservationSchedule(context, availabilityDays);
  const loginHref = buildClientAuthHref("login", context.currentPath);
  const signupHref = buildClientAuthHref("signup", context.currentPath);
  const reservationKey = `${context.serviceId ?? "service"}:${context.selectedSlot ?? "slot"}`;
  const query = useMemo(
    () => new URLSearchParams(context.currentPath.split("?")[1] ?? ""),
    [context.currentPath],
  );
  const momentStepHref = useMemo(
    () => buildReservationHref(query, { etapa: "momento" }),
    [query],
  );
  const prepareStepHref = useMemo(
    () => buildReservationHref(query, { etapa: "preparar" }),
    [query],
  );
  const paymentStepHref = useMemo(
    () => buildReservationHref(query, { etapa: "pagamento" }),
    [query],
  );
  const therapistProfileHref = buildReservationReturnHref(
    context.therapist.slug,
  );
  const [currentStep, setCurrentStep] = useState<ReservationStep>(() =>
    context.selectedSlotHasPatientConflict
      ? "momento"
      : context.step === "pagamento"
        ? context.hasRequiredCheckoutData
          ? "preparar"
          : "momento"
        : context.step,
  );
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [sharedNote, setSharedNote] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionRequest, setPromotionRequest] = useState<{
    code: string | null;
    requestId: string;
  } | null>(null);
  const [promotionAmounts, setPromotionAmounts] =
    useState<PromotionCheckoutAmounts | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [promotionPending, setPromotionPending] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const previousReservationKeyRef = useRef(reservationKey);
  const [journeyError, setJourneyError] = useState<string | null>(
    context.selectedSlotHasPatientConflict
      ? "Você já tem outro encontro nesse horário. Escolha outro momento."
      : context.step === "pagamento"
        ? "Aceite os termos antes de seguir para o pagamento."
        : null,
  );

  useEffect(() => {
    if (previousReservationKeyRef.current === reservationKey) return;
    previousReservationKeyRef.current = reservationKey;
    setAcceptedTerms(false);
    setMarketingConsent(false);
    setSharedNote("");
    setPromotionCode("");
    setPromotionRequest(null);
    setPromotionAmounts(null);
    setPromotionError(null);
    setPromotionPending(false);
    setCheckoutReady(false);
    setJourneyError(
      context.selectedSlotHasPatientConflict
        ? "Você já tem outro encontro nesse horário. Escolha outro momento."
        : context.step === "pagamento"
          ? "Aceite os termos antes de seguir para o pagamento."
          : null,
    );
    setCurrentStep(
      context.selectedSlotHasPatientConflict
        ? "momento"
        : context.step === "pagamento"
          ? context.hasRequiredCheckoutData
            ? "preparar"
            : "momento"
          : context.step,
    );
  }, [
    context.hasRequiredCheckoutData,
    context.selectedSlotHasPatientConflict,
    context.step,
    reservationKey,
  ]);

  useEffect(() => {
    if (context.selectedSlotHasPatientConflict) {
      setCurrentStep("momento");
      return;
    }
    if (context.step === "pagamento" && !acceptedTerms) {
      setCurrentStep(context.hasRequiredCheckoutData ? "preparar" : "momento");
      return;
    }

    setCurrentStep(context.step);
  }, [
    acceptedTerms,
    context.hasRequiredCheckoutData,
    context.selectedSlotHasPatientConflict,
    context.step,
  ]);

  useEffect(() => {
    if (context.selectedSlotHasPatientConflict) {
      router.replace(momentStepHref);
      return;
    }
    if (context.step === "pagamento" && !acceptedTerms) {
      router.replace(prepareStepHref);
    }
  }, [
    acceptedTerms,
    context.selectedSlotHasPatientConflict,
    context.step,
    momentStepHref,
    prepareStepHref,
    router,
  ]);

  const canPrepare =
    context.canPrepareEncounter && context.isPatientAuthenticated;
  const canPay = canPrepare && acceptedTerms;
  const activeContext = { ...context, step: currentStep };
  const handleCheckoutChange = useCallback(
    (input: { amounts: PromotionCheckoutAmounts; ready: boolean }) => {
      setPromotionAmounts(input.amounts);
      setCheckoutReady(input.ready);
    },
    [],
  );
  const handlePromotionSettled = useCallback(
    (input: {
      error: string | null;
      promotion?: PromotionCheckoutAmounts["promotion"];
      requestId: string;
    }) => {
      void input.requestId;
      setPromotionPending(false);
      setPromotionError(input.error);
      if (!input.error) setPromotionCode(input.promotion?.code ?? "");
    },
    [],
  );

  const goToStep = useCallback(
    (step: ReservationStep) => {
      if (step === "pagamento" && !canPay) {
        setJourneyError("Aceite os termos antes de seguir para o pagamento.");
        setCurrentStep("preparar");
        router.push(prepareStepHref);
        return;
      }

      setJourneyError(null);
      setCurrentStep(step);
      router.push(
        step === "momento"
          ? momentStepHref
          : step === "preparar"
            ? prepareStepHref
            : paymentStepHref,
      );
    },
    [canPay, momentStepHref, paymentStepHref, prepareStepHref, router],
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#FFFFFF_0%,#FBF8FF_48%,#FFFFFF_100%)] text-brand-deep">
      <ReservationTopbar />
      <div className="mx-auto w-full max-w-[1680px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <Link
          href={therapistProfileHref as Route<string>}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-tesText-muted transition hover:text-brand-primary"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Voltar para agenda e horários
        </Link>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_520px] xl:gap-12">
          <section>
            <ReservationStepper current={currentStep} onNavigate={goToStep} />
            {journeyError ? (
              <p
                role="alert"
                className="mb-6 rounded-2xl border border-status-danger/30 bg-status-dangerBg px-4 py-3 text-sm font-bold text-status-danger"
              >
                {journeyError}
              </p>
            ) : null}
            {currentStep === "momento" ? (
              <MomentStep
                context={context}
                loginHref={loginHref}
                schedule={schedule}
                signupHref={signupHref}
              />
            ) : null}
            {currentStep === "preparar" ? (
              <PrepareStep
                acceptedTerms={acceptedTerms}
                context={context}
                marketingConsent={marketingConsent}
                onSharedNoteChange={setSharedNote}
                onMarketingConsentChange={setMarketingConsent}
                onTermsChange={(accepted) => {
                  setAcceptedTerms(accepted);
                  if (accepted) setJourneyError(null);
                }}
                onAdvanceToPayment={() => goToStep("pagamento")}
                sharedNote={sharedNote}
              />
            ) : null}
            {currentStep === "pagamento" ? (
              <PaymentStep
                acceptedTerms={acceptedTerms}
                context={context}
                loginHref={loginHref}
                sharedNote={sharedNote}
                onCheckoutChange={handleCheckoutChange}
                onPromotionSettled={handlePromotionSettled}
                promotionRequest={promotionRequest}
              />
            ) : null}
          </section>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <ReservationSummary
              acceptedTerms={acceptedTerms}
              canPay={canPay}
              context={activeContext}
              checkoutReady={checkoutReady}
              promotionAmounts={promotionAmounts}
              promotionCode={promotionCode}
              promotionError={promotionError}
              promotionPending={promotionPending}
              onApplyPromotion={() => {
                setPromotionError(null);
                setPromotionPending(true);
                setPromotionRequest({
                  code: promotionCode.trim(),
                  requestId: crypto.randomUUID(),
                });
              }}
              onPromotionCodeChange={setPromotionCode}
              onRemovePromotion={() => {
                setPromotionError(null);
                setPromotionPending(true);
                setPromotionRequest({
                  code: null,
                  requestId: crypto.randomUUID(),
                });
              }}
              onAdvanceToPayment={() => goToStep("pagamento")}
            />
            <PolicyCard />
          </aside>
        </div>
      </div>
      <ReservationFooter />
    </main>
  );
}

function ReservationTopbar() {
  return (
    <header className="border-b border-border/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-[76px] w-full max-w-[1680px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <PublicLogo />
        <Link
          href={routes.public.home as Route}
          className="text-sm font-extrabold text-brand-deep transition hover:text-brand-primary"
        >
          Voltar à página inicial
        </Link>
      </div>
    </header>
  );
}

function ReservationStepper({
  current,
  onNavigate,
}: {
  current: ReservationContext["step"];
  onNavigate: (step: ReservationStep) => void;
}) {
  const steps = [
    ["momento", "Escolha seu momento"],
    ["preparar", "Prepare seu encontro"],
    ["pagamento", "Confirme sua reserva"],
  ] as const;

  return (
    <ol className="mb-8 grid gap-3 sm:grid-cols-3">
      {steps.map(([step, label], index) => {
        const active = current === step;
        const completed =
          (current === "preparar" && step === "momento") ||
          (current === "pagamento" && step !== "pagamento");
        const clickable = completed;
        const content = (
          <>
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full",
                active ? "bg-white/20" : "bg-white",
              )}
              aria-hidden="true"
            >
              {completed ? <Check className="size-4" /> : index + 1}
            </span>
            <span>
              {label}
              {completed ? (
                <span className="sr-only">, etapa concluída</span>
              ) : null}
            </span>
          </>
        );

        return (
          <li
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-sm font-extrabold",
              active
                ? "border-brand-primary bg-brand-primary text-white shadow-soft"
                : completed
                  ? "border-brand-lavender bg-brand-lavenderSoft text-brand-primary"
                  : "border-border bg-white text-tesText-muted",
            )}
            key={step}
            aria-current={active ? "step" : undefined}
          >
            {clickable ? (
              <button
                className="flex min-h-11 w-full items-center gap-3 text-left focus:outline-none focus:ring-4 focus:ring-ring/20"
                onClick={() => onNavigate(step)}
                type="button"
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}

function MomentStep({
  context,
  loginHref,
  schedule,
  signupHref,
}: {
  context: ReservationContext;
  loginHref: string;
  schedule: ReservationSchedule;
  signupHref: string;
}) {
  const canContinue =
    context.canPrepareEncounter && context.isPatientAuthenticated;
  const hasVisibleSlots = schedule.days.some((day) => day.slots.length > 0);

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Reserva online"
        title="Escolha o seu melhor momento"
        description="Selecione um horário e confirme seu acesso de cliente para seguir com segurança."
      />

      <TESCard as="section" className="rounded-[28px] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-brand-deep">
              Agenda disponível
            </h2>
            <p className="mt-2 text-sm font-bold text-tesText-muted">
              Os horários seguem o fuso de São Paulo (Brasília). Se você estiver
              em outro lugar, confira a diferença local antes de reservar.
            </p>
          </div>
          <span className="rounded-full bg-brand-lavenderSoft px-4 py-2 text-sm font-extrabold text-brand-primary">
            Reserva por <HoldCountdown />
          </span>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {schedule.previousHref ? (
            <Link
              href={schedule.previousHref as Route<string>}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-extrabold text-brand-primary shadow-card transition hover:border-brand-primary focus:outline-none focus:ring-4 focus:ring-ring/20"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />2 dias
              anteriores
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface-muted px-4 text-sm font-extrabold text-tesText-muted">
              <ChevronLeft className="size-4" aria-hidden="true" />2 dias
              anteriores
            </span>
          )}
          <Link
            href={schedule.nextHref as Route<string>}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-extrabold text-brand-primary shadow-card transition hover:border-brand-primary focus:outline-none focus:ring-4 focus:ring-ring/20"
          >
            2 dias seguintes
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {context.hiddenPatientConflictCount > 0 ? (
          <p className="mt-5 rounded-2xl bg-brand-lavenderSoft px-4 py-3 text-sm font-bold text-brand-deep">
            Horários que coincidem com seus encontros atuais não são exibidos.
          </p>
        ) : null}
        {context.patientScheduleCheckStatus === "unavailable" &&
        context.isPatientAuthenticated ? (
          <p className="mt-5 rounded-2xl border border-status-warning/30 bg-status-warningBg px-4 py-3 text-sm font-bold text-brand-deep">
            Não conseguimos comparar estes horários com seus outros encontros
            agora. A confirmação será feita antes do pagamento.
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {schedule.days.map((day) => (
            <div
              className="rounded-[18px] border border-border bg-white p-4 shadow-card"
              key={day.dateKey}
            >
              <p className="text-sm font-extrabold text-brand-deep">
                {day.dayLabel}
              </p>
              <p className="text-xs font-bold text-tesText-muted">
                {day.dateLabel}
              </p>
              <div
                aria-label={`Horários disponíveis em ${day.dayLabel}`}
                className="mt-4 grid max-h-[36rem] gap-2 overflow-y-auto overscroll-contain pr-2"
                style={{ scrollbarGutter: "stable" }}
              >
                {day.slots.length > 0 ? (
                  day.slots.map((slot) => (
                    <Link
                      className={cn(
                        "inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-extrabold transition focus:outline-none focus:ring-4 focus:ring-ring/20",
                        slot.isSelected
                          ? "border-brand-primary bg-brand-primary text-white"
                          : "border-border bg-brand-lavenderSoft text-brand-primary hover:border-brand-primary",
                      )}
                      href={slot.href as Route<string>}
                      key={slot.startsAt}
                    >
                      {slot.timeLabel}
                    </Link>
                  ))
                ) : (
                  <p className="rounded-xl bg-surface-muted px-3 py-4 text-center text-xs font-bold leading-5 text-tesText-muted">
                    Sem horários neste dia
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {!hasVisibleSlots ? (
          <div className="mt-5 rounded-2xl border border-brand-lavender bg-brand-lavenderSoft p-4 text-sm font-bold leading-6 text-tesText-secondary">
            Não encontramos horários neste intervalo. Use as setas para ver os
            próximos dias disponíveis.
          </div>
        ) : null}
      </TESCard>

      <TESCard as="section" className="rounded-[28px] p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
              Login ou cadastro
            </p>
            <h2 className="mt-3 text-2xl font-extrabold text-brand-deep">
              Acesse sua conta de cliente
            </h2>
            <p className="mt-3 text-base font-semibold leading-7 text-tesText-secondary">
              Usamos sua conta para proteger a reserva, enviar orientações e
              liberar o encontro online após o pagamento confirmado.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {context.isPatientAuthenticated ? (
              <PatientConnectedCard context={context} />
            ) : (
              <>
                <AuthChoice
                  href={loginHref}
                  icon={<LockKeyhole className="size-6" aria-hidden="true" />}
                  label="Entrar como cliente"
                />
                <AuthChoice
                  href={signupHref}
                  icon={<UserRound className="size-6" aria-hidden="true" />}
                  label="Criar conta de cliente"
                />
              </>
            )}
          </div>
        </div>
      </TESCard>

      <ReservationLinkButton
        href={context.prepareStepHref}
        disabled={!canContinue}
      >
        {context.isPatientAuthenticated
          ? "Preparar meu encontro"
          : "Entre para preparar o encontro"}
      </ReservationLinkButton>
    </div>
  );
}

function PrepareStep({
  acceptedTerms,
  context,
  marketingConsent,
  onAdvanceToPayment,
  onMarketingConsentChange,
  onSharedNoteChange,
  onTermsChange,
  sharedNote,
}: {
  acceptedTerms: boolean;
  context: ReservationContext;
  marketingConsent: boolean;
  onAdvanceToPayment: () => void;
  onMarketingConsentChange: (accepted: boolean) => void;
  onSharedNoteChange: (value: string) => void;
  onTermsChange: (accepted: boolean) => void;
  sharedNote: string;
}) {
  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Preparando seu encontro"
        title="Você não precisa chegar com tudo resolvido"
        description="Se desejar, use este espaço para compartilhar o que gostaria de trabalhar. Isso ajuda seu terapeuta a acolher melhor o início do encontro."
      />
      <PrepareForm
        acceptedTerms={acceptedTerms}
        canContinueToPayment={
          context.canPrepareEncounter && context.isPatientAuthenticated
        }
        marketingConsent={marketingConsent}
        onAdvanceToPayment={onAdvanceToPayment}
        onMarketingConsentChange={onMarketingConsentChange}
        onSharedNoteChange={onSharedNoteChange}
        onTermsChange={onTermsChange}
        sharedNote={sharedNote}
      />
    </div>
  );
}

function PaymentStep({
  acceptedTerms,
  context,
  loginHref,
  onCheckoutChange,
  onPromotionSettled,
  promotionRequest,
  sharedNote,
}: {
  acceptedTerms: boolean;
  context: ReservationContext;
  loginHref: string;
  onCheckoutChange: (input: {
    amounts: PromotionCheckoutAmounts;
    ready: boolean;
  }) => void;
  onPromotionSettled: (input: {
    error: string | null;
    promotion?: PromotionCheckoutAmounts["promotion"];
    requestId: string;
  }) => void;
  promotionRequest: { code: string | null; requestId: string } | null;
  sharedNote: string;
}) {
  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Finalizar reserva"
        title="Confirme seus dados e siga para o pagamento seguro"
        description="O pagamento é processado em ambiente seguro. O TES não armazena dados sensíveis do cartão."
      />

      <section className="space-y-6">
        <NumberedSection number={1} title="Informações pessoais">
          {context.isPatientAuthenticated ? (
            <PatientDetailsCard context={context} />
          ) : (
            <div className="rounded-[20px] border border-brand-lavender bg-white p-5">
              <p className="text-base font-extrabold text-brand-deep">
                Entre ou crie sua conta para confirmar.
              </p>
              <TESButton
                href={loginHref}
                variant="secondary"
                size="lg"
                className="mt-4 w-full"
              >
                Entrar como cliente
              </TESButton>
            </div>
          )}
        </NumberedSection>

        <NumberedSection number={2} title="Informações de pagamento">
          <TESCard as="div" className="rounded-[24px] p-6" id="stripe-checkout">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CreditCard className="size-6 text-brand-primary" />
                <h3 className="text-base font-extrabold uppercase tracking-[0.16em] text-brand-deep">
                  Cartão de crédito ou débito
                </h3>
              </div>
              <span className="rounded-full bg-brand-lavenderSoft px-4 py-2 text-xs font-extrabold text-brand-primary">
                Checkout Stripe
              </span>
            </div>
            <CheckoutButton
              acceptedTerms={acceptedTerms}
              disabled={!context.hasRequiredCheckoutData}
              isPatientAuthenticated={context.isPatientAuthenticated}
              loginHref={loginHref}
              onCheckoutChange={onCheckoutChange}
              onPromotionSettled={onPromotionSettled}
              promotionRequest={promotionRequest}
              serviceId={context.serviceId}
              sharedNote={sharedNote}
              startsAt={context.selectedSlot}
            />
          </TESCard>
        </NumberedSection>
      </section>
    </div>
  );
}

function NumberedSection({
  children,
  number,
  title,
}: {
  children: React.ReactNode;
  number: number;
  title: string;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-4">
        <span className="grid size-10 place-items-center rounded-full bg-brand-primary text-base font-extrabold text-white">
          {number}
        </span>
        <h2 className="text-2xl font-extrabold text-brand-deep">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function PageIntro({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-primary">
        {eyebrow}
      </p>
      <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight text-brand-deep sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-3xl text-base font-semibold leading-8 text-tesText-secondary sm:text-lg">
        {description}
      </p>
    </div>
  );
}

function AuthChoice({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href as Route<string>}
      className="flex min-h-[92px] items-center gap-4 rounded-[20px] border border-border bg-white p-4 text-brand-deep shadow-card transition hover:border-brand-primary focus:outline-none focus:ring-4 focus:ring-ring/20"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        {icon}
      </span>
      <span className="text-base font-extrabold">{label}</span>
    </Link>
  );
}

function PatientConnectedCard({ context }: { context: ReservationContext }) {
  const patient = context.patient;

  return (
    <div className="w-full rounded-[20px] border border-status-success bg-status-successBg p-5 text-status-success xl:col-span-2">
      <ShieldCheck className="size-8" aria-hidden="true" />
      <p className="mt-3 text-base font-extrabold">
        {patient
          ? `Olá, ${getFirstName(patient.displayName)}`
          : "Conta conectada"}
      </p>
      <p className="mt-1 max-w-2xl break-words text-sm font-bold leading-6">
        {patient?.email
          ? `Vamos usar ${patient.email} para enviar as orientações do encontro.`
          : "Você pode seguir para preparar o encontro."}
      </p>
    </div>
  );
}

function PatientDetailsCard({ context }: { context: ReservationContext }) {
  const patient = context.patient;

  if (!patient) {
    return (
      <div className="rounded-[20px] border border-status-success bg-status-successBg p-5 text-status-success">
        <p className="text-base font-extrabold">Cliente conectado</p>
        <p className="mt-1 text-sm font-bold">
          Sua sessão foi validada para continuar com a reserva.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-brand-lavender bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-brand-lavenderSoft">
          {patient.avatarUrl ? (
            <Image
              src={patient.avatarUrl}
              alt={patient.displayName}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <UserRound className="m-4 size-6 text-brand-primary" />
          )}
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
            Conta cliente
          </p>
          <p className="mt-1 text-xl font-extrabold text-brand-deep">
            {patient.displayName}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ReadonlyInfo
          icon={<Mail className="size-4" aria-hidden="true" />}
          label="E-mail"
          value={patient.email ?? "Não informado"}
        />
        <ReadonlyInfo
          icon={<Phone className="size-4" aria-hidden="true" />}
          label="Celular"
          value={patient.phone ?? "Não informado"}
        />
        <ReadonlyInfo
          icon={<Clock3 className="size-4" aria-hidden="true" />}
          label="Fuso"
          value={patient.timezone}
        />
      </div>
    </div>
  );
}

function ReadonlyInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-muted p-4">
      <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-tesText-muted">
        <span className="text-brand-primary">{icon}</span>
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-extrabold text-brand-deep">
        {value}
      </p>
    </div>
  );
}

function ReservationSummary({
  acceptedTerms,
  canPay,
  checkoutReady,
  context,
  onApplyPromotion,
  onAdvanceToPayment,
  onPromotionCodeChange,
  onRemovePromotion,
  promotionAmounts,
  promotionCode,
  promotionError,
  promotionPending,
}: {
  acceptedTerms: boolean;
  canPay: boolean;
  checkoutReady: boolean;
  context: ReservationContext;
  onApplyPromotion: () => void;
  onAdvanceToPayment: () => void;
  onPromotionCodeChange: (value: string) => void;
  onRemovePromotion: () => void;
  promotionAmounts: PromotionCheckoutAmounts | null;
  promotionCode: string;
  promotionError: string | null;
  promotionPending: boolean;
}) {
  const loginHref = buildClientAuthHref("login", context.currentPath);

  return (
    <TESCard
      as="section"
      className="overflow-hidden rounded-[28px] shadow-float"
    >
      <div className="border-b border-border/70 p-6 sm:p-7">
        <h2 className="text-2xl font-extrabold text-brand-deep">
          Resumo da reserva
        </h2>
        <p className="mt-2 text-base font-semibold text-tesText-muted">
          Confirme os detalhes do seu encontro
        </p>
      </div>
      <div className="space-y-6 p-6 sm:p-7">
        <div className="rounded-[20px] border border-border bg-white p-4 shadow-card">
          <div className="flex items-center gap-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-brand-lavenderSoft">
              {context.therapist.avatarUrl ? (
                <Image
                  src={context.therapist.avatarUrl}
                  alt={context.therapist.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <UserRound className="m-5 size-6 text-brand-primary" />
              )}
            </div>
            <div>
              <p className="text-lg font-extrabold text-brand-deep">
                {context.therapist.name}
              </p>
              <p className="text-sm font-semibold text-tesText-secondary">
                {context.therapist.headline}
              </p>
              {context.therapist.isVerified ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-extrabold uppercase text-brand-primary">
                  <ShieldCheck className="size-3" aria-hidden="true" />
                  Perfil verificado
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryPill
            icon={<CalendarDays className="size-5" aria-hidden="true" />}
            label="Data"
            value={context.time?.dateLabel ?? "Escolha um horário"}
          />
          <SummaryPill
            icon={<Clock3 className="size-5" aria-hidden="true" />}
            label="Hora"
            value={context.time?.timeRangeLabel ?? "A confirmar"}
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-6">
          <p className="text-base font-semibold text-tesText-secondary">
            {context.serviceSummary}
          </p>
          <p className="text-xl font-extrabold text-brand-deep">
            {context.priceLabel}
          </p>
        </div>

        {context.step === "pagamento" ? (
          <>
            <div className="space-y-3 border-t border-border/70 pt-6">
              <p className="block text-sm font-extrabold uppercase tracking-[0.16em] text-tesText-muted">
                Código promocional
              </p>
              <PromotionCodeField
                amounts={promotionAmounts}
                appliedPromotion={promotionAmounts?.promotion}
                disabled={!checkoutReady}
                error={promotionError}
                isLoading={promotionPending}
                onApply={onApplyPromotion}
                onChange={onPromotionCodeChange}
                onRemove={onRemovePromotion}
                value={promotionCode}
              />
            </div>
            <TESButton
              href="#stripe-checkout"
              variant="secondary"
              size="lg"
              className="w-full"
            >
              Ir para pagamento seguro
            </TESButton>
          </>
        ) : context.step === "preparar" ? (
          <button
            className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-brand-primary px-7 py-3 text-base font-extrabold text-white shadow-soft transition hover:bg-brand-primaryHover focus:outline-none focus:ring-4 focus:ring-ring/20 disabled:pointer-events-none disabled:opacity-50"
            disabled={!canPay}
            onClick={onAdvanceToPayment}
            type="button"
          >
            Avançar para pagamento
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <ReservationLinkButton
            href={context.nextStepHref}
            disabled={
              !context.canPrepareEncounter || !context.isPatientAuthenticated
            }
          >
            {context.step === "momento"
              ? "Preparar meu encontro"
              : "Avançar para pagamento"}
          </ReservationLinkButton>
        )}
        {context.step === "preparar" && !acceptedTerms ? (
          <p className="text-sm font-bold text-tesText-muted">
            Aceite os Termos de Uso e a Política de Privacidade para continuar.
          </p>
        ) : null}
      </div>
    </TESCard>
  );
}

function SummaryPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] bg-surface-muted p-4">
      <div className="flex items-center gap-3">
        <span className="text-brand-primary">{icon}</span>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-tesText-muted">
            {label}
          </p>
          <p className="text-base font-extrabold text-brand-deep">{value}</p>
        </div>
      </div>
    </div>
  );
}

function PolicyCard() {
  return (
    <TESCard as="section" className="rounded-[24px] p-5">
      <div className="flex gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-status-infoBg text-status-info">
          <Info className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-extrabold text-brand-deep">
            Política de cuidado
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Reagendamentos, cancelamentos e suporte seguem os Termos de Uso e a
            Política de Privacidade do TES. O encontro é online e não substitui
            atendimento médico, psicológico ou diagnóstico profissional.
          </p>
        </div>
      </div>
    </TESCard>
  );
}

function ReservationFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-5 py-7 text-sm font-bold text-tesText-muted sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
        <p>© 2026 Terapeuta Eu Sou. Todos os direitos reservados.</p>
        <div className="flex flex-wrap gap-5">
          <Link href={routes.public.privacy as Route}>
            Política de privacidade
          </Link>
          <Link href={routes.public.terms as Route}>Termos de uso</Link>
        </div>
      </div>
    </footer>
  );
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "cliente";
}

export function ReservationSuccessPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#F4ECFA_0%,#FFFFFF_52%,#F8F5FF_100%)] text-brand-deep">
      <ReservationTopbar />
      <section className="mx-auto flex min-h-[calc(100vh-160px)] max-w-4xl flex-col items-center justify-center px-5 py-16 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-status-successBg text-status-success">
          <Sparkles className="size-10" aria-hidden="true" />
        </div>
        <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.24em] text-brand-primary">
          Reserva em andamento
        </p>
        <h1 className="mt-4 font-display text-5xl font-light italic leading-tight text-brand-deep sm:text-6xl">
          Estamos preparando seu encontro
        </h1>
        <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-tesText-secondary">
          Assim que o pagamento for confirmado, o encontro aparecerá na sua área
          de cliente com as orientações de acesso online.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <TESButton href={routes.patient.home} variant="gradient" size="lg">
            Ir para minha área
          </TESButton>
        </div>
      </section>
      <ReservationFooter />
    </main>
  );
}
