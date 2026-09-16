"use client";

import { BellDot, Headphones } from "lucide-react";

import { TESDecorativeMedia } from "@/components/tes";
import { SupportTicketSection } from "@/features/support/components/therapist-support-section";
import { MessageCenterLiveRefresh } from "@/features/support/components/support-live-refresh";
import { platformAssets } from "@/lib/platform-assets";

import { MarkNotificationsReadButton } from "./components/mark-notifications-read-button";
import { PlatformNotificationDialogButton } from "./components/platform-notification-dialog";
import type {
  MessageCenterPageData,
  MessageCenterPlatformItem,
} from "./message-center.types";

export function MessageCenterPage({ data }: { data: MessageCenterPageData }) {
  const heroAsset =
    data.actorRole === "patient"
      ? platformAssets.patientMessagesHero
      : platformAssets.therapistMessagesHero;
  const unreadPlatformItems = data.platformItems.filter(
    (item) => item.isNotification && item.isUnread,
  ).length;

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
              <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-status-warningBg px-4 text-sm font-bold text-status-warning">
                <Headphones aria-hidden="true" size={15} />
                Chamados abertos {data.metrics.openSupportTicketsCount}
              </span>
              {unreadPlatformItems > 0 ? (
                <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-brand-lavenderSoft px-4 text-sm font-bold text-brand-primary">
                  <BellDot aria-hidden="true" size={15} />
                  Avisos novos {unreadPlatformItems}
                </span>
              ) : null}
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

      <SupportTicketSection
        actorRole={data.actorRole}
        pagination={data.supportPagination}
        tickets={data.supportTickets}
      />

      {data.platformItems.length > 0 ? (
        <section className="rounded-card border border-brand-lavender bg-white shadow-card">
          <header className="flex flex-col gap-3 border-b border-brand-lavender/70 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-light italic text-brand-deep">
                Avisos TES
              </h2>
              <p className="mt-1 max-w-md text-sm font-semibold leading-6 text-tesText-secondary">
                Atualizações da plataforma sobre sua conta e suas sessões.
              </p>
            </div>
            <MarkNotificationsReadButton
              actorRole={data.actorRole}
              unreadCount={unreadPlatformItems}
            />
          </header>
          <div className="divide-y divide-brand-lavender/70">
            {data.platformItems.map((item) => (
              <PlatformRow item={item} key={item.id} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function PlatformRow({ item }: { item: MessageCenterPlatformItem }) {
  return (
    <article className="grid min-h-[78px] grid-cols-[48px_minmax(0,1fr)_auto] gap-4 px-5 py-4">
      <span className="grid size-12 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <BellDot aria-hidden="true" size={21} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-extrabold text-brand-deep">
            {item.title}
          </h3>
          {item.isUnread ? (
            <span
              aria-label="Aviso não lido"
              className="size-2 rounded-full bg-brand-primary"
            />
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-tesText-secondary">
          {item.body}
        </p>
        <p className="mt-1 text-xs font-semibold text-tesText-secondary">
          {item.timeLabel}
        </p>
      </div>
      <PlatformNotificationDialogButton item={item} />
    </article>
  );
}
