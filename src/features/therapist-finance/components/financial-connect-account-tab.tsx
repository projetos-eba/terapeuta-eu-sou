import { AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react";

import { AppPageSection } from "@/components/app-page";

import type { TherapistConnectAccount } from "../therapist-finance.types";
import { formatDateTime } from "./financial-formatters";
import { FinancialConnectAccountActions } from "./financial-connect-account-actions";

export function FinancialConnectAccountTab({
  account,
}: {
  account: TherapistConnectAccount;
}) {
  const state = getConnectState(account);
  const Icon =
    state.tone === "ready"
      ? ShieldCheck
      : state.tone === "danger"
        ? AlertTriangle
        : Info;

  return (
    <div className="grid gap-5">
      <AppPageSection className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <span
            className={`grid size-12 place-items-center rounded-full ${state.iconClass}`}
          >
            <Icon aria-hidden="true" size={23} />
          </span>
          <h2 className="mt-4 text-2xl font-extrabold text-brand-deep">
            {state.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base">
            {state.description}
          </p>
          <p className="mt-4 rounded-lg bg-brand-lavenderSoft/70 p-4 text-sm font-semibold leading-6 text-tesText-secondary">
            Você será levado a uma página segura para informar seus dados de
            recebimento. O TES não guarda seus dados bancários completos.
          </p>
        </div>

        <div className="rounded-card border border-brand-lavender bg-surface-soft p-4">
          <h3 className="text-base font-extrabold text-brand-deep">
            Como está sua conta
          </h3>
          <dl className="mt-4 grid gap-3">
            <ConnectDetail
              label="Conta"
              value={account.maskedAccountId ?? "Ainda não conectada"}
            />
            <ConnectDetail label="Cadastro" value={state.statusLabel} />
            <ConnectDetail
              label="Transferências"
              value={translateCapability(account.transferCapabilityStatus)}
            />
            <ConnectDetail
              label="Última atualização"
              value={formatDateTime(account.lastSyncedAt)}
            />
          </dl>
        </div>
      </AppPageSection>

      <AppPageSection className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div>
          <h2 className="text-xl font-extrabold text-brand-deep">
            Próxima ação
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
            O cadastro, a análise e a liberação dos recebimentos acontecem nessa
            página segura.
          </p>
          <div className="mt-5">
            <FinancialConnectAccountActions
              primaryAction={state.primaryAction}
              primaryLabel={state.primaryLabel}
              showSync={account.accountExists}
            />
          </div>
        </div>

        <div className="rounded-card border border-brand-lavender bg-white p-4">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-brand-deep">
            <CheckCircle2
              aria-hidden="true"
              className="text-status-success"
              size={19}
            />
            Para sua segurança
          </h3>
          <ul className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-tesText-secondary">
            <li>
              Os dados bancários completos ficam somente na página segura.
            </li>
            <li>
              Voltar para esta página não significa que o cadastro terminou.
            </li>
            <li>
              Use Verificar situação para conferir a informação mais recente.
            </li>
          </ul>
        </div>
      </AppPageSection>

      {state.notice ? (
        <AppPageSection className="border-status-warning/40 bg-status-warningBg">
          <p className="text-sm font-bold leading-6 text-brand-deep">
            {state.notice}
          </p>
        </AppPageSection>
      ) : null}
    </div>
  );
}

function ConnectDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-lavender pb-3 last:border-b-0 last:pb-0">
      <dt className="text-sm font-bold text-tesText-secondary">{label}</dt>
      <dd className="max-w-[190px] text-right text-sm font-extrabold text-brand-deep">
        {value}
      </dd>
    </div>
  );
}

function getConnectState(account: TherapistConnectAccount) {
  if (!account.accountExists) {
    return {
      description:
        "Informe seus dados em uma página segura para receber os valores das suas sessões.",
      iconClass: "bg-brand-lavenderSoft text-brand-primary",
      notice: null,
      primaryAction: "create_or_continue" as const,
      primaryLabel: "Conectar conta de recebimento",
      statusLabel: "Ainda não conectada",
      title: "Conecte sua conta de recebimento",
      tone: "neutral" as const,
    };
  }

  if (account.onboardingStatus === "ready") {
    return {
      description:
        "Sua conta está pronta para receber seus valores quando houver repasses.",
      iconClass: "bg-status-successBg text-status-success",
      notice: null,
      primaryAction: "login" as const,
      primaryLabel: "Gerenciar conta de recebimento",
      statusLabel: "Conta pronta para receber",
      title: "Conta pronta para receber",
      tone: "ready" as const,
    };
  }

  if (account.onboardingStatus === "requirements_due") {
    return {
      description:
        "Precisamos de mais algumas informações para concluir a análise da sua conta.",
      iconClass: "bg-status-warningBg text-status-warning",
      notice: requirementNotice(account.currentlyDue.length),
      primaryAction: "create_or_continue" as const,
      primaryLabel: "Atualizar dados de recebimento",
      statusLabel: "Faltam algumas informações",
      title: "Atualize seus dados de recebimento",
      tone: "warning" as const,
    };
  }

  if (
    account.pendingVerification.length > 0 ||
    account.transferCapabilityStatus === "pending"
  ) {
    return {
      description:
        "Recebemos suas informações e estamos analisando. Você pode verificar a situação para consultar novidades.",
      iconClass: "bg-brand-lavenderSoft text-brand-primary",
      notice: "Informações em análise.",
      primaryAction: "create_or_continue" as const,
      primaryLabel: "Atualizar dados de recebimento",
      statusLabel: "Informações em análise",
      title: "Informações em análise",
      tone: "neutral" as const,
    };
  }

  if (
    account.onboardingStatus === "restricted" ||
    account.onboardingStatus === "disabled"
  ) {
    return {
      description:
        "A conta está temporariamente impedida de receber repasses. Revise as informações solicitadas na página segura.",
      iconClass: "bg-status-dangerBg text-status-danger",
      notice: translateDisabledReason(account.disabledReason),
      primaryAction: "create_or_continue" as const,
      primaryLabel: "Atualizar dados de recebimento",
      statusLabel: "Conta restrita",
      title: "Conta restrita",
      tone: "danger" as const,
    };
  }

  return {
    description:
      "Continue o cadastro na página segura para liberar os recebimentos das suas sessões.",
    iconClass: "bg-brand-lavenderSoft text-brand-primary",
    notice: null,
    primaryAction: "create_or_continue" as const,
    primaryLabel: "Continuar cadastro",
    statusLabel: "Cadastro incompleto",
    title: "Continue o cadastro da conta",
    tone: "neutral" as const,
  };
}

function requirementNotice(count: number) {
  if (count <= 0) {
    return "Abra a página segura para conferir se falta alguma informação.";
  }

  return `${count} informação(ões) pendente(s). Abra a página segura para revisar.`;
}

function translateCapability(value: string) {
  const labels: Record<string, string> = {
    active: "Ativas",
    inactive: "Inativas",
    pending: "Em análise",
    restricted: "Restritas",
  };

  return labels[value] ?? "Ainda não informado";
}

function translateDisabledReason(value: string | null) {
  if (!value)
    return "A conta foi restringida. Abra a página segura para revisar.";

  const labels: Record<string, string> = {
    account_closed: "A conta foi encerrada.",
    requirements_past_due:
      "Há informações obrigatórias que precisam ser atualizadas.",
  };

  return (
    labels[value] ??
    "A conta foi restringida. Abra a página segura para revisar."
  );
}
