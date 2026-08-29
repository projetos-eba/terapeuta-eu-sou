"use client";

import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { TESButton, TESDialog } from "@/components/tes";
import { TherapistPlan } from "@/domain/tes";
import { cn } from "@/lib/utils";

import {
  createStableRequestId,
  sendTherapistServicesCommand,
} from "../therapist-services.commands";
import {
  THERAPIST_SERVICE_DESCRIPTION_MAX_LENGTH,
  THERAPIST_SERVICE_DURATION_MAX_MINUTES,
  THERAPIST_SERVICE_DURATION_MIN_MINUTES,
} from "../therapist-services.constants";
import type {
  TherapistServiceDeliveryFormat,
  TherapistServiceSummary,
  TherapyCatalogOption,
} from "../therapist-services.types";
import { TherapyCatalogPicker } from "./therapy-catalog-picker";

type ServiceFormValues = {
  deliveryFormat: TherapistServiceDeliveryFormat;
  description: string;
  durationMinutes: number;
  interestIds: string[];
  price: string;
  themeIds: string[];
  therapy: TherapyCatalogOption | null;
  title: string;
};

const defaultValues: ServiceFormValues = {
  deliveryFormat: "online",
  description: "",
  durationMinutes: 60,
  interestIds: [],
  price: "",
  themeIds: [],
  therapy: null,
  title: "",
};

export function TherapistServiceForm({
  catalog,
  mode,
  onClose,
  onSaved,
  plan = TherapistPlan.Free,
  service,
}: {
  catalog: TherapyCatalogOption[];
  mode: "create" | "edit";
  onClose: () => void;
  onSaved: (service: TherapistServiceSummary, message: string) => void;
  plan?: TherapistPlan;
  service?: TherapistServiceSummary;
}) {
  const [step, setStep] = useState(mode === "edit" ? 2 : 1);
  const [values, setValues] = useState<ServiceFormValues>(() =>
    service
      ? {
          deliveryFormat: service.deliveryFormat,
          description: service.description ?? "",
          durationMinutes: service.durationMinutes,
          interestIds: service.matching.interestIds,
          price: formatPriceForInput(service.priceCents),
          themeIds: service.matching.themeIds,
          therapy:
            catalog.find(
              (therapy) => therapy.therapyId === service.therapyId,
            ) ?? null,
          title: service.title,
        }
      : defaultValues,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"activate" | "draft" | null>(
    null,
  );
  const [createdDraft, setCreatedDraft] =
    useState<TherapistServiceSummary | null>(null);
  const firstErrorRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  );

  const priceCents = useMemo(
    () => parsePriceToCents(values.price),
    [values.price],
  );
  const selectedTherapy = values.therapy;
  const firstStep = mode === "edit" ? 2 : 1;

  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0) {
      firstErrorRef.current?.focus();
    }
  }, [fieldErrors]);

  function handleContinue() {
    const errors = validateStep(values, priceCents, mode, step);
    setFieldErrors(errors);
    setSubmitError(
      Object.keys(errors).length > 0
        ? "Revise os campos destacados antes de continuar."
        : null,
    );

    if (Object.keys(errors).length > 0) return;
    setStep((current) => current + 1);
  }

  async function activateDraft(draft: TherapistServiceSummary) {
    setSubmitting("activate");
    const activateResult = await sendTherapistServicesCommand({
      action: "activate",
      expectedVersion: draft.version,
      requestId: createStableRequestId(),
      serviceId: draft.serviceId,
    });
    setSubmitting(null);

    if (activateResult.status === "error") {
      setSubmitError(
        `A terapia foi salva como rascunho, mas não foi possível ativá-la. ${activateResult.error.message}`,
      );
      return;
    }

    if ("service" in activateResult.data) {
      onSaved(activateResult.data.service, "Terapia criada e ativada.");
      onClose();
      return;
    }

    setSubmitError(
      "A terapia foi salva como rascunho, mas não foi possível ativá-la agora.",
    );
  }

  async function handleSubmit(nextStatus: "active" | "draft") {
    const errors = validate(values, priceCents, mode);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0 || priceCents === null) {
      setSubmitError(buildValidationError(errors));
      setStep(firstInvalidStep(errors, mode));
      return;
    }
    setSubmitError(null);

    if (mode === "create" && createdDraft) {
      if (nextStatus === "draft") {
        onSaved(createdDraft, "Terapia salva como rascunho.");
        onClose();
        return;
      }

      await activateDraft(createdDraft);
      return;
    }

    setSubmitting(nextStatus === "active" ? "activate" : "draft");

    if (mode === "edit" && service) {
      const result = await sendTherapistServicesCommand({
        action: "update",
        currency: "BRL",
        deliveryFormat: values.deliveryFormat,
        description: values.description,
        durationMinutes: values.durationMinutes,
        expectedVersion: service.version,
        interestIds: values.interestIds,
        priceCents,
        requestId: createStableRequestId(),
        serviceId: service.serviceId,
        themeIds: values.themeIds,
        title: values.title,
      });

      setSubmitting(null);

      if (result.status === "error") {
        setSubmitError(result.error.message);
        return;
      }

      if ("service" in result.data) {
        onSaved(result.data.service, "Terapia atualizada.");
        onClose();
        return;
      }

      setSubmitError("Não foi possível atualizar esta terapia agora.");
      return;
    }

    if (!selectedTherapy) {
      setSubmitting(null);
      setFieldErrors({ therapy: "Escolha uma terapia da plataforma." });
      return;
    }

    const createResult = await sendTherapistServicesCommand({
      action: "create",
      currency: "BRL",
      deliveryFormat: values.deliveryFormat,
      description: values.description,
      durationMinutes: values.durationMinutes,
      interestIds: values.interestIds,
      priceCents,
      requestId: createStableRequestId(),
      themeIds: values.themeIds,
      therapyId: selectedTherapy.therapyId,
      title: values.title,
    });

    if (createResult.status === "error") {
      setSubmitting(null);
      setSubmitError(createResult.error.message);
      return;
    }

    if (!("service" in createResult.data)) {
      setSubmitting(null);
      setSubmitError("Não foi possível criar esta terapia agora.");
      return;
    }

    if (nextStatus === "draft") {
      setSubmitting(null);
      onSaved(createResult.data.service, "Terapia salva como rascunho.");
      onClose();
      return;
    }

    const created = createResult.data.service;
    setCreatedDraft(created);
    await activateDraft(created);
  }

  const title = mode === "edit" ? "Editar serviço" : "Novo serviço";
  const description =
    mode === "edit"
      ? "Atualize os detalhes do atendimento sem perder o histórico desta terapia."
      : "Crie um atendimento para uma terapia já aprovada no TES.";

  return (
    <TESDialog
      className="max-w-[860px]"
      description={description}
      onClose={onClose}
      title={title}
    >
      <div aria-live="polite" className="sr-only">
        {submitting ? "Salvando terapia." : (submitError ?? "")}
      </div>
      <StepIndicator mode={mode} step={step} />

      {submitError ? (
        <div
          aria-live="assertive"
          className="mt-4 rounded-lg border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-bold text-status-danger"
          role="alert"
        >
          {submitError}
        </div>
      ) : null}

      <div className="mt-5">
        {step === 1 ? (
          <>
            <TherapyCatalogPicker
              catalog={catalog}
              onSelect={(therapy) =>
                setValues((current) => ({
                  ...current,
                  interestIds: [],
                  themeIds: [],
                  therapy,
                }))
              }
              selectedTherapyId={values.therapy?.therapyId ?? null}
            />
            {fieldErrors.therapy ? (
              <p className="mt-2 text-sm font-bold text-status-danger">
                {fieldErrors.therapy}
              </p>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <MatchingFields
            errors={fieldErrors}
            onChange={setValues}
            values={values}
          />
        ) : null}

        {step === 3 ? (
          <OfferFields
            errors={fieldErrors}
            firstErrorRef={firstErrorRef}
            onChange={setValues}
            values={values}
          />
        ) : null}

        {step === 4 ? (
          <ReviewStep priceCents={priceCents} values={values} />
        ) : null}
      </div>

      <div className="mt-7 flex flex-col gap-3 border-t border-brand-lavender pt-5 sm:flex-row sm:items-center sm:justify-between">
        <TESButton
          disabled={step === firstStep || submitting !== null}
          onClick={() => setStep((current) => Math.max(firstStep, current - 1))}
          type="button"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Voltar
        </TESButton>
        <div className="flex flex-col gap-3 sm:flex-row">
          {step < 4 ? (
            <TESButton
              disabled={submitting !== null}
              onClick={handleContinue}
              type="button"
            >
              Continuar
              <ArrowRight aria-hidden="true" size={16} />
            </TESButton>
          ) : (
            <>
              <TESButton
                disabled={submitting !== null}
                onClick={() => handleSubmit("draft")}
                type="button"
                variant="secondary"
              >
                <Save aria-hidden="true" size={16} />
                {submitting === "draft" ? "Salvando..." : "Salvar rascunho"}
              </TESButton>
              {mode === "create" ? (
                <TESButton
                  disabled={submitting !== null}
                  onClick={() => handleSubmit("active")}
                  type="button"
                >
                  <Check aria-hidden="true" size={16} />
                  {submitting === "activate"
                    ? "Ativando..."
                    : "Salvar e ativar"}
                </TESButton>
              ) : (
                <TESButton
                  disabled={submitting !== null}
                  onClick={() => handleSubmit("draft")}
                  type="button"
                >
                  {submitting ? "Salvando..." : "Salvar alterações"}
                </TESButton>
              )}
            </>
          )}
        </div>
      </div>
    </TESDialog>
  );
}

function OfferFields({
  errors,
  firstErrorRef,
  onChange,
  values,
}: {
  errors: Record<string, string>;
  firstErrorRef: React.MutableRefObject<
    HTMLInputElement | HTMLTextAreaElement | null
  >;
  onChange: React.Dispatch<React.SetStateAction<ServiceFormValues>>;
  values: ServiceFormValues;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-extrabold text-brand-deep">
          Como esse atendimento vai aparecer?
        </h2>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          Escolha um nome simples, que ajude a pessoa a entender o atendimento.
        </p>
      </div>
      <Field
        error={errors.title}
        id="service-title"
        label="Nome do atendimento"
      >
        <input
          aria-describedby={errors.title ? "service-title-error" : undefined}
          className="h-12 w-full rounded-lg border border-brand-lavender px-4 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary"
          id="service-title"
          onChange={(event) =>
            onChange((current) => ({ ...current, title: event.target.value }))
          }
          ref={
            errors.title
              ? (node) => {
                  firstErrorRef.current = node;
                }
              : undefined
          }
          placeholder="Exemplo: Sessão individual de Reiki — 45 min"
          value={values.title}
        />
      </Field>
      <Field
        error={errors.description}
        id="service-description"
        label="Descrição"
      >
        <p className="mb-2 text-sm font-semibold leading-6 text-tesText-secondary">
          Conte como funciona o atendimento e o que a pessoa pode esperar da
          experiência. Use uma linguagem simples, acolhedora e sem prometer
          resultados.
        </p>
        <textarea
          aria-describedby={
            errors.description ? "service-description-error" : undefined
          }
          className="min-h-[118px] w-full rounded-lg border border-brand-lavender px-4 py-3 text-sm font-semibold leading-6 text-brand-deep outline-none focus:border-brand-primary"
          id="service-description"
          maxLength={THERAPIST_SERVICE_DESCRIPTION_MAX_LENGTH}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              description: event.target.value.slice(
                0,
                THERAPIST_SERVICE_DESCRIPTION_MAX_LENGTH,
              ),
            }))
          }
          placeholder={`Exemplo de descrição:

Sessão individual de Reiki, realizada online, com duração de 45 minutos.

Começamos com uma breve conversa para entender como você está chegando e alinhar o foco do encontro.
Depois, conduzo a prática de Reiki em um ambiente tranquilo, respeitando seu momento e seus limites.
Ao final, teremos alguns minutos para conversar sobre a experiência e encerrar o atendimento com calma.
Se esta for sua primeira sessão, explicarei como o encontro funciona antes de começarmos.`}
          ref={
            errors.description
              ? (node) => {
                  firstErrorRef.current = node;
                }
              : undefined
          }
          value={values.description}
        />
        <p className="mt-1 text-xs font-semibold text-tesText-secondary">
          {values.description.length}/{THERAPIST_SERVICE_DESCRIPTION_MAX_LENGTH}{" "}
          caracteres
        </p>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          error={errors.durationMinutes}
          id="service-duration"
          label="Duração"
        >
          <input
            aria-describedby={
              errors.durationMinutes ? "service-duration-error" : undefined
            }
            className="h-12 w-full rounded-lg border border-brand-lavender px-4 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary"
            id="service-duration"
            inputMode="numeric"
            max={THERAPIST_SERVICE_DURATION_MAX_MINUTES}
            min={THERAPIST_SERVICE_DURATION_MIN_MINUTES}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                durationMinutes:
                  event.target.value === "" ? 0 : Number(event.target.value),
              }))
            }
            placeholder="Exemplo: 45 min"
            step={1}
            value={values.durationMinutes}
            type="number"
          />
          <p className="mt-1 text-sm font-semibold text-tesText-secondary">
            Digite um valor inteiro entre{" "}
            {THERAPIST_SERVICE_DURATION_MIN_MINUTES} e{" "}
            {THERAPIST_SERVICE_DURATION_MAX_MINUTES} minutos.
          </p>
        </Field>
        <Field error={errors.price} id="service-price" label="Preço">
          <input
            aria-describedby={errors.price ? "service-price-error" : undefined}
            className="h-12 w-full rounded-lg border border-brand-lavender px-4 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary"
            id="service-price"
            inputMode="decimal"
            onChange={(event) =>
              onChange((current) => ({ ...current, price: event.target.value }))
            }
            placeholder="Exemplo: R$ 185"
            ref={
              errors.price
                ? (node) => {
                    firstErrorRef.current = node;
                  }
                : undefined
            }
            value={values.price}
          />
        </Field>
        <div className="rounded-lg border border-brand-lavender bg-brand-lavenderSoft/60 p-4">
          <span className="text-sm font-extrabold text-brand-deep">
            Atendimento online
          </span>
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            Este atendimento acontece online, pelo fluxo seguro do TES.
          </p>
        </div>
      </div>
      <div className="rounded-lg bg-brand-lavenderSoft/70 p-4 text-xs font-semibold leading-5 text-tesText-secondary">
        As regras detalhadas de reserva continuam centralizadas em Agenda /
        Horários. Esta terapia só fica disponível para agendamento depois de ser
        ativada e de você informar quando pode atender.
      </div>
    </div>
  );
}

function MatchingFields({
  errors,
  onChange,
  values,
}: {
  errors: Record<string, string>;
  onChange: React.Dispatch<React.SetStateAction<ServiceFormValues>>;
  values: ServiceFormValues;
}) {
  const themes = values.therapy?.matchingThemes ?? [];

  function toggleTheme(themeId: string) {
    onChange((current) => {
      const selected = current.themeIds.includes(themeId);
      const nextThemeIds = selected
        ? current.themeIds.filter((id) => id !== themeId)
        : [...current.themeIds, themeId].slice(0, 3);
      const allowedInterestIds = new Set(
        themes
          .filter((theme) => nextThemeIds.includes(theme.id))
          .flatMap((theme) => theme.interests.map((interest) => interest.id)),
      );

      return {
        ...current,
        interestIds: current.interestIds.filter((id) =>
          allowedInterestIds.has(id),
        ),
        themeIds: nextThemeIds,
      };
    });
  }

  function toggleInterest(themeId: string, interestId: string) {
    onChange((current) => {
      const selected = current.interestIds.includes(interestId);
      const theme = themes.find((item) => item.id === themeId);
      const currentThemeInterestIds =
        theme?.interests
          .map((interest) => interest.id)
          .filter((id) => current.interestIds.includes(id)) ?? [];

      if (!selected && currentThemeInterestIds.length >= 3) return current;

      return {
        ...current,
        interestIds: selected
          ? current.interestIds.filter((id) => id !== interestId)
          : [...current.interestIds, interestId],
      };
    });
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-extrabold text-brand-deep">
        Temas e detalhes desta terapia
      </legend>
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        Escolha os temas desta terapia que você trabalha e até três refinamentos
        em cada tema selecionado.
      </p>
      {errors.matching ? (
        <p
          className="text-sm font-bold text-status-danger"
          id="service-matching-error"
        >
          {errors.matching}
        </p>
      ) : null}
      <div className="space-y-3">
        {themes.map((theme) => {
          const selected = values.themeIds.includes(theme.id);
          const selectedCount = theme.interests.filter((interest) =>
            values.interestIds.includes(interest.id),
          ).length;

          return (
            <div
              className="rounded-lg border border-brand-lavender bg-white p-4"
              key={theme.id}
            >
              <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-extrabold text-brand-deep">
                <span className="flex items-center gap-3">
                  <input
                    checked={selected}
                    disabled={!selected && values.themeIds.length >= 3}
                    onChange={() => toggleTheme(theme.id)}
                    type="checkbox"
                  />
                  {theme.name}
                </span>
                <span className="text-xs font-bold text-tesText-secondary">
                  {selectedCount} de 3
                </span>
              </label>
              {selected ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {theme.interests.map((interest) => {
                    const interestSelected = values.interestIds.includes(
                      interest.id,
                    );

                    return (
                      <label
                        className="flex min-h-10 items-center gap-2 rounded-md bg-brand-lavenderSoft/60 px-3 text-sm font-bold text-tesText-secondary"
                        key={interest.id}
                      >
                        <input
                          checked={interestSelected}
                          disabled={!interestSelected && selectedCount >= 3}
                          onChange={() => toggleInterest(theme.id, interest.id)}
                          type="checkbox"
                        />
                        {interest.name}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {themes.length === 0 ? (
        <p className="rounded-lg bg-brand-lavenderSoft/70 p-4 text-sm font-semibold text-tesText-secondary">
          Esta terapia ainda não possui temas publicados para configuração de
          terapia.
        </p>
      ) : null}
    </fieldset>
  );
}

function Field({
  children,
  error,
  id,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  id: string;
  label: string;
}) {
  return (
    <div>
      <label className="text-sm font-extrabold text-brand-deep" htmlFor={id}>
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p
          className="mt-2 text-sm font-bold text-status-danger"
          id={`${id}-error`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ReviewStep({
  priceCents,
  values,
}: {
  priceCents: number | null;
  values: ServiceFormValues;
}) {
  return (
    <div className="grid min-w-0 gap-3 rounded-lg bg-brand-lavenderSoft/50 p-4">
      {[
        ["Terapia", values.therapy?.name ?? "Não selecionada"],
        ["Prática", values.title || "Sem título"],
        [
          "Preço",
          priceCents === null ? "Revise o preço" : formatCurrency(priceCents),
        ],
        ["Duração", `${values.durationMinutes} min`],
        ["Formato", "Online"],
        ["Temas", `${values.themeIds.length} selecionado(s)`],
        ["Refinamentos", `${values.interestIds.length} selecionado(s)`],
      ].map(([label, value]) => (
        <div
          className="flex min-w-0 flex-col gap-1 border-b border-white/80 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5"
          key={label}
        >
          <span className="shrink-0 text-xs font-extrabold uppercase tracking-[0.08em] text-tesText-muted">
            {label}
          </span>
          <strong className="min-w-0 max-w-full break-words text-sm text-brand-deep sm:text-right [overflow-wrap:anywhere]">
            {value}
          </strong>
        </div>
      ))}
      <div className="min-w-0 border-t border-white/80 pt-3">
        <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-tesText-muted">
          Descrição
        </span>
        <p className="mt-1 max-h-24 max-w-full overflow-y-auto break-words text-sm font-semibold leading-6 text-tesText-secondary [overflow-wrap:anywhere]">
          {values.description || "Sem descrição."}
        </p>
      </div>
    </div>
  );
}

function StepIndicator({
  mode,
  step,
}: {
  mode: "create" | "edit";
  step: number;
}) {
  const labels =
    mode === "edit"
      ? ["Temas", "Atendimento", "Revisão"]
      : ["Escolha da terapia", "Temas", "Atendimento", "Revisão"];
  const effectiveStep = mode === "edit" ? step - 1 : step;

  return (
    <ol className="grid gap-2 sm:grid-cols-4">
      {labels.map((label, index) => {
        const active = effectiveStep === index + 1;

        return (
          <li
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-extrabold",
              active
                ? "border-brand-primary bg-brand-lavenderSoft text-brand-primary"
                : "border-brand-lavender text-tesText-muted",
            )}
            key={label}
          >
            {index + 1}. {label}
          </li>
        );
      })}
    </ol>
  );
}

function validate(
  values: ServiceFormValues,
  priceCents: number | null,
  mode: "create" | "edit",
) {
  const errors: Record<string, string> = {};
  if (mode === "create" && !values.therapy) {
    errors.therapy = "Escolha uma terapia da plataforma.";
  }
  if (values.themeIds.length < 1 || values.themeIds.length > 3) {
    errors.matching = "Escolha de 1 a 3 temas desta terapia.";
  }
  const interestsByTheme = new Map<string, number>();
  for (const theme of values.therapy?.matchingThemes ?? []) {
    const count = theme.interests.filter((interest) =>
      values.interestIds.includes(interest.id),
    ).length;
    if (count > 0) interestsByTheme.set(theme.id, count);
  }
  if (Array.from(interestsByTheme.values()).some((count) => count > 3)) {
    errors.matching = "Escolha no máximo 3 refinamentos por tema.";
  }
  if (values.title.trim().length < 3) {
    errors.title = "Informe um título com pelo menos 3 caracteres.";
  }
  if (values.description.trim().length < 20) {
    errors.description = "A descrição precisa ter pelo menos 20 caracteres.";
  }
  if (
    values.description.trim().length > THERAPIST_SERVICE_DESCRIPTION_MAX_LENGTH
  ) {
    errors.description = `Use no máximo ${THERAPIST_SERVICE_DESCRIPTION_MAX_LENGTH} caracteres.`;
  }
  if (
    !Number.isInteger(values.durationMinutes) ||
    values.durationMinutes < THERAPIST_SERVICE_DURATION_MIN_MINUTES ||
    values.durationMinutes > THERAPIST_SERVICE_DURATION_MAX_MINUTES
  ) {
    errors.durationMinutes = `A duração deve ser um número inteiro entre ${THERAPIST_SERVICE_DURATION_MIN_MINUTES} e ${THERAPIST_SERVICE_DURATION_MAX_MINUTES} minutos.`;
  }
  if (priceCents === null || priceCents < 1000) {
    errors.price = "Informe um preço válido a partir de R$ 10,00.";
  }
  return errors;
}

function validateStep(
  values: ServiceFormValues,
  priceCents: number | null,
  mode: "create" | "edit",
  step: number,
) {
  const errors = validate(values, priceCents, mode);

  if (step === 1) {
    return pickErrors(errors, ["therapy"]);
  }

  if (step === 2) {
    return pickErrors(errors, ["matching"]);
  }

  if (step === 3) {
    return pickErrors(errors, [
      "title",
      "description",
      "durationMinutes",
      "price",
    ]);
  }

  return {};
}

function pickErrors(errors: Record<string, string>, keys: string[]) {
  return Object.fromEntries(
    keys.filter((key) => errors[key]).map((key) => [key, errors[key]]),
  );
}

function buildValidationError(errors: Record<string, string>) {
  const messages = Object.values(errors);
  if (messages.length === 0) {
    return "Não foi possível salvar. Revise os campos destacados.";
  }

  return `Não foi possível salvar. Revise os campos destacados: ${messages.join(" ")}`;
}

function firstInvalidStep(
  errors: Record<string, string>,
  mode: "create" | "edit",
) {
  if (mode === "create" && errors.therapy) return 1;
  if (errors.matching) return 2;
  return 3;
}

export function parsePriceToCents(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

export function formatCurrency(priceCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(priceCents / 100);
}

function formatPriceForInput(priceCents: number) {
  return (priceCents / 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}
