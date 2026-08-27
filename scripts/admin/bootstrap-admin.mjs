import { execFileSync } from "node:child_process";

const projectRef = requiredArgument("--project-ref");
const email = requiredEnv("TES_ADMIN_BOOTSTRAP_EMAIL").toLowerCase();
const password = requiredEnv("TES_ADMIN_BOOTSTRAP_PASSWORD");

if (!/^[a-z0-9]{20}$/.test(projectRef)) {
  throw new Error("Invalid Supabase project ref.");
}

if (!email.includes("@") || password.length < 8) {
  throw new Error("Invalid admin bootstrap input.");
}

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  resolveServiceRoleKey(projectRef);
const supabaseUrl = `https://${projectRef}.supabase.co`;
const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

const existingUser = await findUserByEmail();
const user = existingUser
  ? await updateAuthUser(existingUser.id)
  : await createAuthUser();

await upsertAdminProfile(user.id);

const verified = await verifyAdmin(user.id);
if (!verified) {
  throw new Error("Admin bootstrap verification failed.");
}

console.log(
  JSON.stringify({
    action: existingUser ? "updated" : "created",
    email,
    projectRef,
    role: "admin",
    verified: true,
  }),
);

async function findUserByEmail() {
  for (let page = 1; page <= 100; page += 1) {
    const response = await request(
      `/auth/v1/admin/users?page=${page}&per_page=100`,
      { method: "GET" },
    );
    const users = Array.isArray(response.users) ? response.users : [];
    const match = users.find(
      (candidate) => candidate.email?.toLowerCase() === email,
    );
    if (match) return match;
    if (users.length < 100) return null;
  }
  throw new Error("Admin user lookup exceeded the safe pagination limit.");
}

async function createAuthUser() {
  return request("/auth/v1/admin/users", {
    body: JSON.stringify({
      email,
      email_confirm: true,
      password,
      user_metadata: { role: "admin" },
    }),
    method: "POST",
  });
}

async function updateAuthUser(userId) {
  return request(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    body: JSON.stringify({
      email_confirm: true,
      password,
      user_metadata: { role: "admin" },
    }),
    method: "PUT",
  });
}

async function upsertAdminProfile(userId) {
  await request("/rest/v1/profiles?on_conflict=id", {
    body: JSON.stringify({
      display_name: "Administrador TES",
      email,
      id: userId,
      role: "admin",
    }),
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    method: "POST",
  });
}

async function verifyAdmin(userId) {
  const rows = await request(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&role=eq.admin&select=id`,
    { method: "GET" },
  );
  return Array.isArray(rows) && rows.length === 1;
}

async function request(path, init) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    throw new Error(
      `Supabase admin request failed (${response.status})${requestId ? ` request=${requestId}` : ""}.`,
    );
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function resolveServiceRoleKey(ref) {
  const executable =
    process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npx";
  const argumentsList =
    process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          `npx.cmd supabase projects api-keys --project-ref ${ref} --reveal --output json`,
        ]
      : [
          "supabase",
          "projects",
          "api-keys",
          "--project-ref",
          ref,
          "--reveal",
          "--output",
          "json",
        ];
  const output = execFileSync(executable, argumentsList, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const payload = JSON.parse(output);
  const keys = Array.isArray(payload)
    ? payload
    : payload.api_keys || payload.keys || [];
  const serviceKey = keys.find((key) =>
    ["service_role", "secret"].includes(key.name || key.type),
  );
  const value = serviceKey?.api_key || serviceKey?.key || serviceKey?.value;
  if (!value) {
    throw new Error(
      "Supabase service role key was not available to the CLI profile.",
    );
  }
  return value;
}

function requiredArgument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1]?.trim() : "";
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
