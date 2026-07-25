export const jsonHeaders = {
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, x-forwarded-for",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
};

export function handleOptions(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: jsonHeaders, status: 204 });
  }

  return null;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  });
}
