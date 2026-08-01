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

  return (
    <div className="grid gap-4">
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
      <section className="rounded-card border border-brand-lavender bg-white p-5 shadow-card">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-brand-primary">
            <ReceiptText aria-hidden="true" size={22} />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-brand-deep">
              {cancellation.title}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-tesText-secondary">
              {cancellation.impactLabel}
            </p>
          </div>
        </div>
      </section>
      <section
        aria-label="Ações complementares do encontro"
        className="grid gap-4 md:grid-cols-2"
      >
        {data.receipt.receiptUrl ? (
          <ActionLink
            description="Baixe recibo do pagamento"
            href={data.receipt.receiptUrl}
            icon={Download}
            title="Baixar comprovante"
          />
        ) : (
          <ActionButton
            description="Comprovante indisponível"
            icon={Download}
            title="Baixar comprovante"
          />
        )}
        <ActionLink
          description="Ver outras ações para este encontro"
          href={
            `${routes.patient.messages}?context=suporte&booking=${data.booking.id}` as Route<string>
          }
          icon={MoreHorizontal}
          title="Mais opções"
        />
      </section>
    </div>
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
      className="rounded-card border border-brand-lavender bg-white p-5 text-center shadow-card transition hover:-translate-y-0.5 hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      href={href as Route<string>}
    >
      <Icon
        aria-hidden="true"
        className="mx-auto text-brand-primary"
        size={26}
      />
      <p className="mt-4 text-sm font-extrabold text-brand-deep">{title}</p>
      <p className="mx-auto mt-2 max-w-[150px] text-xs font-semibold leading-5 text-tesText-secondary">
        {description}
      </p>
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
      className="cursor-not-allowed rounded-card border border-brand-lavender bg-white p-5 text-center opacity-70 shadow-card"
      disabled
      type="button"
    >
      <Icon
        aria-hidden="true"
        className="mx-auto text-tesText-muted"
        size={26}
      />
      <p className="mt-4 text-sm font-extrabold text-brand-deep">{title}</p>
      <p className="mx-auto mt-2 max-w-[150px] text-xs font-semibold leading-5 text-tesText-secondary">
        {description}
      </p>
    </button>
  );
}
