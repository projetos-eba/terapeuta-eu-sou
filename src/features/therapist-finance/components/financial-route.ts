import { routes } from "@/lib/routes";

import type {
  TherapistFinanceFilters,
  TherapistFinancePeriodKey,
  TherapistFinanceTab,
} from "../therapist-finance.types";

export const financeTabs: Array<{
  label: string;
  value: TherapistFinanceTab;
}> = [
  { label: "Resumo", value: "summary" },
  { label: "Recebimentos", value: "receipts" },
  { label: "Repasses", value: "payouts" },
  { label: "Conta de recebimento", value: "account" },
];

const financeTabQueryValues: Record<TherapistFinanceTab, string> = {
  account: "conta",
  payouts: "repasses",
  receipts: "recebimentos",
  summary: "resumo",
};

export function toFinanceTabQueryValue(tab: TherapistFinanceTab) {
  return financeTabQueryValues[tab];
}

export function buildFinanceHref({
  end,
  filters,
  page,
  period,
  start,
  tab,
}: {
  end?: string;
  filters?: Partial<TherapistFinanceFilters>;
  page?: number;
  period: TherapistFinancePeriodKey;
  start?: string;
  tab: TherapistFinanceTab;
}) {
  const params = new URLSearchParams();

  if (tab !== "summary") params.set("tab", toFinanceTabQueryValue(tab));
  if (period !== "30") params.set("period", period);
  if (period === "custom" && start && end) {
    params.set("start", start);
    params.set("end", end);
  }
  if (page && page > 1) params.set("page", String(page));
  if (filters?.status) params.set("status", filters.status);
  if (filters?.payoutStatus) params.set("payoutStatus", filters.payoutStatus);
  if (filters?.therapyId) params.set("therapyId", filters.therapyId);
  if (filters?.search) params.set("q", filters.search);

  const query = params.toString();
  return query
    ? `${routes.therapist.finance}?${query}`
    : routes.therapist.finance;
}
