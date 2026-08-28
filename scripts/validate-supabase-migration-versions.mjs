import { readdir } from "node:fs/promises";
import path from "node:path";

const migrationsDirectory = path.join(process.cwd(), "supabase", "migrations");
const filenamePattern = /^(?<version>\d{14})_(?<name>.+)\.sql$/;

const entries = await readdir(migrationsDirectory, { withFileTypes: true });
const migrationFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

const invalidFiles = [];
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
}

const duplicateVersions = [...filesByVersion.entries()].filter(
  ([, files]) => files.length > 1,
);

if (invalidFiles.length || duplicateVersions.length) {
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

  process.exit(1);
}

console.log(
  `Supabase migrations: ${migrationFiles.length} filenames valid with unique versions.`,
);
