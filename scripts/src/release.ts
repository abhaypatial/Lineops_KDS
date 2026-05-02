#!/usr/bin/env tsx
/**
 * LineOps KDS — Release script
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run release -- patch
 *   pnpm --filter @workspace/scripts run release -- minor
 *   pnpm --filter @workspace/scripts run release -- major
 *   pnpm --filter @workspace/scripts run release -- 2.1.0
 *
 * What it does:
 *   1. Reads the current version from the root package.json
 *   2. Calculates the new version
 *   3. Updates all workspace package.json files
 *   4. Prepends a new entry template to CHANGELOG.md
 *   5. Prints the git commands to tag and push the release
 */

import fs   from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dirname, "../..");

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath: string, data: Record<string, unknown>): void {
  const existing = fs.readFileSync(filePath, "utf8");
  const indent   = existing.startsWith("{\n  ") ? 2 : 2;
  fs.writeFileSync(filePath, JSON.stringify(data, null, indent) + "\n", "utf8");
}

function bump(current: string, part: "patch" | "minor" | "major"): string {
  const [maj, min, pat] = current.split(".").map(Number);
  if (part === "major") return `${maj + 1}.0.0`;
  if (part === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function isValidSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Parse arguments ───────────────────────────────────────────────────────────

const arg = process.argv[2];

if (!arg || arg === "--help" || arg === "-h") {
  console.log(`
  Usage:  release <patch|minor|major|x.y.z>

  Examples:
    release patch       1.0.0 → 1.0.1
    release minor       1.0.0 → 1.1.0
    release major       1.0.0 → 2.0.0
    release 1.2.3       set an exact version
`);
  process.exit(0);
}

// ── Resolve version ───────────────────────────────────────────────────────────

const rootPkg  = readJson(path.join(ROOT, "package.json"));
const current  = rootPkg.version as string;

let next: string;
if (arg === "patch" || arg === "minor" || arg === "major") {
  next = bump(current, arg);
} else if (isValidSemver(arg)) {
  next = arg;
} else {
  console.error(`\n  Error: "${arg}" is not a valid bump type or semver version.\n`);
  process.exit(1);
}

console.log(`\n  Bumping:  ${current}  →  ${next}\n`);

// ── Find all workspace package.json files ────────────────────────────────────

const pkgGlobs = [
  "package.json",
  "artifacts/*/package.json",
  "lib/*/package.json",
  "scripts/package.json",
];

const allPkgFiles: string[] = [];
for (const pattern of pkgGlobs) {
  if (pattern.includes("*")) {
    const dir = path.join(ROOT, path.dirname(pattern));
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      const candidate = path.join(dir, entry, "package.json");
      if (fs.existsSync(candidate)) allPkgFiles.push(candidate);
    }
  } else {
    const candidate = path.join(ROOT, pattern);
    if (fs.existsSync(candidate)) allPkgFiles.push(candidate);
  }
}

// ── Update versions ───────────────────────────────────────────────────────────

for (const pkgFile of allPkgFiles) {
  const pkg = readJson(pkgFile);
  if ("version" in pkg) {
    pkg.version = next;
    writeJson(pkgFile, pkg);
    console.log(`  ✓  ${path.relative(ROOT, pkgFile)}`);
  }
}

// ── Prepend CHANGELOG entry ───────────────────────────────────────────────────

const changelogPath = path.join(ROOT, "CHANGELOG.md");

if (fs.existsSync(changelogPath)) {
  const existing = fs.readFileSync(changelogPath, "utf8");

  const newEntry = `## [${next}] - ${today()}

### Added
- 

### Changed
- 

### Fixed
- 

### Removed
- 

---

`;

  // Insert after the [Unreleased] section (after its first blank line)
  const updated = existing.replace(
    /## \[Unreleased\]\n\n---\n/,
    `## [Unreleased]\n\n---\n\n${newEntry}`
  );

  // Update comparison links at the bottom
  const withLinks = updated
    .replace(
      /\[Unreleased\]:.*compare\/v(.+)\.\.\.HEAD/,
      `[Unreleased]: https://github.com/your-org/lineops-kds/compare/v${next}...HEAD`
    )
    .replace(
      new RegExp(`\\[${next}\\]:.*`),
      ""   // remove duplicate if re-running
    );

  const linkLine = `[${next}]: https://github.com/your-org/lineops-kds/releases/tag/v${next}`;
  const finalContent = withLinks.trimEnd() + "\n" + linkLine + "\n";

  fs.writeFileSync(changelogPath, finalContent, "utf8");
  console.log(`\n  ✓  CHANGELOG.md — new entry for ${next} prepended`);
} else {
  console.log("  ⚠  CHANGELOG.md not found — skipping");
}

// ── Print git commands ────────────────────────────────────────────────────────

console.log(`
  Next steps — run these to tag and push the release:

    git add -A
    git commit -m "chore: release v${next}"
    git tag v${next}
    git push && git push --tags

  Or with GitHub CLI:
    gh release create v${next} --generate-notes
`);
