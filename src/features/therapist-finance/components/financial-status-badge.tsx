import type {
  TherapistFinancialStatus,
  TherapistPayoutStatus,
} from "../therapist-finance.types";
import {
  financialStatusLabels,
  payoutStatusLabels,
} from "./financial-formatters";

const toneByStatus: Record<string, string> = {
  batched: "bg-brand-lavenderSoft text-brand-primary",
  blocked: "bg-status-warningBg text-status-warning",
  canceled: "bg-tesSurface-subtle text-tesText-secondary",
  disputed: "bg-status-dangerBg text-status-danger",
  eligible: "bg-status-successBg text-status-success",
  failed: "bg-status-dangerBg text-status-danger",
  paid: "bg-status-successBg text-status-success",
  partially_refunded: "bg-status-warningBg text-status-warning",
  pending: "bg-brand-lavenderSoft text-brand-primary",
  processing: "bg-status-infoBg text-status-info",
  refunded: "bg-status-warningBg text-status-warning",
  reversed: "bg-status-dangerBg text-status-danger",
  transferred: "bg-status-successBg text-status-success",
  transfer_pending: "bg-status-infoBg text-status-info",
  waiting_confirmation: "bg-brand-lavenderSoft text-brand-primary",
  waiting_safety_period: "bg-status-warningBg text-status-warning",
};

export function FinancialStatusBadge({
  status,
  type,
}: {
  status: TherapistFinancialStatus | TherapistPayoutStatus;
  type: "payment" | "payout";
}) {
  const label =
    type === "payment"
      ? financialStatusLabels[status as TherapistFinancialStatus]
      : payoutStatusLabels[status as TherapistPayoutStatus];

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-extrabold ${toneByStatus[status]}`}
    >
      {label}
    </span>
  );
}
