#!/usr/bin/env node

/**
 * Generates a human-readable changelog entry from git diff output.
 * Called by the GitHub Actions workflow after scraping.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CHANGELOG_FILE = path.join(__dirname, "../CHANGELOG.md");

function getChangedFiles() {
  try {
    const output = execSync("git diff --name-only HEAD", { encoding: "utf-8" });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getSummaryForFile(filePath) {
  const filename = path.basename(filePath, ".json");
  const labels = {
    "hubl-variables": "HubL Variables",
    "hubl-filters": "HubL Filters",
    "hubl-functions": "HubL Functions",
    "hubl-tags": "HubL Tags",
    "hubl-syntax": "HubL Syntax",
    "templates": "Templates",
    "modules": "Modules",
    "themes": "Themes",
    "cli-commands": "CLI Commands",
    "hubdb": "HubDB",
    "serverless": "Serverless Functions",
    "last-updated": "Update Timestamps",
  };
  return labels[filename] || filename;
}

function getDiffStats(filePath) {
  try {
    const diff = execSync(`git diff HEAD -- "${filePath}"`, { encoding: "utf-8" });
    const added = (diff.match(/^\+[^+]/gm) || []).length;
    const removed = (diff.match(/^-[^-]/gm) || []).length;
    return { added, removed };
  } catch {
    return { added: 0, removed: 0 };
  }
}

function main() {
  const changedFiles = getChangedFiles().filter((f) => f.startsWith("src/knowledge/"));

  if (changedFiles.length === 0) {
    console.log("No knowledge base changes to log.");
    return;
  }

  const date = new Date().toISOString().split("T")[0];
  const lines = [`\n## ${date} — Automated Knowledge Update\n`];

  changedFiles.forEach((f) => {
    if (f.includes("last-updated")) return;
    const label = getSummaryForFile(f);
    const stats = getDiffStats(f);
    const statStr = stats.added || stats.removed
      ? ` (+${stats.added} / -${stats.removed} lines)`
      : "";
    lines.push(`- **${label}** updated${statStr}`);
  });

  const entry = lines.join("\n") + "\n";

  // Prepend to CHANGELOG
  let existing = "";
  if (fs.existsSync(CHANGELOG_FILE)) {
    existing = fs.readFileSync(CHANGELOG_FILE, "utf-8");
    // Remove existing header if present
    existing = existing.replace(/^# Changelog\n\n?/, "");
  }

  fs.writeFileSync(CHANGELOG_FILE, `# Changelog\n${entry}\n${existing}`, "utf-8");
  console.log("Changelog updated.");
  console.log(entry);
}

main();
