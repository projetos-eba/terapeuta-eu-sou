import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { onlineOnlyPolicyConfig } from "./online-only-policy.config.mjs";

const root = process.cwd();

function toProjectPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function matches(patterns, projectPath) {
  return patterns.some((entry) => entry.pathPattern.test(projectPath));
}

function isExcluded(projectPath) {
  return onlineOnlyPolicyConfig.excludedPathPatterns.some((pattern) =>
    pattern.test(projectPath),
  );
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const projectPath = toProjectPath(fullPath);
    if (isExcluded(projectPath)) continue;

    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
      continue;
    }

    if (
      onlineOnlyPolicyConfig.fileExtensions.includes(path.extname(entry.name))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberForIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

function reportViolation(violation) {
  return `${violation.projectPath}:${violation.line} ${violation.type}: ${violation.snippet}`;
}

const rootFiles = ["AGENTS.md", "README.md"].map((file) =>
  path.join(root, file),
);
const files = [
  ...rootFiles,
  ...(await listFiles(path.join(root, "docs"))),
  ...(await listFiles(path.join(root, "skills"))),
  ...(await listFiles(path.join(root, "src"))),
  ...(await listFiles(path.join(root, "supabase", "functions"))),
  ...(await listFiles(path.join(root, "supabase", "tests"))),
];

const violations = [];

for (const file of files) {
  const projectPath = toProjectPath(file);
  if (matches(onlineOnlyPolicyConfig.allowedPathPatterns, projectPath)) {
    continue;
  }

  const content = await readFile(file, "utf8");

  for (const blocked of onlineOnlyPolicyConfig.blockedPatterns) {
    for (const match of content.matchAll(blocked.pattern)) {
      violations.push({
        line: lineNumberForIndex(content, match.index ?? 0),
        projectPath,
        snippet: match[0],
        type: blocked.type,
      });
    }
  }
}

if (violations.length) {
  console.error("Política online-only TES encontrou violações:");
  console.error(violations.map(reportViolation).join("\n"));
  console.error(
    "\nRemova a opção não-online ou registre uma exceção pequena e justificada em scripts/online-only-policy.config.mjs.",
  );
  process.exit(1);
}

console.log("Política online-only TES: sem violações fora da allowlist.");
