import Image from "next/image";

import { TESButton } from "@/components/tes/tes-button";
import { BookingReference } from "@/features/bookings";

import { getEncounterGuidance } from "../patient-encounters.copy";
import type { PatientEncounter } from "../patient-encounters.types";
import { EncounterStatusBadge } from "./encounter-status-badge";

export function EncounterRow({ encounter }: { encounter: PatientEncounter }) {
  const guidance = getEncounterGuidance(encounter);

  return (
    <article className="grid gap-5 py-6 md:grid-cols-[minmax(0,1.25fr)_minmax(130px,0.55fr)_minmax(200px,0.85fr)_auto] md:items-center md:gap-6">
      <div className="flex min-w-0 items-start gap-4">
        <Avatar
          name={encounter.therapist.name}
          src={encounter.therapist.avatarUrl}
        />
        <div className="min-w-0">
          <h3 className="truncate text-base font-extrabold text-brand-deep">
            {encounter.therapist.name}
          </h3>
          <BookingReference id={encounter.id} />
          <p className="mt-1 text-sm font-bold leading-6 text-tesText-secondary">
            {encounter.serviceLabel}
          </p>
          <p className="text-[11px] font-semibold leading-5 text-tesText-muted sm:text-xs">
            {encounter.therapyLabel} · {encounter.approachLabel}
          </p>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-tesText-muted sm:text-xs">
          Quando
        </p>
        <p className="mt-2 text-sm font-extrabold text-brand-deep">
          {encounter.dateLabel}
        </p>
        <p className="mt-1 text-sm font-semibold text-tesText-secondary">
          {encounter.scheduleLabel}
        </p>
      </div>

      <div>
        <EncounterStatusBadge status={encounter.status}>
          {encounter.statusLabel}
        </EncounterStatusBadge>
        <p className="mt-2 max-w-[260px] text-sm font-semibold leading-6 text-tesText-secondary">
          {guidance}
        </p>
      </div>

      <div className="md:justify-self-end">
        {encounter.primaryAction.disabled ? (
          <button
            className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-full bg-brand-lavenderSoft px-4 text-sm font-extrabold text-tesText-secondary sm:w-auto"
            disabled
            title={encounter.primaryAction.reason}
            type="button"
          >
            {encounter.primaryAction.label}
          </button>
        ) : (
          <TESButton
            className="w-full sm:w-auto"
            href={encounter.primaryAction.href}
            variant="secondary"
          >
            {encounter.primaryAction.label}
          </TESButton>
        )}
      </div>
    </article>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      <Image
        alt=""
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
