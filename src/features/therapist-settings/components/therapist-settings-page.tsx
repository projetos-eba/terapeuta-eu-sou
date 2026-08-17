"use client";

import { useMemo, useState } from "react";
import {
  Bell,
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
import { TESButton } from "@/components/tes";
import { SubscriptionManagementPanel } from "@/features/therapist-plan/components/subscription-management-panel";
import type { TherapistPlanPageData } from "@/features/therapist-plan/therapist-plan.types";
import { routes } from "@/lib/routes";

import { updateTherapistSettings } from "../therapist-settings.commands";
import type {
  TherapistSettingsData,
  TherapistSettingsEditableFields,
} from "../therapist-settings.types";

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

  const hasChanges = useMemo(
    () => JSON.stringify(fields) !== JSON.stringify(savedFields),
    [fields, savedFields],
  );

  async function submit() {
    const validation = validateSettingsFields(fields);
    if (validation) {
      setMessage({ text: validation, tone: "error" });
      return;
    }

    setPending(true);
    setMessage(null);
    const result = await updateTherapistSettings(fields);
    setPending(false);

    if (result.status === "error") {
      setMessage({ text: result.error.message, tone: "error" });
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
        eyebrow="Conta profissional"
        title="Configurações"
      >
        Ajuste dados da conta, segurança e caminhos operacionais sem misturar
        informações públicas, financeiras ou administrativas.
      </AppPageHeader>

      {message ? (
        <div
          className={
            message.tone === "success"
              ? "rounded-card border border-status-success/30 bg-status-successBg p-4 text-sm font-bold leading-6 text-status-success"
              : "rounded-card border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-bold leading-6 text-status-danger"
          }
          role={message.tone === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      ) : null}

      <AppPageGrid>
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
          <SettingsShortcutSection
            description="Cada área mantém suas informações organizadas para facilitar sua rotina."
            items={[
              {
                description:
                  "Edite foto, apresentação e publicação do perfil público.",
                href: routes.therapist.profileEdit,
                icon: UserRound,
                label: "Meu perfil",
                title: "Presença pública",
              },
              {
                description:
                  "Configure horários recorrentes, bloqueios e antecedência.",
                href: routes.therapist.agenda,
                icon: CalendarDays,
                label: "Abrir agenda",
                title: "Agenda e reservas",
              },
              {
                description:
                  "Revise sua conta de recebimento e o estado dos repasses.",
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

        <AppPageAside>
          <StatusPanel settings={settings} />
          <ProtectedDataPanel />
          <SettingsShortcutSection
            compact
            items={[
              {
                description: "Mensagens, avisos e suporte ficam centralizados.",
                href: routes.therapist.messages,
                icon: Bell,
                label: "Abrir mensagens",
                title: "Notificações",
              },
              {
                description:
                  "Termos, privacidade e políticas públicas do Terapeuta Eu Sou.",
                href: routes.public.privacy,
                icon: ShieldCheck,
                label: "Ver políticas",
                title: "Privacidade",
              },
            ]}
            title="Preferências"
          />
        </AppPageAside>
      </AppPageGrid>
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
  return (
    <AppPageSection>
      <div className="grid gap-6">
        <SectionHeading
          description="Estes dados identificam sua conta de acesso. Seu perfil público continua sendo editado em Meu perfil."
          icon={UserRound}
          title="Dados da conta"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="displayName"
            label="Nome de acesso"
            onChange={(value) => onChange({ displayName: value })}
            required
            value={fields.displayName}
          />
          <TextField
            disabled
            id="email"
            label="E-mail de acesso"
            value={email}
          />
          <TextField
            id="phone"
            label="Telefone"
            onChange={(value) => onChange({ phone: value })}
            placeholder="+55 11 99999-9999"
            value={fields.phone}
          />
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
            Salvar dados da conta
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
        description="A senha é trocada por fluxo seguro de recuperação. O TES não mostra nem armazena sua senha em texto aberto."
        icon={LockKeyhole}
        title="Segurança"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ReadOnlyFact icon={Mail} label="E-mail de login" value={email} />
        <ReadOnlyFact
          icon={ShieldCheck}
          label="Acesso"
          value="Conta de terapeuta autenticada"
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
        description="Publicação, reservas e exibição pública dependem das áreas responsáveis para manter consistência em todo o sistema."
        icon={ShieldCheck}
        title="Privacidade e publicação"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <ReadOnlyFact
          icon={CheckCircle2}
          label="Perfil público"
          value={settings.profile.isPublic ? "Visível" : "Não publicado"}
        />
        <ReadOnlyFact
          icon={CalendarDays}
          label="Reservas"
          value={
            settings.profile.isAcceptingBookings
              ? "Recebendo reservas"
              : "Não recebendo reservas"
          }
        />
        <ReadOnlyFact
          icon={ExternalLink}
          label="Status público"
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
          Ajustar publicação
        </TESButton>
      </AppPageActions>
    </AppPageSection>
  );
}

function SettingsShortcutSection({
  compact = false,
  description,
  items,
  title,
}: {
  compact?: boolean;
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
      <div className={compact ? "grid gap-3" : "grid gap-4"}>
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
    <AppPageSection className="grid gap-5">
      <SectionHeading icon={CheckCircle2} title="Estado atual" />
      <div className="grid gap-3">
        <ReadOnlyFact label="Plano" value={planLabel(settings.profile.plan)} />
        <ReadOnlyFact
          label="Cadastro"
          value={profileStatusLabel(settings.profile.status)}
        />
        <ReadOnlyFact
          label="Nome público"
          value={settings.profile.publicName || "Ainda sem nome público"}
        />
      </div>
      <TESButton className="rounded-lg" href={routes.therapist.plan}>
        Ver plano
      </TESButton>
    </AppPageSection>
  );
}

function ProtectedDataPanel() {
  return (
    <AppPageSection className="grid gap-4">
      <SectionHeading icon={ShieldCheck} title="Dados protegidos" />
      <ul className="grid gap-3 text-sm font-semibold leading-6 text-tesText-secondary">
        <li>
          Upgrades ficam em Planos; cancelamentos e mudanças futuras ficam nesta
          página.
        </li>
        <li>Dados bancários completos ficam no ambiente seguro de pagamentos.</li>
        <li>Documentos privados não aparecem no perfil público.</li>
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
  disabled,
  id,
  label,
  onChange,
  placeholder,
  required,
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
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
        className="mt-3 min-h-11 w-full rounded-lg border border-brand-lavender/70 bg-white px-4 text-sm font-bold text-brand-deep shadow-card outline-none transition placeholder:text-tesText-subtle focus:border-brand-primary focus:ring-4 focus:ring-ring/20 disabled:bg-brand-lavenderSoft disabled:text-tesText-secondary"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
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
    return "Informe um nome de uso interno com pelo menos 2 caracteres.";
  }
  if (displayName.length > 120) {
    return "O nome de uso interno deve ter até 120 caracteres.";
  }
  if (phone && (phone.length > 30 || !/^[+()0-9\s-]+$/.test(phone))) {
    return "Informe um telefone válido ou deixe o campo vazio.";
  }
  return null;
}

function pickEditableFields(
  settings: TherapistSettingsData,
): TherapistSettingsEditableFields {
  return {
    displayName: settings.account.displayName,
    phone: settings.account.phone,
  };
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
    approved: "Aprovado",
    changes_requested: "Ajustes solicitados",
    draft: "Rascunho",
    in_review: "Em análise",
    rejected: "Reprovado",
    submitted: "Enviado",
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
