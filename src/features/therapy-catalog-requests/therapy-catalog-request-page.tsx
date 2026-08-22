"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  Heart,
  Info,
  Leaf,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { routes } from "@/lib/routes";

export type TherapyRequestTheme = {
  description: string;
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type TherapyRequestSummary = {
  createdAt: string;
  decision: string | null;
  id: string;
  informedName: string;
  materials: Array<{
    createdAt: string;
    fileName: string;
    fileSizeBytes: number;
    id: string;
    mimeType: string;
  }>;
  status: string;
  submission: Record<string, unknown>;
  suggestedCategoryId: string | null;
  updatedAt: string;
};

type FormValues = {
  additionalInformation: string;
  aliases: string;
  description: string;
  experienceLevel:
    | "less_than_one"
    | "one_to_three"
    | "three_to_five"
    | "more_than_five"
    | "";
  guaranteesResults: "no" | "yes" | "";
  hasTraining: "no" | "yes" | "";
  informedName: string;
  invasiveProcedure: "no" | "yes" | "";
  objective: string;
  practiceDuration: string;
  practicesProfessionally: "no" | "yes" | "";
  referenceUrl: string;
  requiresInPerson: "no" | "yes" | "";
  safetyNotes: string;
  sessionProcess: string;
  themeIds: string[];
  trainingDescription: string;
  useCases: string;
};

const defaultValues: FormValues = {
  additionalInformation: "",
  aliases: "",
  description: "",
  experienceLevel: "",
  guaranteesResults: "",
  hasTraining: "",
  informedName: "",
  invasiveProcedure: "",
  objective: "",
  practiceDuration: "",
  practicesProfessionally: "",
  referenceUrl: "",
  requiresInPerson: "",
  safetyNotes: "",
  sessionProcess: "",
  themeIds: [],
  trainingDescription: "",
  useCases: "",
};

const steps = [
  "Sobre a prática",
  "Entendendo a prática",
  "Sobre você",
  "Compatibilidade com o TES",
  "Materiais",
];

const acceptedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const controlClassName =
  "min-h-11 w-full rounded-control border border-brand-lavender bg-white px-3 py-2 text-sm text-brand-deep outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-lavenderSoft";

export function TherapyCatalogRequestPage({
  themes,
  initialRequestId,
  requests,
}: {
  themes: TherapyRequestTheme[];
  initialRequestId: string | null;
  requests: TherapyRequestSummary[];
}) {
  const existingRequest = useMemo(
    () => requests.find((item) => item.id === initialRequestId) ?? null,
    [initialRequestId, requests],
  );
  const canResubmit = existingRequest?.status === "needs_information";
  const [screen, setScreen] = useState<"form" | "intro" | "success">(
    existingRequest ? "form" : "intro",
  );
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FormValues>(() =>
    existingRequest ? toFormValues(existingRequest) : defaultValues,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(
    null,
  );

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const { [key]: _, ...rest } = current;
      return rest;
    });
  }

  function next() {
    const nextErrors = validateStep(step, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0)
      setStep((current) => Math.min(5, current + 1));
  }

  async function submit() {
    const nextErrors = validateStep(5, values);
    setErrors(nextErrors);
    setSubmissionError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const payload = toPayload(values);
    let requestId = submittedRequestId;
    if (!requestId) {
      const result = await sendCommand(
        canResubmit && existingRequest
          ? {
              action: "resubmit",
              catalogRequestId: existingRequest.id,
              payload,
              requestId: crypto.randomUUID(),
            }
          : { action: "submit", payload, requestId: crypto.randomUUID() },
      );

      if (!result.ok || !result.data?.requestId) {
        setIsSubmitting(false);
        setSubmissionError(result.message);
        return;
      }
      requestId = result.data.requestId;
      setSubmittedRequestId(requestId);
    }

    for (const file of files) {
      const upload = await sendCommand({
        action: "upload",
        catalogRequestId: requestId,
        file: {
          base64: await fileToDataUrl(file),
          mimeType: file.type,
          name: file.name,
          size: file.size,
        },
      });
      if (!upload.ok) {
        setIsSubmitting(false);
        setSubmissionError(
          "A solicitação foi recebida, mas um material não pôde ser enviado. Tente anexá-lo novamente pela solicitação.",
        );
        return;
      }
    }

    setIsSubmitting(false);
    setSubmittedRequestId(null);
    setScreen("success");
  }

  if (screen === "intro") {
    return <Intro onStart={() => setScreen("form")} />;
  }

  if (screen === "success") {
    return <Success />;
  }

  return (
    <main className="mx-auto w-full max-w-[1210px] pb-10 text-tesText-primary">
      <section className="overflow-hidden rounded-panel border border-brand-lavender/60 bg-white shadow-card">
        <div className="grid min-h-[680px] lg:grid-cols-[255px_minmax(0,1fr)]">
          <RequestAside />
          <div className="p-5 sm:p-8 lg:p-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-primary">
                  Catálogo da plataforma
                </p>
                <h1 className="mt-2 font-display text-4xl leading-none text-brand-deep sm:text-5xl">
                  Sugerir uma nova prática
                </h1>
              </div>
              <Link
                aria-label="Fechar solicitação"
                className="grid size-11 place-items-center rounded-control border border-brand-lavender text-brand-primary hover:bg-brand-lavenderSoft"
                href={routes.therapist.services}
              >
                ×
              </Link>
            </div>

            {existingRequest && !canResubmit ? (
              <RequestStatus request={existingRequest} />
            ) : (
              <>
                <Progress current={step} />
                <div className="mt-8 border-t border-brand-lavender/70 pt-7">
                  {step === 1 ? (
                    <PracticeStep
                      themes={themes}
                      errors={errors}
                      onChange={update}
                      values={values}
                    />
                  ) : null}
                  {step === 2 ? (
                    <UnderstandingStep
                      errors={errors}
                      onChange={update}
                      values={values}
                    />
                  ) : null}
                  {step === 3 ? (
                    <AboutYouStep
                      errors={errors}
                      onChange={update}
                      values={values}
                    />
                  ) : null}
                  {step === 4 ? (
                    <CompatibilityStep
                      errors={errors}
                      onChange={update}
                      values={values}
                    />
                  ) : null}
                  {step === 5 ? (
                    <MaterialsStep
                      errors={errors}
                      files={files}
                      onChange={update}
                      onFiles={setFiles}
                      values={values}
                    />
                  ) : null}
                </div>
                {submissionError ? (
                  <p
                    className="mt-5 rounded-control bg-state-dangerSoft px-4 py-3 text-sm font-semibold text-state-danger"
                    role="alert"
                  >
                    {submissionError}
                  </p>
                ) : null}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-brand-lavender/70 pt-6">
                  {step > 1 ? (
                    <button
                      className="inline-flex min-h-11 items-center gap-2 rounded-control border border-brand-lavender px-4 text-sm font-semibold text-brand-primary"
                      onClick={() => setStep((current) => current - 1)}
                      type="button"
                    >
                      <ArrowLeft aria-hidden="true" className="size-4" />
                      Voltar
                    </button>
                  ) : (
                    <Link
                      className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-semibold text-tesText-secondary"
                      href={routes.therapist.services}
                    >
                      <ArrowLeft aria-hidden="true" className="size-4" />
                      Voltar a serviços
                    </Link>
                  )}
                  {step < 5 ? (
                    <button
                      className="inline-flex min-h-11 items-center gap-2 rounded-control bg-brand-primary px-5 text-sm font-semibold text-white hover:bg-brand-deep"
                      onClick={next}
                      type="button"
                    >
                      Próximo
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </button>
                  ) : (
                    <button
                      className="inline-flex min-h-11 items-center gap-2 rounded-control bg-brand-primary px-5 text-sm font-semibold text-white hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSubmitting}
                      onClick={() => void submit()}
                      type="button"
                    >
                      {isSubmitting ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin"
                        />
                      ) : (
                        <Sparkles aria-hidden="true" className="size-4" />
                      )}
                      {isSubmitting ? "Enviando…" : "Enviar solicitação"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <main className="mx-auto grid min-h-[620px] max-w-3xl place-items-center px-4 pb-10 text-center">
      <section className="w-full rounded-panel border border-brand-lavender/60 bg-white px-6 py-10 shadow-card sm:px-12">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <Leaf aria-hidden="true" className="size-8" />
        </span>
        <h1 className="mt-6 font-display text-5xl leading-[0.95] text-brand-deep sm:text-6xl">
          Sugerir uma nova prática
        </h1>
        <div className="mx-auto mt-6 max-w-xl space-y-4 text-sm leading-7 text-tesText-secondary sm:text-base">
          <p>
            Se você utiliza uma prática que ainda não está disponível no TES,
            envie sua sugestão para análise.
          </p>
          <p>
            Nossa equipe avaliará as informações, a compatibilidade com a
            plataforma e os materiais compartilhados.
          </p>
        </div>
        <button
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-control bg-brand-primary px-6 text-sm font-semibold text-white hover:bg-brand-deep"
          onClick={onStart}
          type="button"
        >
          <Sparkles aria-hidden="true" className="size-4" />
          Iniciar solicitação
        </button>
        <p className="mx-auto mt-7 flex max-w-xl items-start gap-3 rounded-card bg-brand-lavenderSoft/60 p-4 text-left text-sm leading-6 text-tesText-secondary">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-brand-primary"
          />
          Toda solicitação passa por análise. O envio não cria nem publica uma
          terapia automaticamente.
        </p>
      </section>
    </main>
  );
}

function Success() {
  return (
    <main className="mx-auto grid min-h-[620px] max-w-3xl place-items-center px-4 pb-10 text-center">
      <section className="w-full rounded-panel border border-brand-lavender/60 bg-white px-6 py-10 shadow-card sm:px-12">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-state-successSoft text-state-success">
          <Check aria-hidden="true" className="size-9" />
        </span>
        <h1 className="mt-6 font-display text-5xl leading-[0.95] text-brand-deep sm:text-6xl">
          Recebemos sua solicitação
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-tesText-secondary sm:text-base">
          Obrigado por contribuir com a evolução do TES. Quando houver uma
          atualização, você receberá um aviso na Central de Mensagens e, quando
          disponível, por e-mail.
        </p>
        <p className="mx-auto mt-7 flex max-w-xl items-start gap-3 rounded-card bg-brand-lavenderSoft/60 p-4 text-left text-sm leading-6 text-tesText-secondary">
          <Heart
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-brand-primary"
          />
          A aprovação não publica automaticamente a prática. A criação e
          publicação seguem a revisão administrativa do catálogo.
        </p>
        <Link
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-control bg-brand-primary px-6 text-sm font-semibold text-white hover:bg-brand-deep"
          href={routes.therapist.services}
        >
          Voltar a serviços
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>
    </main>
  );
}

function RequestAside() {
  return (
    <aside className="hidden bg-brand-lavenderSoft/45 p-8 lg:block">
      <Leaf aria-hidden="true" className="size-12 text-brand-primary" />
      <h2 className="mt-8 font-display text-4xl leading-none text-brand-deep">
        Sugerir uma nova prática
      </h2>
      <p className="mt-6 text-sm leading-7 text-tesText-secondary">
        Preencha as informações que ajudam nossa equipe a conhecer a prática com
        cuidado e responsabilidade.
      </p>
      <div className="mt-10 rounded-card bg-white/75 p-4">
        <ShieldCheck aria-hidden="true" className="size-6 text-brand-primary" />
        <p className="mt-3 text-sm leading-6 text-tesText-secondary">
          Materiais e informações ficam disponíveis apenas para a análise da
          plataforma.
        </p>
      </div>
    </aside>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <ol
      className="mt-8 grid grid-cols-5 gap-2"
      aria-label="Etapas da solicitação"
    >
      {steps.map((label, index) => {
        const number = index + 1;
        const complete = number < current;
        const active = number === current;
        return (
          <li className="min-w-0 text-center" key={label}>
            <span
              className={`mx-auto grid size-9 place-items-center rounded-full border text-sm font-semibold ${complete || active ? "border-brand-primary bg-brand-primary text-white" : "border-brand-lavender text-tesText-secondary"}`}
            >
              {complete ? (
                <Check aria-hidden="true" className="size-4" />
              ) : (
                number
              )}
            </span>
            <span className="mt-2 block text-xs font-semibold leading-4 text-brand-deep">
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PracticeStep({
  errors,
  onChange,
  themes,
  values,
}: StepProps & { themes: TherapyRequestTheme[] }) {
  const selectionLimitReached = values.themeIds.length >= 3;

  function toggleTheme(themeId: string) {
    onChange(
      "themeIds",
      values.themeIds.includes(themeId)
        ? values.themeIds.filter((id) => id !== themeId)
        : [...values.themeIds, themeId].slice(0, 3),
    );
  }

  return (
    <Step title="1. Sobre a prática">
      <Field error={errors.informedName} label="Nome da prática" required>
        <input
          className={controlClassName}
          onChange={(event) => onChange("informedName", event.target.value)}
          placeholder="Ex.: Mesa Radiônica"
          value={values.informedName}
        />
      </Field>
      <Field label="Outro nome pelo qual ela é conhecida">
        <input
          className={controlClassName}
          onChange={(event) => onChange("aliases", event.target.value)}
          placeholder="Ex.: nomes alternativos ou variações"
          value={values.aliases}
        />
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold text-brand-deep">
          Temas que melhor representam essa prática
          <span className="text-state-danger"> *</span>
        </legend>
        <p className="mt-2 text-sm leading-6 text-tesText-secondary">
          Escolha até 3 temas do Match que ajudam a contextualizar essa prática
          para a análise do TES.
        </p>
        {errors.themeIds ? (
          <p className="mt-2 text-sm text-state-danger">{errors.themeIds}</p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {themes.map((theme) => {
            const selected = values.themeIds.includes(theme.id);
            const disabled = !selected && selectionLimitReached;
            return (
              <button
                aria-pressed={selected}
                className={`rounded-card border p-4 text-left transition ${selected ? "border-brand-primary bg-brand-lavenderSoft/70 text-brand-deep" : "border-brand-lavender bg-white text-brand-deep"} ${disabled ? "cursor-not-allowed opacity-55" : "hover:border-brand-primary/60"}`}
                disabled={disabled}
                key={theme.id}
                onClick={() => toggleTheme(theme.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-sm font-semibold leading-5">
                    {theme.name}
                  </strong>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${selected ? "bg-brand-primary text-white" : "bg-brand-lavenderSoft text-tesText-secondary"}`}
                  >
                    {selected ? "Selecionado" : "Tema"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-tesText-secondary">
                  {theme.description}
                </p>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-tesText-muted">
          {values.themeIds.length} de 3 temas selecionados
        </p>
      </fieldset>
    </Step>
  );
}

function UnderstandingStep({ errors, onChange, values }: StepProps) {
  return (
    <Step title="2. Entendendo a terapia">
      <Field
        error={errors.description}
        label="Como você descreveria essa terapia para alguém que nunca ouviu falar dela?"
        required
      >
        <textarea
          className={`${controlClassName} min-h-32`}
          maxLength={1000}
          onChange={(event) => onChange("description", event.target.value)}
          placeholder="Explique de forma simples e clara…"
          value={values.description}
        />
      </Field>
      <Field
        error={errors.objective}
        label="Qual é o principal objetivo dessa terapia?"
        required
      >
        <input
          className={controlClassName}
          maxLength={200}
          onChange={(event) => onChange("objective", event.target.value)}
          placeholder="Ex.: promover equilíbrio emocional…"
          value={values.objective}
        />
      </Field>
      <Field
        error={errors.useCases}
        label="Em quais situações as pessoas costumam procurar essa terapia?"
        required
      >
        <textarea
          className={`${controlClassName} min-h-28`}
          maxLength={600}
          onChange={(event) => onChange("useCases", event.target.value)}
          placeholder="Liste situações, desafios ou objetivos…"
          value={values.useCases}
        />
      </Field>
      <Field
        error={errors.sessionProcess}
        label="Como normalmente acontece um atendimento?"
        required
      >
        <textarea
          className={`${controlClassName} min-h-28`}
          maxLength={800}
          onChange={(event) => onChange("sessionProcess", event.target.value)}
          placeholder="Explique processo, duração, etapas e ferramentas utilizadas…"
          value={values.sessionProcess}
        />
      </Field>
    </Step>
  );
}

function AboutYouStep({ errors, onChange, values }: StepProps) {
  return (
    <Step title="3. Sobre você">
      <Field
        error={errors.experienceLevel}
        label="Há quanto tempo você pratica essa técnica?"
        required
      >
        <ChoiceGrid
          choices={[
            ["less_than_one", "Menos de 1 ano"],
            ["one_to_three", "1 a 3 anos"],
            ["three_to_five", "3 a 5 anos"],
            ["more_than_five", "Mais de 5 anos"],
          ]}
          onChange={(value) =>
            onChange("experienceLevel", value as FormValues["experienceLevel"])
          }
          value={values.experienceLevel}
        />
      </Field>
      <RadioField
        error={errors.hasTraining}
        label="Você possui formação ou certificação relacionada à terapia?"
        onChange={(value) => onChange("hasTraining", value)}
        required
        value={values.hasTraining}
      />
      {values.hasTraining === "yes" ? (
        <Field label="Onde foi sua formação?">
          <input
            className={controlClassName}
            maxLength={100}
            onChange={(event) =>
              onChange("trainingDescription", event.target.value)
            }
            placeholder="Ex.: instituição, curso ou escola"
            value={values.trainingDescription}
          />
        </Field>
      ) : null}
      <RadioField
        error={errors.practicesProfessionally}
        label="Você atua profissionalmente com essa terapia?"
        onChange={(value) => onChange("practicesProfessionally", value)}
        required
        value={values.practicesProfessionally}
      />
      {values.practicesProfessionally === "yes" ? (
        <Field label="Há quanto tempo você atende com essa terapia?">
          <input
            className={controlClassName}
            maxLength={50}
            onChange={(event) =>
              onChange("practiceDuration", event.target.value)
            }
            placeholder="Ex.: 2 anos e 6 meses"
            value={values.practiceDuration}
          />
        </Field>
      ) : null}
    </Step>
  );
}

function CompatibilityStep({ errors, onChange, values }: StepProps) {
  return (
    <Step title="4. Compatibilidade com o TES">
      <RadioField
        error={errors.guaranteesResults}
        label="Essa terapia faz promessas de resultados garantidos?"
        onChange={(value) => onChange("guaranteesResults", value)}
        required
        value={values.guaranteesResults}
      />
      <RadioField
        error={errors.invasiveProcedure}
        label="Ela envolve algum procedimento físico ou invasivo?"
        onChange={(value) => onChange("invasiveProcedure", value)}
        required
        value={values.invasiveProcedure}
      />
      <RadioField
        error={errors.requiresInPerson}
        label="Ela exige contato físico obrigatório?"
        onChange={(value) => onChange("requiresInPerson", value)}
        required
        value={values.requiresInPerson}
      />
      {values.requiresInPerson === "yes" ? (
        <p className="rounded-card bg-state-warningSoft p-4 text-sm leading-6 text-state-warning">
          <Info aria-hidden="true" className="mr-2 inline size-4" />O TES opera
          exclusivamente online. A equipe avaliará a compatibilidade antes de
          qualquer decisão.
        </p>
      ) : null}
      <Field label="Existe algum cuidado ou limitação importante que deveríamos conhecer?">
        <textarea
          className={`${controlClassName} min-h-28`}
          maxLength={600}
          onChange={(event) => onChange("safetyNotes", event.target.value)}
          placeholder="Ex.: cuidados especiais, restrições de público ou orientações relevantes…"
          value={values.safetyNotes}
        />
      </Field>
    </Step>
  );
}

function MaterialsStep({
  errors,
  files,
  onChange,
  onFiles,
  values,
}: StepProps & { files: File[]; onFiles: (files: File[]) => void }) {
  function appendFiles(next: FileList | null) {
    if (!next) return;
    const accepted = Array.from(next).filter(
      (file) => acceptedTypes.has(file.type) && file.size <= 10 * 1024 * 1024,
    );
    if (accepted.length !== next.length) {
      onFiles([...files, ...accepted]);
      return;
    }
    onFiles([...files, ...accepted]);
  }
  return (
    <Step title="5. Materiais e referências">
      <Field
        error={errors.referenceUrl}
        label="Existe algum site, livro ou referência para conhecermos melhor essa terapia?"
      >
        <input
          className={controlClassName}
          onChange={(event) => onChange("referenceUrl", event.target.value)}
          placeholder="https://… ou título de uma referência"
          value={values.referenceUrl}
        />
      </Field>
      <Field label="Gostaria de enviar material complementar?">
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-card border border-dashed border-brand-lavender bg-brand-lavenderSoft/30 px-4 text-center">
          <FileUp aria-hidden="true" className="size-7 text-brand-primary" />
          <span className="mt-2 text-sm font-semibold text-brand-deep">
            Selecione arquivos para análise
          </span>
          <span className="mt-1 text-xs text-tesText-secondary">
            PDF, imagens, DOC ou DOCX de até 10 MB cada
          </span>
          <input
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
            className="sr-only"
            multiple
            onChange={(event) => appendFiles(event.target.files)}
            type="file"
          />
        </label>
        {files.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {files.map((file, index) => (
              <li
                className="flex items-center justify-between gap-3 rounded-control border border-brand-lavender px-3 py-2 text-sm"
                key={`${file.name}-${index}`}
              >
                <span className="truncate text-brand-deep">{file.name}</span>
                <button
                  aria-label={`Remover ${file.name}`}
                  className="text-brand-primary"
                  onClick={() =>
                    onFiles(files.filter((_, position) => position !== index))
                  }
                  type="button"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Field>
      <Field label="Há mais alguma informação que você gostaria de compartilhar?">
        <textarea
          className={`${controlClassName} min-h-28`}
          maxLength={500}
          onChange={(event) =>
            onChange("additionalInformation", event.target.value)
          }
          placeholder="Escreva aqui…"
          value={values.additionalInformation}
        />
      </Field>
    </Step>
  );
}

function RequestStatus({ request }: { request: TherapyRequestSummary }) {
  return (
    <div className="mt-8 rounded-card border border-brand-lavender bg-brand-lavenderSoft/40 p-6">
      <h2 className="font-display text-3xl text-brand-deep">
        Solicitação em acompanhamento
      </h2>
      <p className="mt-3 text-sm leading-6 text-tesText-secondary">
        {statusCopy(request.status)}
      </p>
      {request.decision ? (
        <p className="mt-4 rounded-control bg-white p-4 text-sm leading-6 text-tesText-secondary">
          {request.decision}
        </p>
      ) : null}
      <Link
        className="mt-6 inline-flex min-h-11 items-center rounded-control bg-brand-primary px-5 text-sm font-semibold text-white"
        href={routes.therapist.services}
      >
        Voltar a serviços
      </Link>
    </div>
  );
}

function Step({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section>
      <h2 className="font-display text-4xl text-brand-deep">{title}</h2>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}
function Field({
  children,
  error,
  label,
  required,
}: {
  children: ReactNode;
  error?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-brand-deep">
      <span>
        {label}
        {required ? <span className="text-state-danger"> *</span> : null}
      </span>
      <span className="mt-2 block">{children}</span>
      {error ? (
        <span className="mt-1 block text-sm text-state-danger">{error}</span>
      ) : null}
    </label>
  );
}
function ChoiceGrid({
  choices,
  onChange,
  value,
}: {
  choices: Array<[string, string]>;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map(([key, label]) => (
        <button
          className={`min-h-12 rounded-control border px-4 text-left text-sm font-semibold ${value === key ? "border-brand-primary bg-brand-lavenderSoft text-brand-deep" : "border-brand-lavender text-tesText-secondary"}`}
          key={key}
          onClick={() => onChange(key)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function RadioField({
  error,
  label,
  onChange,
  required,
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: "no" | "yes") => void;
  required?: boolean;
  value: "" | "no" | "yes";
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-brand-deep">
        {label}
        {required ? <span className="text-state-danger"> *</span> : null}
      </legend>
      <div className="mt-3 flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={value === "yes"}
            name={label}
            onChange={() => onChange("yes")}
            type="radio"
          />
          Sim
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={value === "no"}
            name={label}
            onChange={() => onChange("no")}
            type="radio"
          />
          Não
        </label>
      </div>
      {error ? <p className="mt-1 text-sm text-state-danger">{error}</p> : null}
    </fieldset>
  );
}
type StepProps = {
  errors: Record<string, string>;
  onChange: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  values: FormValues;
};

function validateStep(step: number, values: FormValues) {
  const errors: Record<string, string> = {};
  const required: Record<
    number,
    Array<Exclude<keyof FormValues, "themeIds">>
  > = {
    1: ["informedName"],
    2: ["description", "objective", "useCases", "sessionProcess"],
    3: ["experienceLevel", "hasTraining", "practicesProfessionally"],
    4: ["guaranteesResults", "invasiveProcedure", "requiresInPerson"],
    5: [],
  };
  for (const field of required[step])
    if (!values[field].trim())
      errors[field] = "Preencha este campo para continuar.";
  if (step === 1 && (values.themeIds.length < 1 || values.themeIds.length > 3))
    errors.themeIds = "Escolha de 1 a 3 temas para continuar.";
  if (
    step === 5 &&
    values.referenceUrl &&
    !/^(https?:\/\/[^\s]+|[^\s]{2,120})$/i.test(values.referenceUrl.trim())
  )
    errors.referenceUrl = "Informe um link ou referência válida.";
  return errors;
}
function toPayload(values: FormValues) {
  return {
    informedName: values.informedName.trim(),
    themeIds: values.themeIds,
    submission: {
      additionalInformation: values.additionalInformation.trim() || null,
      aliases: values.aliases.trim() || null,
      description: values.description.trim(),
      experienceLevel: values.experienceLevel,
      guaranteesResults: values.guaranteesResults === "yes",
      hasTraining: values.hasTraining === "yes",
      invasiveProcedure: values.invasiveProcedure === "yes",
      objective: values.objective.trim(),
      practiceDuration: values.practiceDuration.trim() || null,
      practicesProfessionally: values.practicesProfessionally === "yes",
      referenceUrl: values.referenceUrl.trim() || null,
      requiresInPerson: values.requiresInPerson === "yes",
      safetyNotes: values.safetyNotes.trim() || null,
      sessionProcess: values.sessionProcess.trim(),
      themeIds: values.themeIds,
      trainingDescription: values.trainingDescription.trim() || null,
      useCases: values.useCases.trim(),
    },
  };
}
function toFormValues(request: TherapyRequestSummary): FormValues {
  const submission = request.submission;
  const get = (key: string) =>
    typeof submission[key] === "string" ? (submission[key] as string) : "";
  const getStringArray = (key: string) =>
    Array.isArray(submission[key])
      ? Array.from(
          new Set(
            submission[key].filter(
              (value): value is string => typeof value === "string",
            ),
          ),
        ).slice(0, 3)
      : [];
  const bool = (key: string) =>
    submission[key] === true ? "yes" : submission[key] === false ? "no" : "";
  return {
    ...defaultValues,
    additionalInformation: get("additionalInformation"),
    aliases: get("aliases"),
    description: get("description"),
    experienceLevel: get("experienceLevel") as FormValues["experienceLevel"],
    guaranteesResults: bool("guaranteesResults"),
    hasTraining: bool("hasTraining"),
    informedName: request.informedName,
    invasiveProcedure: bool("invasiveProcedure"),
    objective: get("objective"),
    practiceDuration: get("practiceDuration"),
    practicesProfessionally: bool("practicesProfessionally"),
    referenceUrl: get("referenceUrl"),
    requiresInPerson: bool("requiresInPerson"),
    safetyNotes: get("safetyNotes"),
    sessionProcess: get("sessionProcess"),
    themeIds: getStringArray("themeIds"),
    trainingDescription: get("trainingDescription"),
    useCases: get("useCases"),
  };
}
function statusCopy(status: string) {
  return (
    (
      {
        approved:
          "Sua solicitação foi aprovada para a próxima etapa administrativa.",
        merged: "Sua solicitação foi vinculada a uma terapia já existente.",
        needs_information: "A equipe solicitou informações adicionais.",
        rejected:
          "A análise foi concluída. Consulte a mensagem da plataforma para saber mais.",
        submitted: "Sua solicitação foi recebida e aguarda análise.",
        under_review:
          "Sua solicitação está em análise pela equipe da plataforma.",
      } as Record<string, string>
    )[status] ?? "Sua solicitação está sendo acompanhada."
  );
}
async function sendCommand(
  body: unknown,
): Promise<{ data?: { requestId?: string }; message: string; ok: boolean }> {
  try {
    const response = await fetch("/api/therapist/therapy-catalog-requests", {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      data?: { requestId?: string };
      error?: { message?: string };
      ok?: boolean;
    } | null;
    return {
      data: payload?.data,
      message: payload?.error?.message ?? "Não foi possível concluir agora.",
      ok: Boolean(response.ok && payload?.ok),
    };
  } catch {
    return {
      message: "Não foi possível conectar agora. Tente novamente.",
      ok: false,
    };
  }
}
function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
