import { execFileSync } from "node:child_process";

export async function getSupabaseRuntime() {
  const fromEnv = runtimeFromEnv();
  if (fromEnv) return fromEnv;

  const command =
    process.platform === "win32"
      ? ["cmd.exe", ["/c", "npx", "supabase", "status", "-o", "env"]]
      : ["npx", ["supabase", "status", "-o", "env"]];
  const output = execFileSync(command[0], command[1], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const map = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) map[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }

  return {
    apiUrl: map.API_URL,
    environment: "local",
    serviceRoleKey: map.SERVICE_ROLE_KEY,
  };
}

export function assertSupabaseTarget(runtime) {
  const failures = [];
  const host = safeHost(runtime.apiUrl);
  const isLocal = ["127.0.0.1", "localhost"].includes(host);
  const stagingAllowed =
    process.env.SUPABASE_REAL_HOMOLOGATION_ALLOWED === "true" &&
    process.env.SUPABASE_REAL_HOMOLOGATION_TARGET === "staging";

  if (!runtime.apiUrl || !runtime.serviceRoleKey) {
    failures.push({
      expected: "Supabase URL e service role disponiveis localmente",
      item: "Supabase runtime",
      where: "npx supabase status -o env ou variaveis de shell",
    });
  }

  if (!isLocal && !stagingAllowed) {
    failures.push({
      expected: "Supabase local ou staging autorizado explicitamente",
      item: host ?? "SUPABASE_URL",
      where: "SUPABASE_REAL_HOMOLOGATION_ALLOWED/TARGET",
    });
  }

  return failures;
}

export function createSupabaseAdmin(runtime) {
  const restUrl = `${runtime.apiUrl.replace(/\/$/, "")}/rest/v1`;
  const authUrl = `${runtime.apiUrl.replace(/\/$/, "")}/auth/v1`;
  const headers = {
    apikey: runtime.serviceRoleKey,
    Authorization: `Bearer ${runtime.serviceRoleKey}`,
  };

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const text = await response.text();
    const body = parseBody(text);
    if (!response.ok) {
      throw new Error(
        JSON.stringify({
          body,
          status: response.status,
          url: sanitizeUrl(url),
        }),
      );
    }
    return body;
  }

  return {
    async authCreateUser({ email, password, role }) {
      const body = await request(`${authUrl}/admin/users`, {
        body: JSON.stringify({
          app_metadata: { provider: "email", providers: ["email"], role },
          email,
          email_confirm: true,
          password,
          user_metadata: { source: "zoom_real_homologation", role },
        }),
        method: "POST",
      });
      return body;
    },
    async authDeleteUser(id) {
      try {
        await request(`${authUrl}/admin/users/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      } catch (error) {
        if (/user_not_found|\"code\":404/.test(String(error?.message))) return;
        throw error;
      }
    },
    async delete(table, query) {
      await request(`${restUrl}/${table}?${query}`, {
        headers: { Prefer: "return=minimal" },
        method: "DELETE",
      });
    },
    async insert(table, rows) {
      const body = await request(`${restUrl}/${table}`, {
        body: JSON.stringify(rows),
        headers: { Prefer: "return=representation" },
        method: "POST",
      });
      return body;
    },
    async patch(table, query, patch) {
      return request(`${restUrl}/${table}?${query}`, {
        body: JSON.stringify(patch),
        headers: { Prefer: "return=representation" },
        method: "PATCH",
      });
    },
    async rpc(name, payload) {
      return request(`${restUrl}/rpc/${name}`, {
        body: JSON.stringify(payload),
        method: "POST",
      });
    },
    async select(table, query) {
      return request(`${restUrl}/${table}?${query}`);
    },
    executeLocalSql(sql) {
      if (!["127.0.0.1", "localhost"].includes(safeHost(runtime.apiUrl))) {
        throw new Error("local_sql_requires_local_supabase");
      }
      const command =
        process.platform === "win32"
          ? [
              "cmd.exe",
              ["/c", "npx", "supabase", "db", "query", "--local", sql],
            ]
          : ["npx", ["supabase", "db", "query", "--local", sql]];
      execFileSync(command[0], command[1], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    },
  };
}

function runtimeFromEnv() {
  const apiUrl =
    process.env.SUPABASE_URL ??
    process.env.SUPABASE_API_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!apiUrl || !serviceRoleKey) return null;

  return {
    apiUrl,
    environment: safeHost(apiUrl) === "127.0.0.1" ? "local" : "external",
    serviceRoleKey,
  };
}

function safeHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sanitizeUrl(url) {
  const parsed = new URL(url);
  parsed.search = parsed.search
    .replace(/apikey=[^&]+/gi, "apikey=[redacted]")
    .replace(/Authorization=[^&]+/gi, "Authorization=[redacted]");
  return parsed.toString();
}
