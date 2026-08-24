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

  async function handleSubmit(nextStatus: "active" | "draft") {
    const errors = validate(values, priceCents, mode);
    setFieldErrors(errors);
    setSubmitError(null);

    if (Object.keys(errors).length > 0 || priceCents === null) return;
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
    const activateResult = await sendTherapistServicesCommand({
      action: "activate",
      expectedVersion: created.version,
      requestId: createStableRequestId(),
      serviceId: created.serviceId,
    });
    setSubmitting(null);

    if (activateResult.status === "error") {
      onSaved(
        created,
        `Rascunho salvo. Não foi possível ativar a terapia: ${activateResult.error.message}`,
      );
      return;
    }

    if ("service" in activateResult.data) {
      onSaved(activateResult.data.service, "Terapia criada e ativada.");
      onClose();
      return;
    }

    setSubmitError("Não foi possível ativar esta terapia agora.");
  }

  const title = mode === "edit" ? "Editar terapia" : "Nova terapia";
  const description =
    mode === "edit"
      ? "Atualize preço, duração e descrição sem perder o histórico desta terapia."
      : "Escolha uma terapia disponível e informe como você trabalha.";

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
        <div className="mt-4 rounded-lg border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-bold text-status-danger">
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
                  title: current.title || therapy.name,
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
              onClick={() => {
                if (step === 1 && !values.therapy) {
                  setFieldErrors({
                    therapy: "Escolha uma terapia da plataforma.",
                  });
                  return;
                }
                setFieldErrors({});
                setStep((current) => current + 1);
              }}
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
      <Field error={errors.title} id="service-title" label="Título da oferta">
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
          value={values.title}
        />
      </Field>
      <Field
        error={errors.description}
        id="service-description"
        label="Descrição"
      >
        <textarea
          aria-describedby={
            errors.description ? "service-description-error" : undefined
          }
          className="min-h-[118px] w-full rounded-lg border border-brand-lavender px-4 py-3 text-sm font-semibold leading-6 text-brand-deep outline-none focus:border-brand-primary"
          id="service-description"
          maxLength={200}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
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
          {values.description.length}/200 caracteres
        </p>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          error={errors.durationMinutes}
          id="service-duration"
          label="Duração"
        >
          <select
            aria-describedby={
              errors.durationMinutes ? "service-duration-error" : undefined
            }
            className="h-12 w-full rounded-lg border border-brand-lavender px-4 text-sm font-bold text-brand-deep outline-none focus:border-brand-primary"
            id="service-duration"
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                durationMinutes: Number(event.target.value),
              }))
            }
            value={values.durationMinutes}
          >
            {[30, 45, 60, 75, 90, 120].map((duration) => (
              <option key={duration} value={duration}>
                {duration} min
              </option>
            ))}
          </select>
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
            placeholder="120,00"
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
            Todas as ofertas do TES acontecem online pelo fluxo seguro da
            plataforma.
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
        ["Oferta", values.title || "Sem título"],
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
      ? ["Temas", "Oferta", "Revisão"]
      : ["Escolha da terapia", "Temas", "Oferta", "Revisão"];
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
    errors.description = "Explique a proposta em pelo menos 20 caracteres.";
  }
  if (values.description.trim().length > 200) {
    errors.description = "Use no máximo 200 caracteres.";
  }
  if (values.durationMinutes < 15 || values.durationMinutes > 240) {
    errors.durationMinutes = "A duração deve ficar entre 15 e 240 minutos.";
  }
  if (priceCents === null || priceCents < 1000) {
    errors.price = "Informe um preço válido a partir de R$ 10,00.";
  }
  return errors;
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
