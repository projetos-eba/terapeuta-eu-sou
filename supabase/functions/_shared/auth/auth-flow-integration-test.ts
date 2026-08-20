import { createAuthActionToken } from "./tokens.ts";
import { SupabaseRestClient } from "./supabase-rest.ts";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

type Mode = "auto" | "normal";
type UserRole = "admin" | "patient" | "therapist";

type LoginResponse = {
  ok: boolean;
  accessToken?: string;
  error?: string;
  plan?: string;
  refreshToken?: string;
  userId?: string;
};

type SignupResponse = {
  mode?: "automatically_confirmed" | "email_sent";
  ok?: boolean;
  redirectTo?: string;
  statusToken?: string;
  userId?: string;
};

const mode = requiredEnv("AUTH_FLOW_MODE") as Mode;
const supabaseUrl = requiredEnv("SUPABASE_URL");
const anonKey = requiredEnv("SUPABASE_ANON_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const masterPassword = requiredEnv("MASTER_PASSWORD");
const functionsUrl = `${supabaseUrl}/functions/v1`;
const restClient = new SupabaseRestClient(supabaseUrl, serviceRoleKey);
const testRunId = crypto.randomUUID().slice(0, 8);

if (mode !== "normal" && mode !== "auto") {
  throw new Error(`Unsupported AUTH_FLOW_MODE: ${mode}`);
}

if (mode === "normal") {
  await runNormalFlow();
} else {
  await runAutoConfirmFlow();
}

async function runNormalFlow() {
  const patient = await createConfirmedUser("patient");
  const resetPatient = await createUser("patient", {
    confirmed: true,
    email: e2eRecipientAlias("patient-reset"),
  });
  const therapist = await createConfirmedUser("therapist");
  const admin = await createConfirmedUser("admin");
  const unconfirmedPatient = await createUser("patient", {
    confirmed: false,
  });

  await assertLogin({
    email: patient.email,
    functionName: "client-auth-login",
    password: patient.password,
    role: "patient",
  });
  await assertLogin({
    email: patient.email,
    functionName: "client-auth-login",
    password: masterPassword,
    role: "patient",
  });
  await assertLogin({
    email: therapist.email,
    functionName: "therapist-auth-login",
    password: therapist.password,
    role: "therapist",
  });
  await assertLogin({
    email: therapist.email,
    functionName: "therapist-auth-login",
    password: masterPassword,
    role: "therapist",
  });
  await assertLogin({
    email: admin.email,
    functionName: "admin-auth-login",
    password: admin.password,
    role: "admin",
  });
  await assertLogin({
    email: admin.email,
    functionName: "admin-auth-login",
    password: masterPassword,
    role: "admin",
  });
  await assertRejectedLogin({
    email: admin.email,
    expectedError: "role_mismatch",
    functionName: "client-auth-login",
    password: masterPassword,
    status: 403,
  });
  await assertRejectedLogin({
    email: unconfirmedPatient.email,
    expectedError: "email_unconfirmed",
    functionName: "client-auth-login",
    password: masterPassword,
    status: 409,
  });

  await assertPasswordResetFlow(resetPatient.email, resetPatient.userId);
  await assertEmailVerificationFlow();
}

async function runAutoConfirmFlow() {
  const clientSignup = await invokeFunction<SignupResponse>(
    "client-auth-signup",
    {
      birthDate: "1990-01-01",
      confirmPassword: "ClientAuto123!",
      email: uniqueEmail("client-auto"),
      name: "Cliente Auto Auth",
      password: "ClientAuto123!",
      phoneDigits: "11999999999",
    },
  );

  assertEquals(clientSignup.mode, "automatically_confirmed");
  assertEquals(
    clientSignup.redirectTo,
    "/cliente/login?verified=1&automatic=1",
  );

  const therapistSignup = await invokeFunction<SignupResponse>(
    "therapist-auth-signup",
    {
      birthDate: "1990-01-01",
      confirmPassword: "TherapistAuto123!",
      email: uniqueEmail("therapist-auto"),
      fullName: "Terapeuta Auto Auth",
      password: "TherapistAuto123!",
      phoneDigits: "11999999999",
      plan: "premium_plus",
    },
  );

  assertEquals(therapistSignup.mode, "automatically_confirmed");
  assertEquals(
    therapistSignup.redirectTo,
    "/terapeuta/login?verified=1&automatic=1",
  );
}

async function assertPasswordResetFlow(email: string, userId: string) {
  const requestResult = await invokeFunction<{ ok: boolean; message?: string }>(
    "request-password-reset",
    { email },
  );

  assertEquals(requestResult.ok, true);

  const { token } = await createAuthActionToken(restClient, {
    expiresInSeconds: 60 * 60,
    purpose: "password_reset",
    recipientEmail: email,
    recipientRole: "patient",
    userId,
  });
  const resetResult = await invokeFunction<{
    ok: boolean;
    redirectTo?: string;
  }>("reset-password-with-token", {
    confirmPassword: "PatientReset123!",
    password: "PatientReset123!",
    token,
  });

  assertEquals(resetResult.ok, true);
  assertEquals(resetResult.redirectTo, "/cliente/login?reset=1");
  await assertUserEmailConfirmed(userId);
  const passwordChangedOutbox = await restClient.get<
    Array<{ action_key: string; recipient_user_id: string }>
  >(
    `/rest/v1/email_outbox?select=action_key,recipient_user_id&action_key=eq.password_changed&recipient_user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  assertEquals(passwordChangedOutbox.length, 1);
  assertEquals(passwordChangedOutbox[0]?.action_key, "password_changed");

  await assertLogin({
    email,
    functionName: "client-auth-login",
    password: "PatientReset123!",
    role: "patient",
  });
}

async function assertUserEmailConfirmed(userId: string) {
  const [authUser, profiles] = await Promise.all([
    serviceJson<{ email_confirmed_at?: string | null }>(
      `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      { method: "GET" },
    ),
    restClient.get<Array<{ email_confirmed_at: string | null }>>(
      `/rest/v1/profiles?select=email_confirmed_at&id=eq.${encodeURIComponent(
        userId,
      )}&limit=1`,
    ),
  ]);

  assert(
    Boolean(authUser.email_confirmed_at),
    "Expected password reset to confirm Auth e-mail.",
  );
  assert(
    Boolean(profiles[0]?.email_confirmed_at),
    "Expected password reset to confirm profile e-mail.",
  );
}

async function assertEmailVerificationFlow() {
  const email = e2eRecipientAlias("therapist-email");
  const signup = await invokeFunction<SignupResponse>("therapist-auth-signup", {
    birthDate: "1990-01-01",
    confirmPassword: "TherapistEmail123!",
    email,
    fullName: "Terapeuta Email Auth",
    password: "TherapistEmail123!",
    phoneDigits: "11999999999",
    plan: "premium",
  });

  assertEquals(signup.mode, "email_sent");
  assert(Boolean(signup.statusToken), "Expected status token from signup.");
  assertEquals(signup.redirectTo, undefined);

  const pendingStatus = await invokeFunction<{
    confirmed: boolean;
    destination: string | null;
    ok: boolean;
  }>("check-email-verification-status", {
    statusToken: signup.statusToken,
  });

  assertEquals(pendingStatus.ok, true);
  assertEquals(pendingStatus.confirmed, false);
  assertEquals(pendingStatus.destination, null);

  const userId = requiredString(signup.userId, "signup.userId");
  const { token } = await createAuthActionToken(restClient, {
    expiresInSeconds: 24 * 60 * 60,
    purpose: "email_verification",
    recipientEmail: email,
    recipientRole: "therapist",
    userId,
  });
  const verifyResult = await invokeFunction<{
    ok: boolean;
    redirectTo?: string;
  }>("verify-email", { token });

  assertEquals(verifyResult.ok, true);
  assertEquals(
    verifyResult.redirectTo,
    "/terapeuta/login?verified=1&next=%2Fterapeuta%2Fcheckout%3Fplan%3Dpremium",
  );

  const confirmedStatus = await invokeFunction<{
    confirmed: boolean;
    destination: string | null;
    ok: boolean;
  }>("check-email-verification-status", {
    statusToken: signup.statusToken,
  });

  assertEquals(confirmedStatus.ok, true);
  assertEquals(confirmedStatus.confirmed, true);
  assertEquals(
    confirmedStatus.destination,
    "/terapeuta/login?verified=1&next=%2Fterapeuta%2Fcheckout%3Fplan%3Dpremium",
  );

  await assertLogin({
    email,
    functionName: "therapist-auth-login",
    password: "TherapistEmail123!",
    role: "therapist",
  });
}

async function assertLogin(input: {
  email: string;
  functionName: string;
  password: string;
  role: UserRole;
}) {
  const result = await invokeFunction<LoginResponse>(input.functionName, {
    email: input.email,
    password: input.password,
  });

  assertEquals(result.ok, true);
  assert(
    Boolean(result.accessToken),
    `Expected access token for ${input.role}.`,
  );
  assert(
    Boolean(result.refreshToken),
    `Expected refresh token for ${input.role}.`,
  );

  if (input.role === "therapist") {
    assertEquals(result.plan, "free");
  }
}

async function assertRejectedLogin(input: {
  email: string;
  expectedError: string;
  functionName: string;
  password: string;
  status: number;
}) {
  const response = await fetch(`${functionsUrl}/${input.functionName}`, {
    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
    headers: authHeaders(),
    method: "POST",
  });
  const result = (await response.json()) as LoginResponse;

  assertEquals(response.status, input.status);
  assertEquals(result.ok, false);
  assertEquals(result.error, input.expectedError);
}

async function createConfirmedUser(role: UserRole) {
  return await createUser(role, { confirmed: true });
}

async function createUser(
  role: UserRole,
  options: {
    confirmed: boolean;
    email?: string;
  },
) {
  const email = options.email ?? uniqueEmail(role);
  const password = `${role}Password123!`;
  const authUser = await serviceJson<{ id: string }>("/auth/v1/admin/users", {
    body: {
      email,
      email_confirm: options.confirmed,
      password,
      user_metadata: {
        role,
      },
    },
    method: "POST",
  });
  const confirmedAt = options.confirmed ? new Date().toISOString() : null;

  await restClient.post(
    "/rest/v1/profiles",
    {
      display_name: `${role} Auth Test`,
      email,
      email_confirmed_at: confirmedAt,
      id: authUser.id,
      role,
    },
    "return=minimal",
  );

  if (role === "patient") {
    await restClient.post(
      "/rest/v1/patient_profiles",
      {
        birth_date: "1990-01-01",
        display_name: "Patient Auth Test",
        marketing_consent: false,
        metadata: {
          source: "auth_flow_integration_test",
        },
        phone: "11999999999",
        timezone: "America/Sao_Paulo",
        user_id: authUser.id,
      },
      "return=minimal",
    );
  }

  if (role === "therapist") {
    await restClient.post(
      "/rest/v1/therapist_profiles",
      {
        accepts_online_sessions: true,
        is_accepting_bookings: false,
        is_public: false,
        legal_name: "Therapist Auth Test",
        metadata: {},
        plan: "free",
        public_name: "Therapist Auth Test",
        slug: `therapist-auth-test-${testRunId}-${crypto.randomUUID().slice(0, 8)}`,
        status: "draft",
        user_id: authUser.id,
      },
      "return=minimal",
    );
  }

  return {
    email,
    password,
    userId: authUser.id,
  };
}

async function invokeFunction<T>(functionName: string, body: unknown) {
  let lastResult: unknown = null;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${functionsUrl}/${functionName}`, {
      body: JSON.stringify(body),
      headers: authHeaders(),
      method: "POST",
    });
    const result = (await response.json()) as T;
    lastResult = result;
    lastStatus = response.status;

    if (response.ok) {
      return result;
    }

    if (
      attempt < 3 &&
      isRetryableFunctionInvocation(functionName, response.status, result)
    ) {
      await delay(750 * attempt);
      continue;
    }

    throw new Error(
      `${functionName} failed with HTTP ${response.status}: ${JSON.stringify(result)}`,
    );
  }

  throw new Error(
    `${functionName} failed with HTTP ${lastStatus}: ${JSON.stringify(lastResult)}`,
  );
}

function isRetryableFunctionInvocation(
  functionName: string,
  status: number,
  result: unknown,
) {
  const idempotentFunctions = new Set([
    "admin-auth-login",
    "check-email-verification-status",
    "client-auth-login",
    "request-password-reset",
    "therapist-auth-login",
    "verify-email",
  ]);

  if (!idempotentFunctions.has(functionName) || ![502, 503].includes(status)) {
    return false;
  }

  return (
    !isRecord(result) ||
    result.message ===
      "An invalid response was received from the upstream server"
  );
}

async function serviceJson<T>(
  path: string,
  options: {
    body?: unknown;
    method: "GET" | "POST";
  },
) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    method: options.method,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Service request failed with HTTP ${response.status}: ${text}`,
    );
  }

  return JSON.parse(text) as T;
}

function authHeaders() {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  };
}

function uniqueEmail(role: string) {
  return `tes-auth-${role}-${testRunId}-${crypto.randomUUID().slice(0, 8)}@example.com`;
}

function e2eRecipientAlias(label: string) {
  const configured = Deno.env.get("EMAIL_E2E_RECIPIENT")?.trim();

  if (!configured) {
    throw new Error(
      "EMAIL_E2E_RECIPIENT must be configured for normal email flow tests.",
    );
  }

  const atIndex = configured.indexOf("@");

  if (atIndex <= 0) {
    throw new Error("EMAIL_E2E_RECIPIENT must be a valid email address.");
  }

  const local = configured.slice(0, atIndex);
  const domain = configured.slice(atIndex + 1);

  return `${local}+tesauth-${label}-${testRunId}@${domain}`;
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function requiredString(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(value: unknown, message: string) {
  if (!value) {
    throw new Error(message);
  }
}

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}
