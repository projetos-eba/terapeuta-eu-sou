#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";

const supabaseUrl = (
  process.env.PAYMENTS_HML_SUPABASE_URL?.trim() ??
  "https://emzwqkmrryuqvqiohqnu.supabase.co"
).replace(/\/+$/g, "");
const adminEmail = process.env.PAYMENTS_HML_ADMIN_EMAIL?.trim() ?? "";
const adminPassword = process.env.PAYMENTS_HML_ADMIN_PASSWORD ?? "";
const evidenceDir =
  process.env.PAYMENTS_PHASE3_EVIDENCE_DIR?.trim() ??
  "test-results/stripe-phase3";
const evidenceFile = `${evidenceDir}/runtime-preflight-${new Date()
  .toISOString()
  .replace(/[:.]/g, "-")}.json`;

const evidence = {
  generatedAt: new Date().toISOString(),
  target: "hml",
  checks: [],
};

try {
  assertHmlUrl(supabaseUrl);
  if (!adminEmail || !adminPassword) {
    throw new Error("hml_admin_credentials_missing");
  }

  const login = await fetch(`${supabaseUrl}/functions/v1/admin-auth-login`, {
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const loginBody = await login.json();
  if (!login.ok || loginBody?.ok !== true || !loginBody.accessToken) {
    throw new Error("hml_admin_login_failed");
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/stripe-hml-preflight`,
    {
      headers: { authorization: `Bearer ${loginBody.accessToken}` },
      method: "POST",
    },
  );
  const responseBody = await response.json();
  if (
    !response.ok ||
    responseBody?.ok !== true ||
    !Array.isArray(responseBody.data?.checks)
  ) {
    throw new Error("hml_preflight_request_failed");
  }

  evidence.checks = responseBody.data.checks.map((check) => ({
    name: String(check.name),
    status: check.status === "pass" ? "pass" : "fail",
    summary: String(check.summary),
  }));
} catch (error) {
  evidence.checks.push({
    name: "runtime_preflight",
    status: "fail",
    summary: "Preflight HML nao foi concluido.",
  });
}

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);

for (const check of evidence.checks) {
  console.log(
    `${check.status === "pass" ? "PASS" : "FAIL"} ${check.name}: ${check.summary}`,
  );
}
console.log(`Evidence: ${evidenceFile}`);

if (evidence.checks.some((check) => check.status !== "pass")) {
  process.exitCode = 1;
}

function assertHmlUrl(value) {
  const url = new URL(value);
  if (url.hostname !== "emzwqkmrryuqvqiohqnu.supabase.co") {
    throw new Error("hml_supabase_url_required");
  }
}
