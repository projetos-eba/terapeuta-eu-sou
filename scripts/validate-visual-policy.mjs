import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { visualPolicyConfig } from "./visual-policy.config.mjs";

const root = process.cwd();

function toProjectPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function matches(patterns, projectPath) {
  return patterns.some((entry) => entry.pathPattern.test(projectPath));
}

function isExcluded(projectPath) {
  return visualPolicyConfig.excludedPathPatterns.some((pattern) =>
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

    if (visualPolicyConfig.fileExtensions.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberForIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

function collectMatches(content, regex, projectPath, type) {
  const matches = [];
  for (const match of content.matchAll(regex)) {
    const line = lineNumberForIndex(content, match.index ?? 0);
    matches.push({
      line,
      projectPath,
      snippet: match[0],
      type,
    });
  }
  return matches;
}

function reportViolation(violation) {
  return `${violation.projectPath}:${violation.line} ${violation.type}: ${violation.snippet}`;
}

const files = [
  ...(await listFiles(path.join(root, "src"))),
  ...(await listFiles(path.join(root, "supabase", "functions"))),
  ...(await listFiles(path.join(root, "docs"))),
];

const violations = [];

for (const file of files) {
  const projectPath = toProjectPath(file);
  const content = await readFile(file, "utf8");

  const smallTextMatches = collectMatches(
    content,
    /text-\[(\d+(?:\.\d+)?)(px|rem)\]|font-size:\s*(\d+(?:\.\d+)?)(px|rem)/gi,
    projectPath,
    "font-size abaixo de 10px",
  ).filter((match) => {
    const value = Number(match.snippet.match(/\d+(?:\.\d+)?/)?.[0] ?? 999);
    const isRem = match.snippet.toLowerCase().includes("rem");
    const size = isRem ? value * 16 : value;
    return size < 10;
  });

  if (
    smallTextMatches.length &&
    !matches(visualPolicyConfig.minFontSizeAllowlist, projectPath)
  ) {
    violations.push(...smallTextMatches);
  }

  const hexMatches = collectMatches(
    content,
    /#[0-9a-f]{3,8}\b/gi,
    projectPath,
    "hex hardcoded fora da allowlist",
  );

  if (
    hexMatches.length &&
    !matches(visualPolicyConfig.hardcodedHexAllowlist, projectPath)
  ) {
    violations.push(...hexMatches);
  }
}

if (violations.length) {
  console.error("Política visual TES encontrou violações:");
  console.error(violations.map(reportViolation).join("\n"));
  console.error(
    "\nUse tokens TES ou registre uma exceção pequena e justificada em scripts/visual-policy.config.mjs.",
  );
  process.exit(1);
}

console.log("Política visual TES: sem violações fora da allowlist.");
