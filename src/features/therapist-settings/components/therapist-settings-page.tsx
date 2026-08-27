"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  AppPageActions,
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";
import { TESButton, TESFeedbackDialog } from "@/components/tes";
import { SubscriptionManagementPanel } from "@/features/therapist-plan/components/subscription-management-panel";
import type { TherapistPlanPageData } from "@/features/therapist-plan/therapist-plan.types";
import { routes } from "@/lib/routes";

import {
  lookupTherapistAddressByCep,
  updateTherapistSettings,
} from "../therapist-settings.commands";
import {
  formatDocumentNumber,
  formatPostalCode,
} from "../therapist-settings.parsers";
import type {
  TherapistSettingsData,
  TherapistSettingsEditableFields,
} from "../therapist-settings.types";
import { TherapistPrivateDocumentsSection } from "./therapist-private-documents-section";

export function TherapistSettingsPage({
  planData,
  settings,
}: {
  planData: TherapistPlanPageData;
  settings: TherapistSettingsData;
}) {
  const initialFields = pickEditableFields(settings);
  const [savedFields, setSavedFields] =
    useState<TherapistSettingsEditableFields>(initialFields);
  const [fields, setFields] =
    useState<TherapistSettingsEditableFields>(initialFields);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const successMessageRef = useRef<HTMLDivElement>(null);

  const hasChanges = useMemo(
    () => JSON.stringify(fields) !== JSON.stringify(savedFields),
    [fields, savedFields],
  );

  useEffect(() => {
    if (message?.tone !== "success") return;

    const successMessage = successMessageRef.current;
    if (successMessage && typeof successMessage.scrollIntoView === "function") {
      successMessage.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    successMessage?.focus({ preventScroll: true });
  }, [message]);

  async function submit() {
    const validation = validateSettingsFields(fields);
    if (validation) {
      setFeedback(validation);
      return;
    }

    setPending(true);
    setMessage(null);
    const result = await updateTherapistSettings(fields);
    setPending(false);

    if (result.status === "error") {
      setFeedback(result.error.message);
      return;
    }

    setFields(result.data.account);
    setSavedFields(result.data.account);
    setMessage({ text: "Configurações salvas.", tone: "success" });
  }

  return (
    <AppPageContainer className="gap-5">
      <AppPageHeader
        actions={
          <AppPageActions>
            <TESButton
              className="rounded-lg"
              disabled={!hasChanges || pending}
              onClick={() => void submit()}
              type="button"
            >
              {pending ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={18}
                />
              ) : (
                <Save aria-hidden="true" size={18} />
              )}
              Salvar alterações
            </TESButton>
          </AppPageActions>
        }
        eyebrow="Minha conta"
        title="Configurações"
      >
        Mantenha seus dados e documentos em dia para concluir a análise e
        publicar seu perfil no TES.
      </AppPageHeader>

      {message?.tone === "success" ? (
        <div
          ref={successMessageRef}
          className="scroll-mt-6 rounded-card border border-status-success/30 bg-status-successBg p-4 text-sm font-bold leading-6 text-status-success"
          role="status"
          tabIndex={-1}
        >
          {message.text}
        </div>
      ) : null}

      <StatusGuideSection />

      <AppPageGrid className="xl:items-start">
        <AppPageMain>
          <SubscriptionManagementPanel data={planData} />
          <AccountSection
            email={settings.account.email}
            fields={fields}
            onChange={(next) =>
              setFields((current) => ({ ...current, ...next }))
            }
            onSubmit={() => void submit()}
            pending={pending}
          />
          <TherapistPrivateDocumentsSection
            initialDocuments={settings.documentCenter.documents}
            initialVerificationStatus={
              settings.documentCenter.verificationStatus
            }
          />
          <SettingsShortcutSection
            description="Acesse rapidamente as áreas que ajudam você a cuidar do seu trabalho no TES."
            items={[
              {
                description:
                  "Cuide da foto, da sua apresentação e da publicação do perfil.",
                href: routes.therapist.profileEdit,
                icon: UserRound,
                label: "Meu perfil",
                title: "Presença pública",
              },
              {
                description:
                  "Escolha seus horários e informe quando você pode atender.",
                href: routes.therapist.agenda,
                icon: CalendarDays,
                label: "Abrir agenda",
                title: "Agenda e reservas",
              },
              {
                description:
                  "Acompanhe seus recebimentos e conecte sua conta para receber.",
                href: `${routes.therapist.finance}?tab=account`,
                icon: CreditCard,
                label: "Conta de recebimento",
                title: "Financeiro",
              },
            ]}
            title="Operação"
          />
          <SecuritySection email={settings.account.email} />
          <PrivacySection settings={settings} />
        </AppPageMain>

        <AppPageAside className="content-start">
          <StatusPanel settings={settings} />
          <ProtectedDataPanel />
        </AppPageAside>
      </AppPageGrid>
      {feedback ? (
        <TESFeedbackDialog
          message={feedback}
          onClose={() => setFeedback(null)}
        />
      ) : null}
    </AppPageContainer>
  );
}

export function TherapistSettingsErrorState({ message }: { message: string }) {
  return (
    <AppPageContainer>
      <AppPageSection className="grid gap-5">
        <span className="grid size-12 place-items-center rounded-full bg-status-dangerBg text-status-danger">
          <LockKeyhole aria-hidden="true" size={24} />
        </span>
        <div>
          <h1 className="font-display text-[34px] font-light italic leading-tight text-brand-deep sm:text-[46px]">
            Configurações indisponíveis
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            {message}
          </p>
        </div>
        <TESButton
          className="w-fit rounded-lg"
          href={routes.therapist.settings}
        >
          Tentar novamente
        </TESButton>
      </AppPageSection>
    </AppPageContainer>
  );
}

function AccountSection({
  email,
  fields,
  onChange,
  onSubmit,
  pending,
}: {
  email: string;
  fields: TherapistSettingsEditableFields;
  onChange: (next: Partial<TherapistSettingsEditableFields>) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const latestIdentity = useRef(fields.identity);
  const lookupCepRef = useRef<string | null>(null);
  const [cepLookup, setCepLookup] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [cepLookupMessage, setCepLookupMessage] = useState<string | null>(null);
  const postalCode = fields.identity.postalCode;

  latestIdentity.current = fields.identity;

  useEffect(() => {
    const digits = postalCode.replace(/\D/g, "");
    if (digits.length !== 8) {
      lookupCepRef.current = null;
      setCepLookup("idle");
      setCepLookupMessage(null);
      return;
    }
    if (lookupCepRef.current === digits) return;

    lookupCepRef.current = digits;
    const controller = new AbortController();
    setCepLookup("loading");
    setCepLookupMessage(null);

    void lookupTherapistAddressByCep(digits, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        if (result.status === "error") {
          setCepLookup("error");
          setCepLookupMessage(result.error.message);
          return;
        }

        const current = latestIdentity.current;
        onChange({
          identity: {
            ...current,
            city: result.data.city || current.city,
            neighborhood: result.data.neighborhood || current.neighborhood,
            postalCode: result.data.postalCode,
            state: result.data.state || current.state,
            street: result.data.street || current.street,
          },
        });
        setCepLookup("idle");
        setCepLookupMessage(
          "Endereço localizado. Confira e edite os campos se necessário.",
        );
      },
    );

    return () => controller.abort();
  }, [onChange, postalCode]);

  return (
    <AppPageSection>
      <div className="grid gap-6">
        <SectionHeading
          description="Esses dados são usados para identificar sua conta. O que aparece para o público é editado em Meu perfil."
          icon={UserRound}
          title="Dados da conta"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="displayName"
            label="Nome completo"
            onChange={(value) => onChange({ displayName: value })}
            required
            value={fields.displayName}
          />
          <TextField disabled id="email" label="E-mail" value={email} />
          <TextField
            id="phone"
            label="Telefone"
            onChange={(value) => onChange({ phone: value })}
            placeholder="+55 11 99999-9999"
            value={fields.phone}
          />
        </div>
        <div className="grid gap-5 border-t border-border pt-6">
          <div>
            <h3 className="text-base font-extrabold text-brand-deep">
              Dados necessários para aprovação
            </h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
              Precisamos dessas informações para confirmar sua identidade e
              analisar seu cadastro. Seus dados ficam protegidos e não aparecem
              no seu perfil público.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField
              id="documentType"
              label="Tipo de documento"
              onChange={(value) =>
                onChange({
                  identity: {
                    ...fields.identity,
                    documentNumber: "",
                    documentType: value as "cpf" | "rg" | "passport",
                  },
                })
              }
              options={[
                { label: "CPF", value: "cpf" },
                { label: "RG", value: "rg" },
                { label: "Passaporte", value: "passport" },
              ]}
              value={fields.identity.documentType}
            />
            <TextField
              id="documentNumber"
              label="Número"
              onChange={(value) =>
                onChange({
                  identity: {
                    ...fields.identity,
                    documentNumber: formatDocumentNumber(
                      value,
                      fields.identity.documentType,
                    ),
                  },
                })
              }
              placeholder={documentPlaceholder(fields.identity.documentType)}
              required
              value={fields.identity.documentNumber}
            />
            <TextField
              id="postalCode"
              label="CEP"
              onChange={(value) =>
                onChange({
                  identity: {
                    ...fields.identity,
                    postalCode: formatPostalCode(value),
                  },
                })
              }
              placeholder="00000-000"
              required
              value={fields.identity.postalCode}
            />
            <div className="md:col-span-3" aria-live="polite">
              {cepLookup === "loading" ? (
                <p className="text-sm font-semibold text-tesText-secondary">
                  Consultando o endereço...
                </p>
              ) : cepLookupMessage ? (
                <p className="text-sm font-semibold text-tesText-secondary">
                  {cepLookupMessage}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <TextField
              id="street"
              label="Endereço"
              onChange={(value) =>
                onChange({
                  identity: { ...fields.identity, street: value },
                })
              }
              required
              value={fields.identity.street}
            />
            <TextField
              id="streetNumber"
              label="Número"
              onChange={(value) =>
                onChange({
                  identity: { ...fields.identity, streetNumber: value },
                })
              }
              required
              value={fields.identity.streetNumber}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <TextField
              id="complement"
              label="Complemento"
              onChange={(value) =>
                onChange({
                  identity: { ...fields.identity, complement: value },
                })
              }
              value={fields.identity.complement}
            />
            <TextField
              id="neighborhood"
              label="Bairro"
              onChange={(value) =>
                onChange({
                  identity: { ...fields.identity, neighborhood: value },
                })
              }
              required
              value={fields.identity.neighborhood}
            />
            <TextField
              id="city"
              label="Cidade"
              onChange={(value) =>
                onChange({
                  identity: { ...fields.identity, city: value },
                })
              }
              required
              value={fields.identity.city}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <TextField
              autoComplete="address-level1"
              id="state"
              label="Estado"
              maxLength={2}
              onChange={(value) =>
                onChange({
                  identity: { ...fields.identity, state: value },
                })
              }
              required
              value={fields.identity.state}
            />
            <p className="self-end text-sm font-semibold leading-6 text-tesText-secondary">
              Informe um endereço no Brasil. Para passaporte, digite letras e
              números como aparecem no documento.
            </p>
          </div>
        </div>
        <AppPageActions>
          <TESButton
            className="rounded-lg"
            disabled={pending}
            onClick={onSubmit}
            type="button"
          >
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={18} />
            ) : (
              <Save aria-hidden="true" size={18} />
            )}
            Salvar meus dados
          </TESButton>
          <TESButton
            className="rounded-lg"
            href={routes.therapist.profileEdit}
            variant="secondary"
          >
            Editar perfil público
          </TESButton>
        </AppPageActions>
      </div>
    </AppPageSection>
  );
}

function SecuritySection({ email }: { email: string }) {
  return (
    <AppPageSection className="grid gap-6">
      <SectionHeading
        description="Você pode trocar sua senha sempre que precisar. O TES não mostra sua senha."
        icon={LockKeyhole}
        title="Segurança"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ReadOnlyFact icon={Mail} label="E-mail da conta" value={email} />
        <ReadOnlyFact
          icon={ShieldCheck}
          label="Tipo de conta"
          value="Terapeuta"
        />
      </div>
      <AppPageActions>
        <TESButton
          className="rounded-lg"
          href={routes.public.resetPassword}
          variant="secondary"
        >
          Alterar senha
        </TESButton>
        <TESButton
          className="rounded-lg"
          href={routes.public.privacy}
          variant="ghost"
        >
          Política de privacidade
        </TESButton>
      </AppPageActions>
    </AppPageSection>
  );
}

function PrivacySection({ settings }: { settings: TherapistSettingsData }) {
  return (
    <AppPageSection className="grid gap-6">
      <SectionHeading
        description="Aqui você acompanha o que já foi aprovado e o que as pessoas conseguem ver no TES."
        icon={ShieldCheck}
        title="Privacidade e publicação"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <ReadOnlyFact
          icon={CheckCircle2}
          label="Perfil público"
          value={
            settings.profile.isPublic ? "Publicado" : "Ainda não publicado"
          }
        />
        <ReadOnlyFact
          icon={CalendarDays}
          label="Reservas"
          value={
            settings.profile.isAcceptingBookings
              ? "Recebendo novas sessões"
              : "Ainda não recebendo sessões"
          }
        />
        <ReadOnlyFact
          icon={ExternalLink}
          label="Visibilidade do perfil"
          value={publicStatusLabel(settings.profile.publicStatus)}
        />
      </div>
      <AppPageActions>
        <TESButton
          className="rounded-lg"
          href={settings.profile.publicUrl}
          variant="secondary"
        >
          Ver perfil público
        </TESButton>
        <TESButton
          className="rounded-lg"
          href={routes.therapist.profileEdit}
          variant="secondary"
        >
          Ver meu perfil
        </TESButton>
      </AppPageActions>
    </AppPageSection>
  );
}

function SettingsShortcutSection({
  description,
  items,
  title,
}: {
  description?: string;
  items: Array<{
    description: string;
    href: string;
    icon: LucideIcon;
    label: string;
    title: string;
  }>;
  title: string;
}) {
  return (
    <AppPageSection className="grid gap-5">
      <div>
        <h2 className="text-xl font-extrabold text-brand-deep">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            {description}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4">
        {items.map((item) => (
          <ShortcutItem item={item} key={item.title} />
        ))}
      </div>
    </AppPageSection>
  );
}

function ShortcutItem({
  item,
}: {
  item: {
    description: string;
    href: string;
    icon: LucideIcon;
    label: string;
    title: string;
  };
}) {
  const Icon = item.icon;
  return (
    <div className="grid gap-4 rounded-lg border border-brand-lavender bg-white p-4 sm:grid-cols-[48px_1fr_auto] sm:items-center">
      <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={22} />
      </span>
      <div>
        <h3 className="text-base font-extrabold text-brand-deep">
          {item.title}
        </h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
          {item.description}
        </p>
      </div>
      <TESButton className="rounded-lg" href={item.href} variant="secondary">
        {item.label}
      </TESButton>
    </div>
  );
}

function StatusPanel({ settings }: { settings: TherapistSettingsData }) {
  return (
    <AppPageSection className="h-fit self-start">
      <SectionHeading icon={CheckCircle2} title="Estado atual" />
      <div className="mt-5 grid content-start gap-3">
        <ReadOnlyFact label="Plano" value={planLabel(settings.profile.plan)} />
        <ReadOnlyFact
          label="Aprovação"
          value={profileStatusLabel(settings.profile.status)}
        />
        <ReadOnlyFact
          label="Perfil completo"
          value={
            settings.profile.status === "approved"
              ? "Conteúdo e dados conferidos"
              : "Ainda em preparação"
          }
        />
        <ReadOnlyFact
          label="Perfil público"
          value={
            settings.profile.isPublic
              ? "Perfil publicado"
              : "Ainda não publicado"
          }
        />
        <ReadOnlyFact
          label="Nome público"
          value={settings.profile.publicName || "Ainda sem nome público"}
        />
      </div>
      <TESButton
        className="mt-5 h-fit w-fit self-start rounded-lg"
        href={routes.therapist.plan}
      >
        Ver plano
      </TESButton>
    </AppPageSection>
  );
}

function StatusGuideSection() {
  const items = [
    {
      description:
        "Seu nome, apresentação, terapias e disponibilidade estão preenchidos.",
      title: "Perfil completo",
    },
    {
      description: "A equipe TES conferiu seus dados e os documentos enviados.",
      title: "Cadastro aprovado",
    },
    {
      description:
        "Seu perfil pode ser encontrado pelas pessoas e receber novas sessões.",
      title: "Perfil publicado",
    },
  ];

  return (
    <AppPageSection className="grid gap-5">
      <SectionHeading
        description="Esses três momentos são diferentes, mas fazem parte do mesmo caminho."
        icon={CheckCircle2}
        title="Entenda cada etapa"
      />
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <div
            className="rounded-lg border border-brand-lavender bg-brand-lavenderSoft/50 p-4"
            key={item.title}
          >
            <h3 className="text-base font-extrabold text-brand-deep">
              {item.title}
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </AppPageSection>
  );
}

function ProtectedDataPanel() {
  return (
    <AppPageSection className="h-fit self-start">
      <SectionHeading icon={ShieldCheck} title="Dados protegidos" />
      <ul className="mt-5 grid content-start gap-4 text-sm font-semibold leading-6 text-tesText-secondary">
        <li>
          Mudanças de plano começam em Meu plano; cancelamentos e mudanças
          futuras ficam nesta área.
        </li>
        <li>Seus dados de recebimento são cuidados em uma página segura.</li>
        <li>Seus documentos são privados e não aparecem no perfil público.</li>
      </ul>
    </AppPageSection>
  );
}

function SectionHeading({
  description,
  icon: Icon,
  title,
}: {
  description?: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={22} />
      </span>
      <div>
        <h2 className="text-xl font-extrabold text-brand-deep">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm font-semibold leading-6 text-tesText-secondary">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TextField({
  autoComplete,
  disabled,
  id,
  label,
  maxLength,
  onChange,
  placeholder,
  required,
  value,
}: {
  autoComplete?: string;
  disabled?: boolean;
  id: string;
  label: string;
  maxLength?: number;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <div>
      <label className="text-sm font-extrabold text-brand-deep" htmlFor={id}>
        {label}
      </label>
      <input
        autoComplete={autoComplete}
        className="mt-3 min-h-11 w-full rounded-lg border border-brand-lavender/70 bg-white px-4 text-sm font-bold text-brand-deep shadow-card outline-none transition placeholder:text-tesText-subtle focus:border-brand-primary focus:ring-4 focus:ring-ring/20 disabled:bg-brand-lavenderSoft disabled:text-tesText-secondary"
        disabled={disabled}
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  onChange,
  options,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div>
      <label className="text-sm font-extrabold text-brand-deep" htmlFor={id}>
        {label}
      </label>
      <select
        className="mt-3 min-h-11 w-full rounded-lg border border-brand-lavender/70 bg-white px-4 text-sm font-bold text-brand-deep shadow-card outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-ring/20"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReadOnlyFact({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-brand-lavender bg-brand-lavenderSoft/50 p-4">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-brand-primary">
            <Icon aria-hidden="true" size={18} />
          </span>
        ) : null}
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-subtle">
            {label}
          </p>
          <p className="mt-2 text-sm font-extrabold leading-6 text-brand-deep">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function validateSettingsFields(fields: TherapistSettingsEditableFields) {
  const displayName = fields.displayName.trim();
  const phone = fields.phone.trim();

  if (displayName.length < 2) {
    return "Informe seu nome completo com pelo menos 2 caracteres.";
  }
  if (displayName.length > 120) {
    return "Seu nome completo deve ter até 120 caracteres.";
  }
  if (phone && (phone.length > 30 || !/^[+()0-9\s-]+$/.test(phone))) {
    return "Informe um telefone válido ou deixe o campo vazio.";
  }
  const identity = fields.identity;
  if (
    !identity.documentNumber ||
    !identity.postalCode ||
    !identity.street ||
    !identity.streetNumber ||
    !identity.neighborhood ||
    !identity.city ||
    identity.state.length !== 2
  ) {
    return "Preencha seus dados e endereço para continuarmos com a aprovação do seu perfil.";
  }
  return null;
}

function pickEditableFields(
  settings: TherapistSettingsData,
): TherapistSettingsEditableFields {
  return {
    displayName: settings.account.displayName,
    phone: settings.account.phone,
    identity: settings.account.identity,
  };
}

function documentPlaceholder(
  documentType: TherapistSettingsEditableFields["identity"]["documentType"],
) {
  if (documentType === "cpf") return "000.000.000-00";
  if (documentType === "rg") return "00.000.000-0";
  return "AB123456";
}

function planLabel(plan: TherapistSettingsData["profile"]["plan"]) {
  if (plan === "premium_plus") return "Premium Plus";
  if (plan === "premium") return "Premium";
  return "Free";
}

function profileStatusLabel(
  status: TherapistSettingsData["profile"]["status"],
) {
  const labels = {
    approved: "Cadastro aprovado",
    changes_requested: "Falta ajustar o cadastro",
    draft: "Ainda não enviado",
    in_review: "Cadastro em análise",
    rejected: "Cadastro não aprovado",
    submitted: "Cadastro recebido",
    suspended: "Suspenso",
  } satisfies Record<TherapistSettingsData["profile"]["status"], string>;

  return labels[status];
}

function publicStatusLabel(status: string) {
  const labels: Record<string, string> = {
    archived: "Arquivado",
    draft: "Rascunho",
    published: "Publicado",
    suspended: "Suspenso",
    unpublished: "Despublicado",
  };

  return labels[status] ?? "Rascunho";
}
