import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

import type { PatientSessionDetailPageData } from "../patient-session-detail.types";
import { PreEncounterDeviceCheck } from "./pre-encounter-device-check";

export function PreparationCard({
  data,
}: {
  data: PatientSessionDetailPageData;
}) {
  const { preparation } = data.encounterState;

  return (
    <section className="relative overflow-hidden rounded-card border border-brand-lavender bg-white p-6 shadow-card">
      <h2 className="font-display text-2xl font-light italic text-brand-deep">
        {preparation.title}
      </h2>
      <ul className="mt-6 space-y-3">
        {preparation.checklist.map((item) => (
          <li
            className="flex gap-2 text-sm font-semibold text-tesText-secondary"
            key={item}
          >
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-brand-primary"
              size={16}
            />
            {item}
          </li>
        ))}
      </ul>
      <PreEncounterDeviceCheck
        countdownLabel={preparation.countdownLabel}
        enabled={preparation.deviceCheckRecommended}
      />
      <Image
        alt=""
        className="pointer-events-none absolute bottom-0 right-0 hidden h-32 w-36 object-cover opacity-20 md:block"
        height={128}
        src="/home/step-calendar.png"
        width={144}
      />
    </section>
  );
}
