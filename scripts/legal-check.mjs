import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "src/domain/legal/legal-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const strict =
  process.env.TES_LEGAL_STRICT === "1" ||
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";

const issues = [];

const requiredEntityFields = [
  "businessName",
  "cnpj",
  "address",
  "generalEmail",
  "supportEmail",
  "privacyEmail",
  "supportHours",
  "dataController",
  "jurisdictionVenue",
  "lastLegalReview",
];

for (const field of requiredEntityFields) {
  if (!registry.entity?.[field]) {
    issues.push(`LEGAL_ENTITY_MISSING:${field}`);
  }
}

for (const document of registry.documents ?? []) {
  const complete =
    document.status === "published" &&
    document.version &&
    document.approvalDate &&
    document.effectiveDate &&
    document.approver &&
    document.hash &&
    document.canonicalPath;

  if (!complete) {
    issues.push(`LEGAL_DOCUMENT_NOT_PUBLISHABLE:${document.documentKey}`);
  }
}

for (const category of registry.supportMatrix ?? []) {
  const complete =
    category.status === "published" &&
    category.channel &&
    category.supportHours &&
    category.acknowledgement &&
    category.firstResponseTarget &&
    category.resolutionTarget;

  if (!complete) {
    issues.push(`SUPPORT_CATEGORY_NOT_PUBLISHABLE:${category.categoryKey}`);
  }
}

const publicFiles = [
  "src/app/termos/page.tsx",
  "src/app/privacidade/page.tsx",
  "src/components/tes/public-footer.tsx",
  "src/features/public-reservation/components/prepare-form.tsx",
  "src/features/public-reservation/components/reservation-page.tsx",
];

const forbiddenPublicText = [
  "não foi identificado",
  "informações legais pendentes",
  "depende de aprovação",
  "será configurado futuramente",
  "canais externos não foram identificados",
  "prazo razoável",
];

for (const relativeFile of publicFiles) {
  const filePath = path.join(root, relativeFile);
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, "utf8").toLowerCase();
  for (const phrase of forbiddenPublicText) {
    if (content.includes(phrase)) {
      issues.push(`FORBIDDEN_PUBLIC_TEXT:${relativeFile}:${phrase}`);
    }
  }
}

if (issues.length) {
  const heading = strict
    ? "Legal launch gate failed"
    : "Legal launch gate pending";
  console.error(
    `${heading} (${issues.length} issue${issues.length === 1 ? "" : "s"}):`,
  );
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }

  if (strict) {
    process.exit(1);
  }
}

if (!issues.length) {
  console.log("Legal launch gate passed.");
} else {
  console.log(
    "Development mode: legal gate reported launch blockers without failing. Use TES_LEGAL_STRICT=1 for release checks.",
  );
}
