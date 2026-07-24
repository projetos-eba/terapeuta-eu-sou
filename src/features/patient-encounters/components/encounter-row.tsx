import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import type { PatientEncounter } from "../patient-encounters.types";
import { EncounterActionsMenu } from "./encounter-actions-menu";
import { EncounterStatusBadge } from "./encounter-status-badge";

export function EncounterRow({
  encounter,
}: {
  encounter: PatientEncounter;
}) {
  return (
    <article className="grid gap-4 py-5 md:grid-cols-[minmax(240px,1.3fr)_150px_170px_138px_44px] md:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar
          alt=""
          name={encounter.therapist.name}
          src={encounter.therapist.avatarUrl}
        />
        <div className="min-w-0">
          <h3 className="truncate text-base font-extrabold text-brand-deep">
            {encounter.therapist.name}
          </h3>
          <p className="mt-1 text-sm font-bold text-tesText-secondary">
            {encounter.serviceLabel}
          </p>
          <p className="mt-1 text-xs font-bold text-tesText-muted">
            {encounter.approachLabel}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-tesText-muted md:hidden">
          Data
        </p>
        <p className="mt-1 text-sm font-extrabold text-brand-deep md:mt-0">
          {encounter.dateLabel}
        </p>
        <p className="mt-1 text-sm font-semibold text-tesText-secondary">
          {encounter.scheduleLabel}
        </p>
      </div>

      <EncounterStatusBadge status={encounter.status}>
        {encounter.statusLabel}
      </EncounterStatusBadge>

      <div className="flex flex-col gap-2 md:items-end">
        {encounter.primaryAction.disabled ? (
          <button
            className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-full bg-brand-lavenderSoft px-4 text-sm font-extrabold text-tesText-secondary"
            disabled
            title={encounter.primaryAction.reason}
            type="button"
          >
            {encounter.primaryAction.label}
          </button>
        ) : (
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-brand-primary px-4 text-sm font-extrabold text-white shadow-card transition hover:bg-brand-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            href={encounter.primaryAction.href as Route<string>}
          >
            {encounter.primaryAction.label}
          </Link>
        )}
        {encounter.actionHint ? (
          <span className="text-xs font-bold text-tesText-muted">
            {encounter.actionHint}
          </span>
        ) : null}
      </div>

      <EncounterActionsMenu bookingId={encounter.id} />
    </article>
  );
}

function Avatar({
  alt,
  name,
  src,
}: {
  alt: string;
  name: string;
  src: string | null;
}) {
  if (src) {
    return (
      <Image
        alt={alt}
        className="size-14 shrink-0 rounded-full object-cover"
        height={56}
        src={src}
        width={56}
      />
    );
  }

  return (
    <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-lavenderSoft text-base font-extrabold text-brand-primary">
      {name.charAt(0)}
    </span>
  );
}
