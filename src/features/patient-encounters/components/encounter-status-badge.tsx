import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { PatientEncounterStatus } from "../patient-encounters.types";

const statusClasses: Record<PatientEncounterStatus, string> = {
  awaiting_confirmation: "bg-status-warningBg text-status-warning",
  cancelled: "bg-status-dangerBg text-status-danger",
  completed: "text-status-success",
  confirmed: "text-brand-primary",
  live: "bg-status-successBg text-status-success",
  pending_payment: "bg-status-warningBg text-status-warning",
  reschedule_requested: "bg-status-warningBg text-status-warning",
};

const emphasizedStatuses = new Set<PatientEncounterStatus>([
  "awaiting_confirmation",
  "cancelled",
  "live",
  "pending_payment",
  "reschedule_requested",
]);

export function EncounterStatusBadge({
  children,
  className,
  status,
}: {
  children: ReactNode;
  className?: string;
  status: PatientEncounterStatus;
}) {
  const emphasized = emphasizedStatuses.has(status);

  return (
    <span
      className={cn(
        "inline-flex min-h-8 w-fit items-center gap-2 text-sm font-extrabold",
        emphasized ? "rounded-full px-3" : "px-0",
        statusClasses[status],
        className,
      )}
    >
      {!emphasized ? (
        <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}
