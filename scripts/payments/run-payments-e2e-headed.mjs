#!/usr/bin/env node

import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";

const cwd = process.cwd();
const requestedBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const requestedPort = Number(process.env.PORT || 3000);
let startedProcess = null;

try {
  let baseUrl = requestedBaseUrl;

  if (!(await isAppReady(baseUrl))) {
    const existingBaseUrl = await findReadyBaseUrl(requestedPort);
    if (existingBaseUrl) {
      baseUrl = existingBaseUrl;
    }
  }

  if (!(await isAppReady(baseUrl))) {
    const port = await getFreePort(requestedPort);
    baseUrl = `http://127.0.0.1:${port}`;
    await mkdir(".playwright-mcp", { recursive: true });

    startedProcess = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
      {
        cwd,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    startedProcess.stdout.pipe(process.stdout);
    startedProcess.stderr.pipe(process.stderr);

    const ready = await waitForApp(baseUrl, 45_000);
    if (!ready) {
      throw new Error(`Next dev server did not become ready at ${baseUrl}.`);
    }
  }

  const result = await runCommand(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "playwright",
      "test",
      "tests/e2e/payments-checkout.spec.ts",
      "--project=chromium",
      "--headed",
    ],
    {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseUrl,
      PLAYWRIGHT_HEADLESS: "false",
    },
  );

  process.exitCode = result;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (startedProcess && !startedProcess.killed) {
    startedProcess.kill("SIGTERM");
  }
}

async function isAppReady(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

async function waitForApp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isAppReady(url)) return true;
    await delay(1000);
  }
  return false;
}

async function getFreePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  return getSystemAssignedPort();
}

async function findReadyBaseUrl(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    const url = `http://127.0.0.1:${port}`;
    if (await isAppReady(url)) return url;
  }

  return null;
}

function getSystemAssignedPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.once("listening", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }

        reject(new Error("Could not allocate a local port for the Next dev server."));
      });
    });
    server.listen(0, "127.0.0.1");
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function runCommand(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
