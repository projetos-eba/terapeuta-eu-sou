#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  allSnapshotEvents,
  connectThinEvents,
} from "./stripe-webhook-events.mjs";

const connectUrl = "http://127.0.0.1:54321/functions/v1/stripe-connect-webhook";
const child = spawn(
  "stripe",
  [
    "listen",
    "--skip-update",
    "--events",
    allSnapshotEvents.join(","),
    "--thin-events",
    connectThinEvents.join(","),
    "--forward-to",
    "http://127.0.0.1:54321/functions/v1/stripe-billing-webhook",
    "--forward-connect-to",
    connectUrl,
    "--forward-thin-to",
    connectUrl,
    "--forward-thin-connect-to",
    connectUrl,
  ],
  { stdio: ["inherit", "pipe", "pipe"] },
);

for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    process.stdout.write(
      String(chunk).replace(
        /whsec_[A-Za-z0-9_]+/g,
        "[redacted-stripe-webhook-secret]",
      ),
    );
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.once("exit", (code) => process.exit(code ?? 1));
