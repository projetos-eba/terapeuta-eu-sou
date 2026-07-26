import fs from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertVerifiedWebhookState,
  isWebhookUrl,
  readRealState,
  realStatePath,
  recordTunnelState,
  recordWebhookVerification,
} from "./video-sdk-real-state.mjs";

describe("zoom real homologation state", () => {
  const originalUrl = process.env.ZOOM_PUBLIC_WEBHOOK_URL;
  let originalState = null;

  beforeEach(async () => {
    originalState = await fs.readFile(realStatePath, "utf8").catch(() => null);
    delete process.env.ZOOM_PUBLIC_WEBHOOK_URL;
    await fs.rm(realStatePath, { force: true });
  });

  afterEach(async () => {
    if (originalUrl === undefined) {
      delete process.env.ZOOM_PUBLIC_WEBHOOK_URL;
    } else {
      process.env.ZOOM_PUBLIC_WEBHOOK_URL = originalUrl;
    }
    if (originalState) {
      await fs.writeFile(realStatePath, originalState);
    } else {
      await fs.rm(realStatePath, { force: true });
    }
  });

  it("records tunnel URL and a short-lived verification without secrets", async () => {
    const publicWebhookUrl =
      "https://example.ngrok-free.app/functions/v1/zoom-webhook";

    await recordTunnelState({
      localBaseUrl: "http://127.0.0.1:54321",
      publicBaseUrl: "https://example.ngrok-free.app",
      publicWebhookUrl,
    });
    await recordWebhookVerification({ publicWebhookUrl });

    const state = await readRealState();
    expect(state.tunnel.publicWebhookUrl).toBe(publicWebhookUrl);
    expect(state.webhookVerification.publicWebhookUrl).toBe(publicWebhookUrl);
    expect(JSON.stringify(state)).not.toMatch(/secret|token|password|jwt/i);
    await expect(assertVerifiedWebhookState()).resolves.toMatchObject({
      failures: [],
    });
  });

  it("rejects a verification linked to another ngrok URL", async () => {
    await recordTunnelState({
      localBaseUrl: "http://127.0.0.1:54321",
      publicBaseUrl: "https://first.ngrok-free.app",
      publicWebhookUrl:
        "https://first.ngrok-free.app/functions/v1/zoom-webhook",
    });
    await recordWebhookVerification({
      publicWebhookUrl:
        "https://other.ngrok-free.app/functions/v1/zoom-webhook",
    });

    const result = await assertVerifiedWebhookState();
    expect(result.failures).toContainEqual(
      expect.objectContaining({
        item: "webhookVerification.publicWebhookUrl",
      }),
    );
  });

  it("accepts the manual public webhook URL only after verification", async () => {
    process.env.ZOOM_PUBLIC_WEBHOOK_URL =
      "https://manual.ngrok-free.app/functions/v1/zoom-webhook";

    let result = await assertVerifiedWebhookState();
    expect(result.failures).toContainEqual(
      expect.objectContaining({ item: "webhookVerification" }),
    );

    await recordWebhookVerification({
      publicWebhookUrl: process.env.ZOOM_PUBLIC_WEBHOOK_URL,
    });
    result = await assertVerifiedWebhookState();
    expect(result.failures).toEqual([]);
  });

  it("validates webhook URL shape", () => {
    expect(
      isWebhookUrl("https://example.ngrok-free.app/functions/v1/zoom-webhook"),
    ).toBe(true);
    expect(isWebhookUrl("http://example.test/functions/v1/zoom-webhook")).toBe(
      false,
    );
  });
});
