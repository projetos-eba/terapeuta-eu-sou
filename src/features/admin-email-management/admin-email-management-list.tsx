"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Mail,
  Send,
  Settings2,
} from "lucide-react";

import {
  AppPageContainer,
  AppPageHeader,
  AppPageSection,
} from "@/components/app-page";
import { routes } from "@/lib/routes";

type ProviderKey = "hostinger_mail_api";

type Sender = {
  active: boolean;
  display_name: string;
  id: string;
  is_default: boolean;
  last_test_at?: string | null;
  last_test_status?: "error" | "skipped" | "success" | null;
  mailbox_address: string;
  provider: ProviderKey;
};

type Action = {
  actionKey: string;
  category: string;
  description: string;
  label: string;
  supportsAutomaticDispatch: boolean;
  setting: {
    automatic_dispatch_enabled: boolean;
    enabled: boolean;
    sender_profile_id: string | null;
  } | null;
};

type DeliveryLog = {
  action_key: string;
  attempt_count: number;
  correlation_id: string;
  created_at: string;
  email_sender_profiles: { provider: ProviderKey } | null;
  error_message: string | null;
  recipient_email: string;
  status: "error" | "skipped" | "success";
};

type Result = {
  actions: Action[];
  logs: DeliveryLog[];
  senders: Sender[];
};

export function AdminEmailManagementList() {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/admin/emails", {
          body: JSON.stringify({ action: "list" }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const result = await response.json();
        if (!active) return;
        if (!response.ok || !result.ok) {
          setError(
            result.error?.message ??
              "Não foi possível carregar as configurações de e-mail.",
          );
          return;
        }
        setData(result.data);
      } catch {
        if (active) {
          setError("Não foi possível carregar as configurações de e-mail.");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (error) return <LoadError message={error} />;
  if (!data) return <LoadingState />;

  return <EmailManagementContent data={data} />;
}

function EmailManagementContent({ data }: { data: Result }) {
  const actionsByCategory = useMemo(() => {
    return data.actions.reduce<Map<string, Action[]>>((groups, action) => {
      groups.set(action.category, [
        ...(groups.get(action.category) ?? []),
        action,
      ]);
      return groups;
    }, new Map());
  }, [data.actions]);
  const defaultSender = data.senders.find(
    (sender) => sender.active && sender.is_default,
  );

  return (
    <AppPageContainer className="max-w-[1166px] py-5 lg:py-6">
      <AppPageHeader eyebrow="Configurações" title="E-mails">
        Configure remetentes, eventos transacionais, templates e acompanhe os
        envios da plataforma.
      </AppPageHeader>

      <AppPageSection aria-labelledby="email-senders-heading">
        <SectionHeading
          description="O envio é operado pela infraestrutura segura da plataforma. Credenciais privadas não ficam disponíveis nesta área."
          icon={Send}
          title="Remetente da plataforma"
        />

        {defaultSender ? (
          <div className="mt-5 grid gap-4 rounded-[22px] border border-brand-lavender/60 bg-surface-soft p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className="text-base font-extrabold text-brand-deep"
                  id="email-senders-heading"
                >
                  {defaultSender.display_name}
                </h2>
                <StatusPill tone="success">Remetente padrão</StatusPill>
              </div>
              <p className="mt-2 break-all text-sm font-semibold text-tesText-secondary">
                {defaultSender.mailbox_address}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-tesText-muted">
                {providerLabel(defaultSender.provider)} ·{" "}
                {lastTestLabel(defaultSender)}
              </p>
            </div>
            <StatusPill tone="success">Configuração disponível</StatusPill>
          </div>
        ) : (
          <div className="mt-5 flex gap-3 rounded-[22px] border border-status-warning/30 bg-status-warningBg p-4 text-sm font-semibold leading-6 text-tesText-secondary">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-status-warning"
            />
            <p>
              Nenhum remetente ativo está disponível. Os eventos continuam
              protegidos, mas não poderão ser enviados até a configuração ser
              sincronizada com o provider.
            </p>
          </div>
        )}

        {data.senders.filter((sender) => sender.active && !sender.is_default)
          .length ? (
          <p className="mt-4 text-sm font-semibold leading-6 text-tesText-secondary">
            Outros remetentes ativos podem ser selecionados nos eventos que já
            possuem essa capacidade configurada.
          </p>
        ) : null}
      </AppPageSection>

      <AppPageSection aria-labelledby="email-events-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-[16px] bg-brand-lavenderSoft text-brand-primary">
                <Mail aria-hidden="true" className="size-5" />
              </span>
              <h2
                className="text-2xl font-extrabold text-brand-deep"
                id="email-events-heading"
              >
                Eventos de e-mail
              </h2>
            </div>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
              Cada evento usa destinatários definidos pelo domínio do TES e
              apenas os conteúdos e tokens permitidos para aquele fluxo.
            </p>
          </div>
          <StatusPill tone="neutral">{data.actions.length} eventos</StatusPill>
        </div>

        {data.actions.length ? (
          <div className="mt-7 space-y-8">
            {[...actionsByCategory.entries()].map(([category, actions]) => (
              <section
                aria-labelledby={`category-${slugify(category)}`}
                key={category}
              >
                <div className="mb-4 flex items-baseline gap-3">
                  <h3
                    className="text-sm font-extrabold uppercase tracking-[0.12em] text-brand-deep"
                    id={`category-${slugify(category)}`}
                  >
                    {category}
                  </h3>
                  <span className="text-sm font-semibold text-tesText-muted">
                    {actions.length}{" "}
                    {actions.length === 1 ? "evento" : "eventos"}
                  </span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {actions.map((action) => (
                    <EventCard
                      action={action}
                      defaultSender={defaultSender}
                      key={action.actionKey}
                      senders={data.senders}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyEvents />
        )}
      </AppPageSection>

      <AppPageSection aria-labelledby="email-history-heading">
        <SectionHeading
          description="Os dados exibidos são reduzidos ao necessário para acompanhamento. Reenvios seguem a recuperação controlada da outbox; não há disparo manual por esta tela."
          icon={Clock3}
          title="Envios recentes"
        />
        <div className="mt-5 space-y-3">
          {data.logs.length ? (
            data.logs
              .slice(0, 8)
              .map((log, index) => (
                <DeliveryLogRow
                  actionLabel={
                    data.actions.find(
                      (action) => action.actionKey === log.action_key,
                    )?.label ?? "Evento transacional"
                  }
                  key={`${log.correlation_id}-${index}`}
                  log={log}
                />
              ))
          ) : (
            <p className="rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 text-sm font-semibold leading-6 text-tesText-secondary">
              Ainda não há envios para mostrar nesta visualização.
            </p>
          )}
        </div>
      </AppPageSection>
    </AppPageContainer>
  );
}

function EventCard({
  action,
  defaultSender,
  senders,
}: {
  action: Action;
  defaultSender: Sender | undefined;
  senders: Sender[];
}) {
  const isEnabled = action.setting?.enabled !== false;
  const isAutomatic =
    action.supportsAutomaticDispatch &&
    action.setting?.automatic_dispatch_enabled !== false;
  const sender = action.setting?.sender_profile_id
    ? (senders.find((item) => item.id === action.setting?.sender_profile_id)
        ?.display_name ?? "Remetente pendente")
    : defaultSender
      ? defaultSender.display_name
      : "Remetente pendente";

  return (
    <article className="flex min-h-full flex-col rounded-[22px] border border-brand-lavender/70 bg-surface-soft p-5 transition hover:border-brand-primary/35 hover:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="text-base font-extrabold text-brand-deep">
          {action.label}
        </h4>
        <StatusPill tone={isEnabled ? "success" : "warning"}>
          {isEnabled ? "Habilitado" : "Desabilitado"}
        </StatusPill>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-tesText-secondary">
        {action.description}
      </p>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-tesText-muted">
        <span>{isAutomatic ? "Envio automático" : "Somente envio manual"}</span>
        <span>{sender}</span>
      </div>
      <Link
        className="mt-6 inline-flex min-h-11 items-center gap-2 self-start rounded-full px-1 text-sm font-extrabold text-brand-primary outline-none transition hover:text-brand-primaryHover focus-visible:ring-4 focus-visible:ring-ring/20"
        href={routes.admin.emailEvent(action.actionKey)}
      >
        Configurar evento
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}

function DeliveryLogRow({
  actionLabel,
  log,
}: {
  actionLabel: string;
  log: DeliveryLog;
}) {
  const tone =
    log.status === "success"
      ? "success"
      : log.status === "error"
        ? "warning"
        : "neutral";
  const label = log.status === "success" ? "Enviado" : "Não enviado";

  return (
    <article className="grid gap-3 rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-extrabold text-brand-deep">
            {actionLabel}
          </p>
          <StatusPill tone={tone}>{label}</StatusPill>
        </div>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {log.recipient_email} · {formatDateTime(log.created_at)} · tentativa{" "}
          {log.attempt_count}
        </p>
        {log.error_message ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-status-danger">
            {log.error_message}
          </p>
        ) : null}
      </div>
      <p className="text-xs font-bold text-tesText-muted md:text-right">
        {providerLabel(
          log.email_sender_profiles?.provider ?? "hostinger_mail_api",
        )}
        <br />
        Referência {log.correlation_id}
      </p>
    </article>
  );
}

function LoadingState() {
  return (
    <AppPageContainer className="max-w-[1166px] py-5 lg:py-6" aria-busy="true">
      <AppPageHeader eyebrow="Configurações" title="E-mails">
        Carregando as configurações de envio da plataforma.
      </AppPageHeader>
      <div className="grid gap-5" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div
            className="h-44 animate-pulse rounded-card border border-brand-lavender/60 bg-surface-soft"
            key={item}
          />
        ))}
      </div>
    </AppPageContainer>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <AppPageContainer className="max-w-[1166px] py-5 lg:py-6">
      <AppPageHeader eyebrow="Configurações" title="E-mails">
        A central de e-mails não pôde ser carregada agora.
      </AppPageHeader>
      <AppPageSection>
        <div className="flex gap-3 rounded-[20px] border border-status-danger/30 bg-status-dangerBg p-4 text-sm font-semibold leading-6 text-tesText-secondary">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-status-danger"
          />
          <p>{message}</p>
        </div>
      </AppPageSection>
    </AppPageContainer>
  );
}

function EmptyEvents() {
  return (
    <div className="mt-6 rounded-[20px] border border-brand-lavender/60 bg-surface-soft p-5 text-sm font-semibold leading-6 text-tesText-secondary">
      Não há eventos disponíveis para configuração neste momento.
    </div>
  );
}

function SectionHeading({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: typeof Settings2;
  title: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div>
        <h2 className="text-2xl font-extrabold text-brand-deep">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {description}
        </p>
      </div>
    </div>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "success" | "warning";
}) {
  const classes = {
    neutral: "border-brand-lavender/60 bg-white text-tesText-secondary",
    success: "border-status-success/25 bg-status-successBg text-status-success",
    warning: "border-status-warning/30 bg-status-warningBg text-status-warning",
  }[tone];

  return (
    <span
      className={`inline-flex min-h-7 w-fit items-center rounded-full border px-3 py-1 text-xs font-extrabold ${classes}`}
    >
      {children}
    </span>
  );
}

function providerLabel(provider: ProviderKey) {
  return provider === "hostinger_mail_api"
    ? "Hostinger Mail"
    : "Provider configurado";
}

function lastTestLabel(sender: Sender) {
  if (!sender.last_test_at) return "Nenhum teste registrado";
  if (sender.last_test_status === "success") {
    return `Teste concluído em ${formatDateTime(sender.last_test_at)}`;
  }
  return `Último teste requer atenção · ${formatDateTime(sender.last_test_at)}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
