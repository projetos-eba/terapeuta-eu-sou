"use client";

import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  CreditCard,
  Heart,
  Home,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  PencilLine,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from "react";

import {
  AppPageActions,
  AppPageAside,
  AppPageContainer,
  AppPageGrid,
  AppPageHeader,
  AppPageMain,
  AppPageSection,
} from "@/components/app-page";
import {
  PasswordVisibilityToggle,
  PhoneInput,
  TESButton,
  TESFeedbackDialog,
} from "@/components/tes";
import { routes } from "@/lib/routes";

import {
  changePatientPassword,
  lookupPatientAddressByCep,
  updatePatientAccount,
  uploadPatientAvatar,
} from "../patient-account.commands";
import {
  formatPatientPostalCode,
  parsePatientAccountUpdatePayload,
} from "../patient-account.parsers";
import type {
  PatientAccountData,
  PatientAccountEditableFields,
  PatientAccountPayment,
  PatientAddress,
} from "../patient-account.types";

type Feedback = { text: string; tone: "error" | "success" } | null;

export function PatientAccountPage({ data }: { data: PatientAccountData }) {
  const initialFields = useMemo<PatientAccountEditableFields>(
    () => ({
      address: data.address,
      name: data.account.name,
      phone: data.account.phone,
      phoneCountryCode: data.account.phoneCountryCode,
    }),
    [data],
  );
  const [savedFields, setSavedFields] =
    useState<PatientAccountEditableFields>(initialFields);
  const [fields, setFields] =
    useState<PatientAccountEditableFields>(initialFields);
  const [avatarUrl, setAvatarUrl] = useState(data.account.avatarUrl);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [profilePending, setProfilePending] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState<Feedback>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const hasChanges = JSON.stringify(fields) !== JSON.stringify(savedFields);

  async function saveProfile() {
    let payload: PatientAccountEditableFields;
    try {
      payload = parsePatientAccountUpdatePayload(fields);
    } catch {
      setProfileFeedback({
        text: "Confira seu nome e revise os dados do endereço antes de salvar.",
        tone: "error",
      });
      return;
    }

    setProfilePending(true);
    setProfileFeedback(null);
    const result = await updatePatientAccount(payload);
    setProfilePending(false);

    if (result.status === "error") {
      setProfileFeedback({ text: result.error.message, tone: "error" });
      return;
    }

    const nextFields = {
      address: result.data.address,
      name: result.data.name,
      phone: result.data.phone,
      phoneCountryCode: result.data.phoneCountryCode,
    };
    setFields(nextFields);
    setSavedFields(nextFields);
    setProfileFeedback({ text: "Seus dados foram salvos.", tone: "success" });
  }

  async function handleAvatar(file: File | undefined) {
    setAvatarFeedback(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarFeedback({
        text: "Escolha uma imagem em JPG, PNG ou WebP.",
        tone: "error",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarFeedback({
        text: "A imagem deve ter no máximo 5 MB.",
        tone: "error",
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    setAvatarPending(true);
    const result = await uploadPatientAvatar(file);
    setAvatarPending(false);
    URL.revokeObjectURL(previewUrl);

    if (result.status === "error") {
      setAvatarUrl(data.account.avatarUrl);
      setAvatarFeedback({ text: result.error.message, tone: "error" });
      return;
    }

    setAvatarUrl(result.data.avatarUrl);
    setAvatarFeedback({ text: "Sua foto foi atualizada.", tone: "success" });
  }

  return (
    <AppPageContainer className="max-w-[1180px] gap-4 pb-12 sm:gap-5">
      <AppPageHeader
        actions={
          <AppPageActions>
            <TESButton
              className="min-w-[154px] rounded-lg bg-white/85 backdrop-blur-sm"
              disabled={!hasChanges || profilePending}
              onClick={() => void saveProfile()}
              size="sm"
              type="button"
              variant="secondary"
            >
              {profilePending ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={18}
                />
              ) : (
                <PencilLine aria-hidden="true" size={16} />
              )}
              Salvar alterações
            </TESButton>
          </AppPageActions>
        }
        className="relative min-h-[150px] overflow-hidden bg-[url('/patient/account/patient-account-path-hero.webp')] bg-cover bg-[position:68%_center] px-6 py-5 before:absolute before:inset-0 before:bg-gradient-to-r before:from-white before:from-[32%] before:via-white/90 before:via-[58%] before:to-white/15 before:content-[''] [&>div]:relative [&>div]:z-[1] sm:px-8 sm:py-6"
        eyebrow="Minha conta"
        title={
          <>
            Seu espaço, suas escolhas,{" "}
            <span className="text-brand-primary">seu caminho.</span>
          </>
        }
      >
        Tudo o que é seu, reunido em um só lugar.
      </AppPageHeader>

      {profileFeedback?.tone === "success" ? (
        <FeedbackBanner feedback={profileFeedback} />
      ) : null}
      {profileFeedback?.tone === "error" ? (
        <TESFeedbackDialog
          message={profileFeedback.text}
          onClose={() => setProfileFeedback(null)}
        />
      ) : null}

      <AppPageGrid className="xl:grid-cols-[minmax(0,1fr)_300px]">
        <AppPageMain className="gap-4 sm:gap-5">
          <IdentitySection
            avatarFeedback={avatarFeedback}
            avatarInputRef={avatarInputRef}
            avatarPending={avatarPending}
            avatarUrl={avatarUrl}
            fields={fields}
            onAvatarFeedbackClose={() => setAvatarFeedback(null)}
            onAvatarSelected={(file) => void handleAvatar(file)}
          />
          <PersonalDataSection
            email={data.account.email}
            fields={fields}
            onChange={(next) =>
              setFields((current) => ({ ...current, ...next }))
            }
          />
          <AddressSection
            address={fields.address}
            onChange={(address) =>
              setFields((current) => ({ ...current, address }))
            }
          />
          <SecuritySection />
        </AppPageMain>

        <AppPageAside className="self-start gap-4 sm:gap-5">
          <AccountSummary account={data.account} />
          <PaymentSummary data={data} />
          <SupportCard />
        </AppPageAside>
      </AppPageGrid>
    </AppPageContainer>
  );
}

function IdentitySection({
  avatarFeedback,
  avatarInputRef,
  avatarPending,
  avatarUrl,
  fields,
  onAvatarFeedbackClose,
  onAvatarSelected,
}: {
  avatarFeedback: Feedback;
  avatarInputRef: MutableRefObject<HTMLInputElement | null>;
  avatarPending: boolean;
  avatarUrl: string | null;
  fields: PatientAccountEditableFields;
  onAvatarFeedbackClose: () => void;
  onAvatarSelected: (file: File | undefined) => void;
}) {
  return (
    <AppPageSection className="overflow-hidden p-0">
      <div className="grid gap-5 p-5 sm:grid-cols-[104px_minmax(0,1fr)] sm:items-center sm:px-6 sm:py-5">
        <div className="relative mx-auto sm:mx-0">
          <div className="relative grid size-24 place-items-center overflow-hidden rounded-full border-4 border-brand-lavenderSoft bg-white text-brand-primary shadow-card sm:size-[104px]">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar dinâmico retornado pelo Storage do perfil.
              <img
                alt={`Foto de ${fields.name}`}
                className="size-full object-cover"
                src={avatarUrl}
              />
            ) : (
              <span
                aria-hidden="true"
                className="font-display text-4xl font-light italic"
              >
                {getInitials(fields.name)}
              </span>
            )}
          </div>
          <span className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full border-[3px] border-white bg-brand-primary text-white">
            <Camera aria-hidden="true" size={14} />
          </span>
        </div>

        <div className="grid gap-3 text-center sm:text-left">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-primary">
              Seu perfil
            </p>
            <h2 className="mt-1.5 flex items-center justify-center gap-2 font-display text-[28px] font-light italic leading-tight text-brand-deep sm:justify-start sm:text-[32px]">
              Olá, {getFirstName(fields.name) || "Paciente"}
              <Heart
                aria-hidden="true"
                className="fill-brand-primary text-brand-primary"
                size={13}
              />
            </h2>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-5 text-tesText-secondary">
              Esse é o espaço que vai acompanhar você por aqui.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-start">
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={avatarPending}
              onChange={(event) => {
                onAvatarSelected(event.target.files?.[0]);
                event.target.value = "";
              }}
              ref={avatarInputRef}
              type="file"
            />
            <TESButton
              className="rounded-lg shadow-none"
              disabled={avatarPending}
              onClick={() => avatarInputRef.current?.click()}
              type="button"
              variant="secondary"
              size="sm"
            >
              {avatarPending ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin"
                  size={18}
                />
              ) : (
                <Camera aria-hidden="true" size={18} />
              )}
              {avatarPending ? "Enviando foto..." : "Adicionar foto"}
            </TESButton>
            <span className="text-xs font-semibold text-tesText-secondary">
              JPG, PNG ou WebP · até 5 MB
            </span>
          </div>

          {avatarFeedback?.tone === "success" ? (
            <FeedbackInline feedback={avatarFeedback} />
          ) : null}
          {avatarFeedback?.tone === "error" ? (
            <TESFeedbackDialog
              message={avatarFeedback.text}
              onClose={onAvatarFeedbackClose}
            />
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-brand-lavender bg-brand-lavenderSoft px-5 py-3 text-sm font-semibold text-tesText-secondary sm:px-6">
        <ShieldCheck
          aria-hidden="true"
          className="shrink-0 text-status-success"
          size={18}
        />
        Seus dados ficam associados somente à sua conta.
      </div>
    </AppPageSection>
  );
}

function PersonalDataSection({
  email,
  fields,
  onChange,
}: {
  email: string;
  fields: PatientAccountEditableFields;
  onChange: (next: Partial<PatientAccountEditableFields>) => void;
}) {
  return (
    <AppPageSection>
      <SectionHeading
        description="Esses são os dados básicos usados para cuidar do seu acesso e facilitar sua comunicação com o TES."
        icon={UserRound}
        title="Dados pessoais"
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <AccountField
          id="patient-name"
          label="Nome completo"
          onChange={(value) => onChange({ name: value })}
          required
          value={fields.name}
        />
        <AccountField
          disabled
          hint="O e-mail é usado para entrar na conta."
          id="patient-email"
          label="E-mail"
          value={email || "E-mail não informado"}
        />
        <PhoneInput
          countryCode={fields.phoneCountryCode ?? "55"}
          id="patient-phone"
          label="Telefone"
          onCountryCodeChange={(value) => onChange({ phoneCountryCode: value })}
          onPhoneChange={(value) => onChange({ phone: value })}
          phone={fields.phone}
        />
      </div>
    </AppPageSection>
  );
}

function AddressSection({
  address,
  onChange,
}: {
  address: PatientAddress;
  onChange: (address: PatientAddress) => void;
}) {
  const latestAddress = useRef(address);
  const lookupCepRef = useRef<string | null>(null);
  const [cepLookup, setCepLookup] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [cepLookupMessage, setCepLookupMessage] = useState<string | null>(null);
  const postalCode = address.postalCode;

  latestAddress.current = address;

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
    const addressAtLookup = latestAddress.current;
    setCepLookup("loading");
    setCepLookupMessage(null);

    void lookupPatientAddressByCep(digits, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "error") {
        setCepLookup("error");
        setCepLookupMessage(result.error.message);
        return;
      }

      const current = latestAddress.current;
      onChange({
        ...current,
        city:
          current.city === addressAtLookup.city
            ? result.data.city || current.city
            : current.city,
        neighborhood:
          current.neighborhood === addressAtLookup.neighborhood
            ? result.data.neighborhood || current.neighborhood
            : current.neighborhood,
        postalCode: result.data.postalCode,
        state:
          current.state === addressAtLookup.state
            ? result.data.state || current.state
            : current.state,
        street:
          current.street === addressAtLookup.street
            ? result.data.street || current.street
            : current.street,
      });
      setCepLookup("idle");
      setCepLookupMessage(
        "Endereço localizado. Confira e edite os campos se necessário.",
      );
    });

    return () => controller.abort();
  }, [onChange, postalCode]);

  function update(key: keyof PatientAddress, value: string) {
    onChange({ ...address, [key]: value });
  }

  return (
    <AppPageSection className="min-w-0">
      <SectionHeading
        description="Se quiser, deixe um endereço salvo para agilizar informações futuras da sua conta."
        icon={MapPin}
        title="Seu endereço"
      />
      <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <AccountField
          autoComplete="postal-code"
          id="patient-postal-code"
          label="CEP"
          onChange={(value) =>
            update("postalCode", formatPatientPostalCode(value))
          }
          placeholder="00000-000"
          value={address.postalCode}
        />
        <div className="flex min-w-0 items-end" aria-live="polite">
          {cepLookup === "loading" ? (
            <p className="pb-1 text-sm font-semibold text-tesText-secondary">
              Consultando o endereço...
            </p>
          ) : cepLookupMessage ? (
            <p className="pb-1 text-sm font-semibold text-tesText-secondary">
              {cepLookupMessage}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
        <AccountField
          autoComplete="address-line1"
          id="patient-street"
          label="Rua ou avenida"
          onChange={(value) => update("street", value)}
          value={address.street}
        />
        <AccountField
          id="patient-street-number"
          label="Número"
          onChange={(value) => update("streetNumber", value)}
          value={address.streetNumber}
        />
      </div>
      <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
        <AccountField
          autoComplete="address-line2"
          id="patient-complement"
          label="Complemento"
          onChange={(value) => update("complement", value)}
          value={address.complement}
        />
        <AccountField
          id="patient-neighborhood"
          label="Bairro"
          onChange={(value) => update("neighborhood", value)}
          value={address.neighborhood}
        />
      </div>
      <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_100px]">
        <AccountField
          autoComplete="address-level2"
          id="patient-city"
          label="Cidade"
          onChange={(value) => update("city", value)}
          value={address.city}
        />
        <AccountField
          autoComplete="address-level1"
          id="patient-state"
          label="UF"
          maxLength={2}
          onChange={(value) => update("state", value.toUpperCase())}
          value={address.state}
        />
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-tesText-secondary">
        <Home
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-brand-primary"
          size={15}
        />
        O preenchimento é opcional. Informe apenas o que fizer sentido para
        você.
      </p>
    </AppPageSection>
  );
}

function SecuritySection() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8 || password !== confirmPassword) {
      setFeedback({
        text: "Use pelo menos 8 caracteres e confirme a nova senha.",
        tone: "error",
      });
      return;
    }

    setPending(true);
    setFeedback(null);
    const result = await changePatientPassword({ confirmPassword, password });
    setPending(false);
    if (result.status === "error") {
      setFeedback({ text: result.error.message, tone: "error" });
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setFeedback({ text: "Sua senha foi alterada.", tone: "success" });
  }

  return (
    <AppPageSection>
      <SectionHeading
        description="Sua sessão atual foi validada. Escolha uma senha nova sempre que sentir que é hora de atualizar seu acesso."
        icon={LockKeyhole}
        title="Segurança"
      />
      <form className="mt-6 grid gap-4" onSubmit={submit}>
        <PasswordField
          id="patient-new-password"
          label="Nova senha"
          onChange={setPassword}
          value={password}
          visible={visible}
          onToggle={() => setVisible((current) => !current)}
        />
        <PasswordField
          id="patient-confirm-password"
          label="Confirmar nova senha"
          onChange={setConfirmPassword}
          value={confirmPassword}
          visible={visible}
          onToggle={() => setVisible((current) => !current)}
        />
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold leading-5 text-tesText-secondary">
            Recomendamos uma senha única para o TES.
          </p>
          <TESButton
            className="rounded-lg"
            disabled={pending}
            type="submit"
            variant="secondary"
          >
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={18} />
            ) : null}
            {pending ? "Alterando..." : "Alterar senha"}
          </TESButton>
        </div>
        {feedback?.tone === "success" ? (
          <FeedbackInline feedback={feedback} />
        ) : null}
        {feedback?.tone === "error" ? (
          <TESFeedbackDialog
            message={feedback.text}
            onClose={() => setFeedback(null)}
          />
        ) : null}
      </form>
    </AppPageSection>
  );
}

function AccountSummary({
  account,
}: {
  account: PatientAccountData["account"];
}) {
  return (
    <AppPageSection className="bg-white">
      <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-primary">
        Sua conta
      </p>
      <h2 className="mt-2 font-display text-[28px] font-light italic leading-tight text-brand-deep">
        Tudo certo por aqui!
      </h2>
      <p className="mt-2 text-sm font-semibold leading-5 text-tesText-secondary">
        Seus dados principais ficam reunidos neste espaço para você revisar com
        calma.
      </p>
      <div className="mt-5 grid gap-3 border-t border-brand-lavender pt-4 text-sm text-brand-deep">
        <div className="flex items-center gap-3">
          <Mail aria-hidden="true" className="text-brand-primary" size={17} />
          <span className="truncate">
            {account.email || "E-mail não informado"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <CheckCircle2
            aria-hidden="true"
            className="text-status-success"
            size={17}
          />
          <span>Acesso de paciente ativo</span>
        </div>
      </div>
    </AppPageSection>
  );
}

function PaymentSummary({ data }: { data: PatientAccountData }) {
  return (
    <AppPageSection>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-primary">
            Pagamentos
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-light italic leading-tight text-brand-deep">
            Seus pagamentos
          </h2>
          <p className="mt-1 text-sm font-semibold leading-5 text-tesText-secondary">
            Um resumo dos pagamentos mais recentes dos seus encontros.
          </p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
          <CreditCard aria-hidden="true" size={19} />
        </span>
      </div>

      {data.payments.length > 0 ? (
        <div className="mt-5 grid gap-4">
          <div className="rounded-md bg-brand-lavenderSoft/55 p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-tesText-secondary">
              Total confirmado
            </p>
            <p className="mt-1 font-display text-3xl font-light italic text-brand-deep">
              {formatCurrency(
                data.paymentSummary.totalPaidCents,
                data.payments[0].currency,
              )}
            </p>
            <p className="mt-1 text-xs font-semibold text-tesText-secondary">
              {data.paymentSummary.count === 1
                ? "1 pagamento confirmado"
                : `${data.paymentSummary.count} pagamentos confirmados`}
            </p>
          </div>
          <div className="grid divide-y divide-border">
            {data.payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-brand-lavender bg-surface-soft p-5">
          <p className="text-sm font-extrabold text-brand-deep">
            Nenhum pagamento ainda
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            Quando você fizer um pagamento, este resumo mostrará o valor e a
            situação do encontro.
          </p>
        </div>
      )}
    </AppPageSection>
  );
}

function PaymentRow({ payment }: { payment: PatientAccountPayment }) {
  const statusClass =
    payment.status === "paid"
      ? "bg-status-successBg text-status-success"
      : payment.status === "processing"
        ? "bg-status-warningBg text-status-warning"
        : payment.status === "refunded"
          ? "bg-status-infoBg text-status-info"
          : "bg-status-dangerBg text-status-danger";

  return (
    <div className="grid gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-brand-deep">
            {payment.title}
          </p>
          <p className="mt-1 text-xs font-semibold text-tesText-secondary">
            {payment.therapistName ? `${payment.therapistName} · ` : ""}
            {formatDate(payment.paidAt)}
          </p>
        </div>
        <p className="shrink-0 text-sm font-extrabold text-brand-deep">
          {formatCurrency(payment.amountCents, payment.currency)}
        </p>
      </div>
      <span
        className={`w-fit rounded-full px-2.5 py-1 text-xs font-extrabold ${statusClass}`}
      >
        {payment.statusLabel}
      </span>
    </div>
  );
}

function SupportCard() {
  return (
    <AppPageSection className="bg-brand-lavenderSoft/35">
      <span className="grid size-11 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <ShieldCheck aria-hidden="true" size={21} />
      </span>
      <h2 className="mt-4 font-display text-2xl font-light italic text-brand-deep">
        Precisa de ajuda?
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
        Fale com o suporte do TES se quiser revisar algum dado ou acesso.
      </p>
      <TESButton
        className="mt-5 w-full rounded-lg"
        href={`${routes.patient.messages}?context=suporte`}
        size="sm"
        variant="secondary"
      >
        Abrir mensagens
        <ArrowUpRight aria-hidden="true" size={17} />
      </TESButton>
    </AppPageSection>
  );
}

function SectionHeading({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={17} />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-light italic leading-tight text-brand-deep">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary">
          {description}
        </p>
      </div>
    </div>
  );
}

function AccountField({
  autoComplete,
  disabled,
  hint,
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
  hint?: string;
  id: string;
  label: string;
  maxLength?: number;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label
      className="grid min-w-0 gap-2 text-sm font-extrabold text-brand-deep"
      htmlFor={id}
    >
      <span>{label}</span>
      <input
        className="min-h-12 w-full min-w-0 rounded-md border border-border bg-white px-4 text-base font-semibold text-brand-deep outline-none transition placeholder:text-tesText-subtle focus:border-brand-primary focus:ring-4 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-tesText-secondary"
        autoComplete={autoComplete}
        disabled={disabled}
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
      {hint ? (
        <span className="text-xs font-semibold text-tesText-secondary">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function PasswordField({
  id,
  label,
  onChange,
  onToggle,
  value,
  visible,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  value: string;
  visible: boolean;
}) {
  return (
    <label
      className="grid gap-2 text-sm font-extrabold text-brand-deep"
      htmlFor={id}
    >
      <span>{label}</span>
      <span className="flex min-h-12 items-center rounded-md border border-border bg-white px-4 transition focus-within:border-brand-primary focus-within:ring-4 focus-within:ring-ring/20">
        <input
          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-brand-deep outline-none placeholder:text-tesText-subtle"
          id={id}
          minLength={8}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? "text" : "password"}
          value={value}
        />
        <PasswordVisibilityToggle isVisible={visible} onToggle={onToggle} />
      </span>
    </label>
  );
}

function FeedbackBanner({ feedback }: { feedback: Exclude<Feedback, null> }) {
  return (
    <div
      className={
        feedback.tone === "success"
          ? "rounded-card border border-status-success/30 bg-status-successBg p-4 text-sm font-bold leading-6 text-status-success"
          : "rounded-card border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-bold leading-6 text-status-danger"
      }
      role={feedback.tone === "error" ? "alert" : "status"}
    >
      {feedback.text}
    </div>
  );
}

function FeedbackInline({ feedback }: { feedback: Exclude<Feedback, null> }) {
  return (
    <p
      className={
        feedback.tone === "success"
          ? "text-sm font-extrabold leading-6 text-status-success"
          : "text-sm font-extrabold leading-6 text-status-danger"
      }
      role={feedback.tone === "error" ? "alert" : "status"}
    >
      {feedback.text}
    </p>
  );
}

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amountCents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return initials.toUpperCase() || "P";
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? "";
}
