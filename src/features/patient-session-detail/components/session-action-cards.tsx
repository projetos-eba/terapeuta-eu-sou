import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { Download, MoreHorizontal, ReceiptText } from "lucide-react";

import { SessionOperationActions } from "@/features/session-actions/session-operation-actions";
import { routes } from "@/lib/routes";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function SessionActionCards({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  const { cancellation, reschedule } = data.actionPolicy;
  const hasReceipt = Boolean(data.receipt.receiptUrl);

  return (
    <section className="grid gap-6 border-t border-border pt-8">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-primary sm:text-xs">
          Ajustes e comprovantes
        </p>
        <h2 className="mt-3 font-display text-[2rem] font-light italic leading-none text-brand-deep sm:text-[2.3rem]">
          Gerencie este encontro
        </h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
          Cancelamento e reagendamento seguem a disponibilidade da agenda, a
          política vigente e a confirmação financeira da plataforma.
        </p>
      </div>

      <SessionOperationActions
        actorRole="patient"
        bookingId={data.booking.id}
        bookingVersion={data.booking.operationalVersion}
        canCancel={cancellation.allowed}
        canRequestReschedule={reschedule.allowed}
        cancellationImpactLabel={cancellation.impactLabel}
        cancelDisabledReason={cancellation.disabledReason}
        rescheduleDisabledReason={reschedule.disabledReason}
        reschedule={data.reschedule}
      />

      <section className="rounded-[28px] border border-border bg-white/80 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <ReceiptText aria-hidden="true" size={18} />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-brand-deep sm:text-lg">
              {hasReceipt ? "Comprovante e política" : cancellation.title}
            </h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary sm:text-base sm:leading-7">
              {hasReceipt
                ? "Baixe seu comprovante quando disponível e confira os impactos autorizados para reagendar ou cancelar este encontro."
                : cancellation.impactLabel}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-label="Ações complementares do encontro"
        className="grid gap-4"
      >
        {data.receipt.receiptUrl ? (
          <ActionLink
            description="Baixe o comprovante quando ele estiver disponível para este encontro."
            href={data.receipt.receiptUrl}
            icon={Download}
            title="Baixar comprovante"
          />
        ) : (
          <ActionButton
            description="O comprovante ainda não está disponível neste fluxo."
            icon={Download}
            title="Baixar comprovante"
          />
        )}
        <ActionLink
          description="Peça ajuda ou acesse outras orientações seguras para este encontro."
          href={
            `${routes.patient.messages}?context=suporte&booking=${data.booking.id}` as Route<string>
          }
          icon={MoreHorizontal}
          title="Mais opções"
        />
      </section>
    </section>
  );
}

function ActionLink({
  description,
  href,
  icon: Icon,
  title,
}: {
  description: string;
  href: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <Link
      className="flex min-h-16 items-center justify-between gap-4 rounded-card border border-border bg-white px-5 py-4 transition hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:px-6"
      href={href as Route<string>}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
        <Icon aria-hidden="true" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-brand-deep sm:text-base">
          {title}
        </span>
        <span className="mt-1 block text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
          {description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="text-lg font-extrabold text-brand-primary"
      >
        ›
      </span>
    </Link>
  );
}

function ActionButton({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <button
      className="flex min-h-16 w-full cursor-not-allowed items-center justify-between gap-4 rounded-card border border-border bg-white px-5 py-4 opacity-70 sm:px-6"
      disabled
      type="button"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-soft text-tesText-muted">
        <Icon aria-hidden="true" size={18} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-extrabold text-brand-deep sm:text-base">
          {title}
        </span>
        <span className="mt-1 block text-[11px] font-semibold leading-5 text-tesText-secondary sm:text-xs">
          {description}
        </span>
      </span>
    </button>
  );
}
