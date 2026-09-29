import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildAdminFinanceCsv } from "@/features/admin-finance/admin-finance.export";
import { getAdminFinancePage } from "@/features/admin-finance/admin-finance.queries";
import type { AdminFinanceModuleKey } from "@/features/admin-finance/admin-finance.types";
import {
  canUseAdminPermission,
  type AdminPermission,
} from "@/lib/auth/admin-permissions";
import { readAdminSessionFromAccessToken } from "@/lib/auth/admin-session";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const modulePermissions = {
  payments: "admin.payments.read",
  subscriptions: "admin.subscriptions.read",
} satisfies Record<Extract<AdminFinanceModuleKey, "payments" | "subscriptions">, AdminPermission>;

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const correlationId = crypto.randomUUID();
  const url = new URL(request.url);
  const financeModule = parseModule(url.searchParams.get("module"));
  if (!financeModule) return failure("Escolha um relatório válido.", 422, correlationId);

  const config = getSupabasePublicConfig();
  const accessToken = (await cookies()).get("tes_admin_access_token")?.value;
  if (!config || !accessToken) {
    return failure("Entre na conta administrativa para continuar.", 401, correlationId);
  }

  try {
    const session = await readAdminSessionFromAccessToken(config, accessToken);
    if (!session || !canUseAdminPermission(session.permissions, modulePermissions[financeModule])) {
      return failure("Você não tem permissão para este relatório.", 403, correlationId);
    }

    const params = toSearchParams(url.searchParams);
    const first = await getAdminFinancePage({
      accessToken,
      module: financeModule,
      searchParams: { ...params, page: "1", pageSize: "50" },
    });
    if (first.status === "error") {
      return failure("Não foi possível preparar o relatório agora.", 503, correlationId);
    }

    const rows = [...first.data.rows];
    let page = 1;
    let hasNext = first.data.page.hasNext;
    while (hasNext && page < 200) {
      page += 1;
      const next = await getAdminFinancePage({
        accessToken,
        module: financeModule,
        searchParams: { ...params, page: String(page), pageSize: "50" },
      });
      if (next.status === "error") {
        return failure("Não foi possível concluir o relatório agora.", 503, correlationId);
      }
      rows.push(...next.data.rows);
      hasNext = next.data.page.hasNext;
    }

    if (hasNext) {
      return failure(
        "Este relatório é muito extenso. Escolha um período menor para continuar.",
        422,
        correlationId,
      );
    }

    const csv = buildAdminFinanceCsv({ data: { ...first.data, rows } });
    return new NextResponse(csv, {
      headers: {
        ...noStoreHeaders,
        "Content-Disposition": `attachment; filename="tes-${financeModule}-${filePeriod(first.data)}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Correlation-Id": correlationId,
      },
      status: 200,
    });
  } catch {
    return failure("Não foi possível preparar o relatório agora.", 503, correlationId);
  }
}

function parseModule(value: string | null): "payments" | "subscriptions" | null {
  return value === "payments" || value === "subscriptions" ? value : null;
}

function toSearchParams(params: URLSearchParams) {
  return Object.fromEntries(
    ["q", "status", "sort", "period", "start", "end", "plan"]
      .map((key) => [key, params.get(key)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function filePeriod(data: { query: { end?: string; period?: string; start?: string } }) {
  if (data.query.period === "custom" && data.query.start && data.query.end) {
    return `${data.query.start}-a-${data.query.end}`;
  }
  return data.query.period ?? "30d";
}

function failure(message: string, status: number, correlationId: string) {
  return NextResponse.json(
    { message, ok: false },
    { headers: { ...noStoreHeaders, "X-Correlation-Id": correlationId }, status },
  );
}
