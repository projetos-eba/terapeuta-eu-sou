import { spawnSync } from "node:child_process";

const commands = [
  [
    "deno",
    [
      "test",
      "--config",
      "supabase/functions/deno.json",
      "--allow-env",
      "supabase/functions/_shared/zoom-video-sdk",
    ],
  ],
  ["npx", ["vitest", "run", "src/features/zoom"]],
];

let failed = false;
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { shell: true, stdio: "inherit" });
  if (result.status !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;
