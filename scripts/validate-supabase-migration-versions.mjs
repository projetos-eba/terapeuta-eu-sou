import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const migrationsDirectory = path.join(process.cwd(), "supabase", "migrations");
const filenamePattern = /^(?<version>\d{14})_(?<name>.+)\.sql$/;

const entries = await readdir(migrationsDirectory, { withFileTypes: true });
const migrationFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

const invalidFiles = [];
const invalidLockTransactions = [];
const filesByVersion = new Map();

for (const filename of migrationFiles) {
  const match = filename.match(filenamePattern);
  if (!match?.groups) {
    invalidFiles.push(filename);
    continue;
  }

  const versionFiles = filesByVersion.get(match.groups.version) ?? [];
  versionFiles.push(filename);
  filesByVersion.set(match.groups.version, versionFiles);

  const migration = await readFile(
    path.join(migrationsDirectory, filename),
    "utf8",
  );
  const lockMatch = /^\s*lock\s+table\b/im.exec(migration);
  if (lockMatch) {
    const transactionBegin = /^\s*begin\s*;/im.exec(migration);
    const endsWithCommit = /(?:^|\r?\n)\s*commit\s*;\s*$/i.test(migration);

    if (
      !transactionBegin ||
      transactionBegin.index > lockMatch.index ||
      !endsWithCommit
    ) {
      invalidLockTransactions.push(filename);
    }
  }
}

const duplicateVersions = [...filesByVersion.entries()].filter(
  ([, files]) => files.length > 1,
);

if (
  invalidFiles.length ||
  duplicateVersions.length ||
  invalidLockTransactions.length
) {
  console.error("Supabase migration version validation failed.");

  if (invalidFiles.length) {
    console.error("Invalid migration filenames:");
    for (const filename of invalidFiles) console.error(`- ${filename}`);
  }

  if (duplicateVersions.length) {
    console.error("Duplicate migration versions:");
    for (const [version, files] of duplicateVersions) {
      console.error(`- ${version}: ${files.join(", ")}`);
    }
  }

  if (invalidLockTransactions.length) {
    console.error("LOCK TABLE outside an explicit transaction:");
    for (const filename of invalidLockTransactions) {
      console.error(`- ${filename}`);
    }
  }

  process.exit(1);
}

console.log(
  `Supabase migrations: ${migrationFiles.length} filenames valid with unique versions.`,
);
