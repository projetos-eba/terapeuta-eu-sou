import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  BellDot,
  Headphones,
  MessageSquareDot,
  ShieldCheck,
} from "lucide-react";

import { TESDecorativeMedia } from "@/components/tes";
import { TherapistSupportSection } from "@/features/support/components/therapist-support-section";
import { MessageCenterLiveRefresh } from "@/features/support/components/support-live-refresh";
import { platformAssets } from "@/lib/platform-assets";

import { MessageCenterActions } from "./components/message-center-actions";
import { MarkNotificationsReadButton } from "./components/mark-notifications-read-button";
import { MessageThreadDialogButton } from "./components/message-thread-dialog";
import { PlatformNotificationDialogButton } from "./components/platform-notification-dialog";
import type {
  MessageCenterCategory,
  MessageCenterPageData,
  MessageCenterPlatformItem,
  MessageCenterThread,
} from "./message-center.types";

export function MessageCenterPage({ data }: { data: MessageCenterPageData }) {
  const heroAsset =
    data.actorRole === "patient"
      ? platformAssets.patientMessagesHero
      : platformAssets.therapistMessagesHero;

  return (
    <main className="mx-auto grid w-full max-w-[1210px] gap-5 pb-10 text-tesText-primary">
      <MessageCenterLiveRefresh
        actorRole={data.actorRole}
        enabled={data.source === "supabase"}
      />
      <section className="relative isolate overflow-hidden rounded-card bg-white">
        <div className="grid min-h-[230px] lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)]">
          <div className="relative z-10 px-6 py-8 sm:px-8 lg:py-10">
            <h1 className="font-display text-4xl font-light italic leading-tight text-brand-deep sm:text-5xl">
              {data.hero.title}
            </h1>
            <p className="mt-3 max-w-xl text-base font-semibold leading-7 text-tesText-secondary">
              {data.hero.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <MetricPill
                icon={<MessageSquareDot aria-hidden="true" size={15} />}
                label="Mensagens não lidas"
                tone="danger"
                value={data.metrics.unreadMessagesCount}
              />
              <MetricPill
                icon={<BellDot aria-hidden="true" size={15} />}
                label="Chamados abertos"
                tone="warning"
                value={data.metrics.openSupportTicketsCount}
              />
            </div>
          </div>
          <div className="relative hidden min-h-[230px] overflow-hidden lg:block">
            <TESDecorativeMedia
              className="absolute inset-0"
              fade="left"
              objectPosition="right center"
              priority
              sizes="480px"
              src={heroAsset.src}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <MessageCard
          action={
            <MessageCenterActions
              actorRole={data.actorRole}
              source={data.source}
              templates={data.templates.participant}
              threads={data.threads}
              variant="participant"
            />
          }
          description={data.participantSection.description}
          emptyLabel="Nenhuma comunicação de sessão por enquanto."
          items={data.threads}
          title={data.participantSection.title}
          actorRole={data.actorRole}
        />

        {data.actorRole === "therapist" ? (
          <TherapistSupportSection
            actorRole={data.actorRole}
            tickets={data.supportTickets}
          />
        ) : (
          <PlatformCard
            action={
              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
                <MarkNotificationsReadButton
                  actorRole={data.actorRole}
                  unreadCount={
                    data.platformItems.filter(
                      (item) => item.isNotification && item.isUnread,
                    ).length
                  }
                />
                <MessageCenterActions
                  actorRole={data.actorRole}
                  source={data.source}
                  templates={data.templates.support}
                  threads={data.threads}
                  variant="support"
                />
              </div>
            }
            description={data.platformSection.description}
            items={data.platformItems}
            title={data.platformSection.title}
          />
        )}
      </section>

      <section className="rounded-card border border-brand-lavender bg-white p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-brand-deep">
              Comunicação protegida pelo TES
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary">
              Esta central não possui chat livre. As interações entre cliente e
              terapeuta usam modelos pré-aprovados. Já o suporte TES acontece em
              chamados próprios, com texto livre protegido e rastreável.
            </p>
          </div>
          <span className="inline-flex min-h-9 w-fit items-center gap-2 rounded-full bg-brand-lavenderSoft px-4 text-xs font-extrabold text-brand-primary">
            <ShieldCheck aria-hidden="true" size={15} />
            Mensagens com pacientes protegidas
          </span>
        </div>
      </section>
    </main>
  );
}

function MessageCard({
  actorRole,
  action,
  description,
  emptyLabel,
  items,
  title,
}: {
  actorRole: MessageCenterPageData["actorRole"];
  action: ReactNode;
  description: string;
  emptyLabel: string;
  items: MessageCenterThread[];
  title: string;
}) {
  return (
    <section className="rounded-card border border-brand-lavender bg-white shadow-card">
      <CardHeader action={action} description={description} title={title} />
      <div className="divide-y divide-brand-lavender/70">
        {items.length > 0 ? (
          items.map((item) => (
            <ThreadRow actorRole={actorRole} item={item} key={item.id} />
          ))
        ) : (
          <EmptyRow label={emptyLabel} />
        )}
      </div>
    </section>
  );
}

function PlatformCard({
  action,
  description,
  items,
  title,
}: {
  action: ReactNode;
  description: string;
  items: MessageCenterPlatformItem[];
  title: string;
}) {
  return (
    <section className="rounded-card border border-brand-lavender bg-white shadow-card">
      <CardHeader action={action} description={description} title={title} />
      <div className="divide-y divide-brand-lavender/70">
        {items.length > 0 ? (
          items.map((item) => <PlatformRow item={item} key={item.id} />)
        ) : (
          <EmptyRow label="Nenhum aviso da plataforma por enquanto." />
        )}
      </div>
    </section>
  );
}

function CardHeader({
  action,
  description,
  title,
}: {
  action: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-brand-lavender/70 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-display text-2xl font-light italic text-brand-deep">
          {title}
        </h2>
        <p className="mt-1 max-w-md text-xs font-semibold leading-5 text-tesText-secondary">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}

function ThreadRow({
  actorRole,
  item,
}: {
  actorRole: MessageCenterPageData["actorRole"];
  item: MessageCenterThread;
}) {
  return (
    <article className="grid min-h-[86px] grid-cols-[52px_minmax(0,1fr)] gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[52px_minmax(0,1fr)_auto]">
      <Avatar name={item.name} src={item.avatarUrl} />
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-tesText-secondary">
          {item.name}
        </p>
        <h3 className="mt-1 min-w-0 truncate">
          <MessageThreadDialogButton
            actorRole={actorRole}
            thread={item}
            trigger="title"
          />
        </h3>
        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-tesText-secondary">
          {item.body}
        </p>
        {item.sessionContext ? (
          <p className="mt-1 text-xs font-bold text-brand-primary">
            {item.sessionContext}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CategoryBadge category={item.category} label={item.categoryLabel} />
          {item.isUnread ? <UnreadDot /> : null}
        </div>
        {item.cta && item.cta.action !== "view_session" ? (
          <div className="mt-3">
            <Link
              className="inline-flex min-h-10 items-center text-xs font-extrabold text-brand-primary underline-offset-2 hover:underline"
              href={item.cta.href}
            >
              {item.cta.label}
            </Link>
          </div>
        ) : null}
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-3 sm:col-start-3 sm:row-start-1 sm:row-span-2 sm:flex-col sm:items-end sm:justify-start">
        <p className="text-xs font-semibold text-tesText-secondary sm:text-right">
          {item.timeLabel}
        </p>
        <MessageThreadDialogButton actorRole={actorRole} thread={item} />
      </div>
    </article>
  );
}

function PlatformRow({ item }: { item: MessageCenterPlatformItem }) {
  return (
    <article className="grid min-h-[78px] grid-cols-[52px_minmax(0,1fr)] gap-4 px-5 py-4 sm:grid-cols-[52px_minmax(0,1fr)_88px]">
      <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Headphones aria-hidden="true" size={22} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-tesText-secondary">
          {item.categoryLabel}
        </p>
        <h3 className="mt-1 min-w-0 truncate">
          <PlatformNotificationDialogButton item={item} />
        </h3>
        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-tesText-secondary">
          {item.body}
        </p>
        {item.cta ? (
          <Link
            className="mt-2 inline-flex min-h-10 items-center text-xs font-extrabold text-brand-primary underline-offset-2 hover:underline"
            href={item.cta.href}
          >
            {item.cta.label}
          </Link>
        ) : null}
      </div>
      <p className="col-start-2 flex items-center gap-2 text-xs font-semibold text-tesText-secondary sm:col-start-auto sm:justify-end sm:text-right">
        {item.isUnread ? <UnreadDot /> : null}
        {item.timeLabel}
      </p>
    </article>
  );
}

function MetricPill({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  tone: "danger" | "warning";
  value: number;
}) {
  const toneClass =
    tone === "danger"
      ? "bg-status-dangerBg text-status-danger"
      : "bg-status-warningBg text-status-warning";

  return (
    <span
      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-extrabold ${toneClass}`}
    >
      {icon}
      {label}
      <strong>{value}</strong>
    </span>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      <Image
        alt=""
        className="size-12 rounded-full object-cover"
        height={48}
        src={src}
        width={48}
      />
    );
  }

  return (
    <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-sm font-extrabold text-brand-primary">
      {name.trim().slice(0, 1).toLocaleUpperCase("pt-BR")}
    </span>
  );
}

function CategoryBadge({
  category,
  label,
}: {
  category: MessageCenterCategory;
  label: string;
}) {
  const tones: Record<MessageCenterCategory, string> = {
    acompanhamento: "bg-status-infoBg text-status-info",
    atendimento: "bg-brand-lavenderSoft text-brand-primary",
    atualizacao: "bg-status-dangerBg text-status-danger",
    confirmacao: "bg-status-successBg text-status-success",
    duvida: "bg-brand-lavenderSoft text-brand-primary",
    feedback: "bg-status-successBg text-status-success",
    financeiro: "bg-status-successBg text-status-success",
    plataforma: "bg-brand-lavenderSoft text-brand-primary",
    reagendamento: "bg-status-warningBg text-status-warning",
    suporte: "bg-brand-lavenderSoft text-brand-primary",
  };

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full px-3 text-[11px] font-extrabold ${tones[category]}`}
    >
      {label}
    </span>
  );
}

function UnreadDot() {
  return (
    <span
      aria-label="Não lida"
      className="inline-block size-2.5 rounded-full bg-brand-primary"
    />
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="px-5 py-10 text-center text-sm font-semibold text-tesText-secondary">
      {label}
    </div>
  );
}
