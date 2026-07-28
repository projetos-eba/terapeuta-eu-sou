"use client";

import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { TESButton, TESDialog } from "@/components/tes";
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
  price: string;
  therapy: TherapyCatalogOption | null;
  title: string;
};

const defaultValues: ServiceFormValues = {
  deliveryFormat: "online",
  description: "",
  durationMinutes: 60,
  price: "",
  therapy: null,
  title: "",
};

export function TherapistServiceForm({
  catalog,
  mode,
  onClose,
  onSaved,
  service,
}: {
  catalog: TherapyCatalogOption[];
  mode: "create" | "edit";
  onClose: () => void;
  onSaved: (service: TherapistServiceSummary, message: string) => void;
  service?: TherapistServiceSummary;
}) {
  const [step, setStep] = useState(mode === "edit" ? 2 : 1);
  const [values, setValues] = useState<ServiceFormValues>(() =>
    service
      ? {
          deliveryFormat: service.deliveryFormat,
          description: service.description ?? "",
          durationMinutes: service.durationMinutes,
          price: formatPriceForInput(service.priceCents),
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
        priceCents,
        requestId: createStableRequestId(),
        serviceId: service.serviceId,
        title: values.title,
      });

      setSubmitting(null);

      if (result.status === "error") {
        setSubmitError(result.error.message);
        return;
      }

      if ("service" in result.data) {
        onSaved(result.data.service, "Serviço atualizado.");
      }
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
      priceCents,
      requestId: createStableRequestId(),
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
      setSubmitError("Resposta inesperada ao criar serviço.");
      return;
    }

    if (nextStatus === "draft") {
      setSubmitting(null);
      onSaved(createResult.data.service, "Serviço salvo como rascunho.");
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
        `Rascunho salvo. Não foi possível ativar: ${activateResult.error.message}`,
      );
      return;
    }

    if ("service" in activateResult.data) {
      onSaved(activateResult.data.service, "Serviço criado e ativado.");
    }
  }

  const title = mode === "edit" ? "Editar serviço" : "Novo serviço";
  const description =
    mode === "edit"
      ? "Atualize a oferta sem trocar a terapia canônica quando há histórico."
      : "Crie uma oferta vinculada a uma terapia aprovada pela plataforma.";

  return (
    <TESDialog
      className="max-w-[860px]"
      description={description}
      onClose={onClose}
      title={title}
    >
      <div aria-live="polite" className="sr-only">
        {submitting ? "Salvando serviço." : (submitError ?? "")}
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
          <OfferFields
            errors={fieldErrors}
            firstErrorRef={firstErrorRef}
            onChange={setValues}
            values={values}
          />
        ) : null}

        {step === 3 ? (
          <ReviewStep priceCents={priceCents} values={values} />
        ) : null}
      </div>

      <div className="mt-7 flex flex-col gap-3 border-t border-brand-lavender pt-5 sm:flex-row sm:items-center sm:justify-between">
        <TESButton
          disabled={step === 1 || submitting !== null}
          onClick={() => setStep((current) => Math.max(1, current - 1))}
          type="button"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Voltar
        </TESButton>
        <div className="flex flex-col gap-3 sm:flex-row">
          {step < 3 ? (
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
        Horários. Esta oferta só fica reservável após ativação válida pelo
        backend.
      </div>
    </div>
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
    <div className="grid gap-3 rounded-lg bg-brand-lavenderSoft/50 p-4">
      {[
        ["Terapia", values.therapy?.name ?? "Não selecionada"],
        ["Oferta", values.title || "Sem título"],
        [
          "Preço",
          priceCents === null ? "Revise o preço" : formatCurrency(priceCents),
        ],
        ["Duração", `${values.durationMinutes} min`],
        ["Formato", "Online"],
      ].map(([label, value]) => (
        <div
          className="flex flex-col gap-1 border-b border-white/80 pb-3 last:border-0 last:pb-0 sm:flex-row sm:justify-between"
          key={label}
        >
          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-tesText-muted">
            {label}
          </span>
          <strong className="text-sm text-brand-deep sm:text-right">
            {value}
          </strong>
        </div>
      ))}
      <p className="text-sm font-semibold leading-6 text-tesText-secondary">
        {values.description || "Sem descrição."}
      </p>
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
      ? ["Oferta", "Revisão"]
      : ["Escolha da terapia", "Oferta", "Revisão"];
  const effectiveStep = mode === "edit" ? step - 1 : step;

  return (
    <ol className="grid gap-2 sm:grid-cols-3">
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
  if (values.title.trim().length < 3) {
    errors.title = "Informe um título com pelo menos 3 caracteres.";
  }
  if (values.description.trim().length < 20) {
    errors.description = "Explique a proposta em pelo menos 20 caracteres.";
  }
  if (values.description.trim().length > 800) {
    errors.description = "Use no máximo 800 caracteres.";
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
