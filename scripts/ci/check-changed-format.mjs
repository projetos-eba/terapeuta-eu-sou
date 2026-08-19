import { execFileSync } from "node:child_process";

const formatBaseRef = process.env.FORMAT_BASE_REF?.trim();
const supportedFile = /\.(?:[cm]?[jt]sx?|json|md|ya?ml|css|html)$/i;

const baseRef =
  formatBaseRef && !/^0+$/.test(formatBaseRef)
    ? formatBaseRef
    : resolveFallbackBaseRef();
const changedFiles = listChangedFiles(baseRef).filter((file) =>
  supportedFile.test(file),
);

if (changedFiles.length === 0) {
  console.log("No Prettier-supported files changed in this revision.");
  process.exit(0);
}

console.log(
  `Checking Prettier formatting for ${changedFiles.length} changed file(s).`,
);
execFileSync("npx", ["prettier", "--check", ...changedFiles], {
  stdio: "inherit",
});

function resolveFallbackBaseRef() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD^"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "HEAD";
  }
}

function listChangedFiles(base) {
  const range = `${base}...HEAD`;

  return execFileSync(
    "git",
    ["diff", "--diff-filter=ACMR", "--name-only", range],
    { encoding: "utf8" },
  )
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}
