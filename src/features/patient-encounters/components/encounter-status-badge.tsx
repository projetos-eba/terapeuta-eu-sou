import type { ReactNode } from "react";

import type { PatientEncounterStatus } from "../patient-encounters.types";

export function EncounterStatusBadge({
  children,
  status,
}: {
  children: ReactNode;
  status: PatientEncounterStatus;
}) {
  const tone = {
    cancelled: "bg-status-dangerBg text-status-danger",
    completed: "bg-status-successBg text-status-success",
    confirmed: "bg-status-successBg text-status-success",
    live: "bg-[#FDECF1] text-status-danger",
    pending_payment: "bg-status-warningBg text-status-warning",
  }[status];

  return (
    <span
      className={`inline-flex min-h-8 w-fit items-center rounded-full px-3 text-xs font-extrabold ${tone}`}
    >
      {children}
    </span>
  );
}
