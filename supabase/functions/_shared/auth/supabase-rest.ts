export class SupabaseHttpError extends Error {
  constructor(
    readonly status: number,
    readonly safeDetails?: string,
  ) {
    super("Supabase request failed.");
  }
}

export class SupabaseRestClient {
  constructor(
    readonly supabaseUrl: string,
    readonly serviceRoleKey: string,
  ) {}

  get<T>(path: string) {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body: unknown, prefer?: string) {
    return this.request<T>(path, { body, method: "POST", prefer });
  }

  patch<T>(path: string, body: unknown, prefer?: string) {
    return this.request<T>(path, { body, method: "PATCH", prefer });
  }

  put<T>(path: string, body: unknown, prefer?: string) {
    return this.request<T>(path, { body, method: "PUT", prefer });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }

  rpc<T>(name: string, body: unknown) {
    return this.post<T>(`/rest/v1/rpc/${name}`, body);
  }

  private async request<T>(
    path: string,
    options: {
      body?: unknown;
      method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
      prefer?: string;
    },
  ) {
    const response = await fetch(`${this.supabaseUrl}${path}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(options.prefer ? { Prefer: options.prefer } : {}),
      },
      method: options.method,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new SupabaseHttpError(response.status, sanitizeErrorText(text));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return text ? (JSON.parse(text) as T) : (undefined as T);
  }
}

export async function parseJson<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function sanitizeErrorText(value: string) {
  return value.replace(/[\r\n]+/g, " ").slice(0, 500);
}
