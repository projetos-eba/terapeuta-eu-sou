import fs from "node:fs/promises";
import path from "node:path";

export const realStatePath = path.join(
  process.cwd(),
  ".tmp",
  "zoom-real-homologation.json",
);
export const webhookVerificationTtlMs = 15 * 60 * 1000;

export async function readRealState() {
  try {
    const raw = await fs.readFile(realStatePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

export async function writeRealState(patch) {
  const current = await readRealState();
  const next = {
    ...current,
    ...patch,
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(realStatePath), { recursive: true });
  await fs.writeFile(
    `${realStatePath}.tmp`,
    `${JSON.stringify(next, null, 2)}\n`,
  );
  await fs.rename(`${realStatePath}.tmp`, realStatePath);
  return next;
}

export async function recordTunnelState({
  localBaseUrl,
  publicBaseUrl,
  publicWebhookUrl,
}) {
  return writeRealState({
    tunnel: {
      localBaseUrl,
      publicBaseUrl,
      publicWebhookUrl,
      startedAt: new Date().toISOString(),
    },
    webhookVerification: null,
  });
}

export async function recordWebhookVerification({ publicWebhookUrl }) {
  const verifiedAt = new Date();
  const expiresAt = new Date(
    verifiedAt.getTime() + webhookVerificationTtlMs,
  ).toISOString();

  return writeRealState({
    webhookVerification: {
      expiresAt,
      publicWebhookUrl,
      verifiedAt: verifiedAt.toISOString(),
    },
  });
}

export async function getCurrentWebhookUrl({ explicitUrl } = {}) {
  const state = await readRealState();
  return (
    explicitUrl ??
    state.tunnel?.publicWebhookUrl ??
    process.env.ZOOM_PUBLIC_WEBHOOK_URL?.trim() ??
    null
  );
}

export async function assertVerifiedWebhookState() {
  const state = await readRealState();
  const tunnelUrl = state.tunnel?.publicWebhookUrl;
  const manualUrl = process.env.ZOOM_PUBLIC_WEBHOOK_URL?.trim();
  const expectedUrl = tunnelUrl ?? manualUrl;
  const verification = state.webhookVerification;
  const failures = [];

  if (!expectedUrl) {
    failures.push({
      expected: "URL ngrok registrada ou ZOOM_PUBLIC_WEBHOOK_URL manual",
      item: "publicWebhookUrl",
      where: `${realStatePath} ou ambiente local`,
    });
  }

  if (!verification?.publicWebhookUrl || !verification?.verifiedAt) {
    failures.push({
      expected: "webhook verificado pelo script real-verify",
      item: "webhookVerification",
      where: realStatePath,
    });
  }

  if (
    expectedUrl &&
    verification?.publicWebhookUrl &&
    verification.publicWebhookUrl !== expectedUrl
  ) {
    failures.push({
      expected: "confirmacao vinculada a URL ngrok atual",
      item: "webhookVerification.publicWebhookUrl",
      where: realStatePath,
    });
  }

  if (
    verification?.expiresAt &&
    Date.parse(verification.expiresAt) <= Date.now()
  ) {
    failures.push({
      expected: `confirmacao com menos de ${webhookVerificationTtlMs / 60000} minutos`,
      item: "webhookVerification.expiresAt",
      where: realStatePath,
    });
  }

  return { failures, state };
}

export function isWebhookUrl(value) {
  return /^https:\/\/[^/\s]+\/functions\/v1\/zoom-webhook$/.test(
    String(value ?? ""),
  );
}
