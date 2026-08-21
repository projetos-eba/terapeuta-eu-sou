import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };
const ITEM_LIMIT = 6;

type NotificationRow = {
  body: string | null;
  created_at: string;
  href: string | null;
  id: string;
  kind: string;
  read_at: string | null;
  title: string;
};

type SupabaseUser = {
  id: string;
};

export async function GET() {
  const config = getSupabasePublicConfig();
  const accessToken = await getAccessToken();

  if (!config || !accessToken) return failure("Entre na sua conta.", 401);

  try {
    const user = await supabaseRequest<SupabaseUser>(
      config,
      accessToken,
      "/auth/v1/user",
    );
    const profileFilter = `profile_id=eq.${encodeURIComponent(user.id)}`;
    const [itemsResponse, countResponse, bookingResponse] = await Promise.all([
      fetch(
        `${config.url}/rest/v1/notifications?select=id,kind,title,body,href,read_at,created_at&${profileFilter}&order=created_at.desc&limit=${ITEM_LIMIT}`,
        {
          cache: "no-store",
          headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      ),
      fetch(
        `${config.url}/rest/v1/notifications?select=id&${profileFilter}&read_at=is.null`,
        {
          cache: "no-store",
          headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${accessToken}`,
            Prefer: "count=exact",
            Range: "0-0",
          },
        },
      ),
      fetch(
        `${config.url}/rest/v1/notifications?select=id,kind,title,body,href,read_at,created_at&${profileFilter}&kind=eq.booking_confirmed&read_at=is.null&order=created_at.desc&limit=1`,
        {
          cache: "no-store",
          headers: {
            apikey: config.apiKey,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      ),
    ]);

    if (!itemsResponse.ok || !countResponse.ok || !bookingResponse.ok) {
      return failure("Não foi possível carregar notificações.", 503);
    }

    const [items, bookingItems] = (await Promise.all([
      itemsResponse.json() as Promise<NotificationRow[]>,
      bookingResponse.json() as Promise<NotificationRow[]>,
    ])) as [NotificationRow[], NotificationRow[]];

    return NextResponse.json(
      {
        count: getCount(countResponse.headers.get("content-range")),
        items: items.map(toNotificationItem),
        toast: bookingItems[0] ? toNotificationItem(bookingItems[0]) : null,
      },
      { headers: noStoreHeaders },
    );
  } catch {
    return failure("Não foi possível carregar notificações agora.", 503);
  }
}

async function getAccessToken() {
  const cookieStore = await cookies();
  return (
    cookieStore.get("tes_patient_access_token")?.value ??
    cookieStore.get("tes_therapist_access_token")?.value ??
    cookieStore.get("tes_admin_access_token")?.value ??
    null
  );
}

async function supabaseRequest<T>(
  config: NonNullable<ReturnType<typeof getSupabasePublicConfig>>,
  accessToken: string,
  path: string,
) {
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) throw new Error("Supabase request failed.");

  return (await response.json()) as T;
}

function getCount(contentRange: string | null) {
  const total = contentRange?.match(/\/(\d+)$/)?.[1];
  return total ? Number.parseInt(total, 10) : 0;
}

function toNotificationItem(row: NotificationRow) {
  return {
    body: row.body,
    createdAt: row.created_at,
    href: row.href?.startsWith("/") ? row.href : null,
    id: row.id,
    kind: row.kind,
    readAt: row.read_at,
    title: row.title,
  };
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { message } },
    { headers: noStoreHeaders, status },
  );
}
