import Link from "next/link";
import type { Route } from "next";
import { CalendarClock, Download, MoreHorizontal } from "lucide-react";

import { routes } from "@/lib/routes";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";

export function SessionActionCards({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  return (
    <section
      aria-label="Ações da sessão"
      className="grid gap-4 md:grid-cols-3"
    >
      <ActionLink
        description="Escolha uma nova data e horário"
        href={data.therapist.profileHref}
        icon={CalendarClock}
        title="Reagendar sessão"
      />
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
        description="Ver outras ações para esta sessão"
        href={`${routes.patient.help}?booking=${data.booking.id}` as Route<string>}
        icon={MoreHorizontal}
        title="Mais opções"
      />
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
  icon: typeof CalendarClock;
  title: string;
}) {
  return (
    <Link
      className="rounded-card border border-brand-lavender bg-white p-5 text-center shadow-card transition hover:-translate-y-0.5 hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      href={href as Route<string>}
    >
      <Icon aria-hidden="true" className="mx-auto text-brand-primary" size={26} />
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
  icon: typeof CalendarClock;
  title: string;
}) {
  return (
    <button
      className="cursor-not-allowed rounded-card border border-brand-lavender bg-white p-5 text-center opacity-70 shadow-card"
      disabled
      type="button"
    >
      <Icon aria-hidden="true" className="mx-auto text-tesText-muted" size={26} />
      <p className="mt-4 text-sm font-extrabold text-brand-deep">{title}</p>
      <p className="mx-auto mt-2 max-w-[150px] text-xs font-semibold leading-5 text-tesText-secondary">
        {description}
      </p>
    </button>
  );
}
