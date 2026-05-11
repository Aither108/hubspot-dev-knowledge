#!/usr/bin/env node

/**
 * HubSpot Docs Scraper
 * Uses Playwright to fetch JS-rendered HubSpot documentation pages,
 * extracts structured data (tables, code blocks, headings), and updates
 * the knowledge base JSON files.
 *
 * Run: node scripts/scraper.js
 * CI:  Called by .github/workflows/update-knowledge.yml
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = path.join(__dirname, "../src/knowledge");
const LAST_UPDATED_FILE = path.join(__dirname, "../src/knowledge/last-updated.json");

// ─── Page definitions ────────────────────────────────────────────────────────

const PAGES = [
  {
    url: "https://developers.hubspot.com/docs/cms/hubl/variables",
    file: "hubl-variables.json",
    parser: parseVariablesPage,
  },
  {
    url: "https://developers.hubspot.com/docs/cms/hubl/filters",
    file: "hubl-filters.json",
    parser: parseFiltersPage,
  },
  {
    url: "https://developers.hubspot.com/docs/cms/hubl/functions",
    file: "hubl-functions.json",
    parser: parseFunctionsPage,
  },
  {
    url: "https://developers.hubspot.com/docs/cms/hubl/tags",
    file: "hubl-tags.json",
    parser: parseTagsPage,
  },
  {
    url: "https://developers.hubspot.com/docs/cms/hubl/operators-and-expression-tests",
    file: "hubl-syntax.json",
    parser: parseOperatorsPage,
    mergeKey: "operators_and_tests",
  },
  {
    url: "https://developers.hubspot.com/docs/cms/developer-reference/local-development-cms-cli",
    file: "cli-commands.json",
    parser: parseCLIPage,
  },
  {
    url: "https://developers.hubspot.com/docs/cms/data/hubdb",
    file: "hubdb.json",
    parser: parseHubDBPage,
  },
  {
    url: "https://developers.hubspot.com/docs/cms/data/serverless-functions",
    file: "serverless.json",
    parser: parseServerlessPage,
  },
  {
    url: "https://developers.hubspot.com/docs/cms/building-blocks/modules/module-field-types",
    file: "modules.json",
    parser: parseModuleFieldsPage,
    mergeKey: "field_types_scraped",
  },
  {
    url: "https://developers.hubspot.com/docs/cms/building-blocks/templates/overview",
    file: "templates.json",
    parser: parseTemplatesPage,
    mergeKey: "template_types_scraped",
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Starting HubSpot docs scraper...\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const changes = [];
  const lastUpdated = loadLastUpdated();

  for (const pageDef of PAGES) {
    console.log(`📄 Scraping: ${pageDef.url}`);
    try {
      const page = await context.newPage();

      await page.goto(pageDef.url, { waitUntil: "networkidle", timeout: 60000 });

      // Wait for main content to render
      await page
        .waitForSelector("article, main, [class*='content'], [class*='docs']", { timeout: 20000 })
        .catch(() => console.log("  ⚠ Content selector timeout — using body"));

      // Give JS extra time to hydrate
      await page.waitForTimeout(2000);

      // Extract page data
      const extracted = await pageDef.parser(page);

      if (extracted && Object.keys(extracted).length > 0) {
        const changed = mergeIntoKnowledge(pageDef.file, extracted, pageDef.mergeKey);
        if (changed) {
          changes.push(pageDef.file);
          console.log(`  ✅ Updated: ${pageDef.file}`);
        } else {
          console.log(`  ✓ No changes: ${pageDef.file}`);
        }
        lastUpdated[pageDef.file] = new Date().toISOString();
      } else {
        console.log(`  ⚠ No data extracted from ${pageDef.url}`);
      }

      await page.close();
    } catch (err) {
      console.error(`  ❌ Error scraping ${pageDef.url}:`, err.message);
    }
  }

  await browser.close();

  // Save last-updated timestamps
  saveLastUpdated(lastUpdated);

  // Summary
  console.log(`\n${"─".repeat(60)}`);
  if (changes.length > 0) {
    console.log(`✅ ${changes.length} file(s) updated:`);
    changes.forEach((f) => console.log(`   • ${f}`));
    // Signal to CI that changes were made
    fs.writeFileSync(path.join(__dirname, "../.changes-detected"), changes.join("\n"));
  } else {
    console.log("✓ Knowledge base is up to date. No changes detected.");
  }

  process.exit(0);
}

// ─── Helper: Extract tables from page ────────────────────────────────────────

async function extractTables(page) {
  return await page.evaluate(() => {
    const tables = [];
    document.querySelectorAll("table").forEach((table) => {
      const headers = Array.from(table.querySelectorAll("thead th, thead td")).map((th) =>
        th.innerText.trim().toLowerCase().replace(/\s+/g, "_")
      );
      if (headers.length === 0) return;

      const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) => {
        const cells = Array.from(tr.querySelectorAll("td, th")).map((td) => td.innerText.trim());
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = cells[i] || "";
        });
        return obj;
      });

      tables.push({ headers, rows });
    });
    return tables;
  });
}

async function extractCodeBlocks(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll("pre code, .code-block, [class*='language-']")).map(
      (el) => el.innerText.trim()
    );
  });
}

async function extractHeadingsWithContent(page) {
  return await page.evaluate(() => {
    const sections = [];
    const headings = document.querySelectorAll("h2, h3, h4");
    headings.forEach((h) => {
      const text = h.innerText.trim();
      if (text) sections.push({ level: h.tagName, text });
    });
    return sections;
  });
}

async function extractMainText(page) {
  return await page.evaluate(() => {
    const main =
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.querySelector('[class*="content"]') ||
      document.body;
    return main ? main.innerText.trim() : "";
  });
}

// ─── Page Parsers ────────────────────────────────────────────────────────────

async function parseVariablesPage(page) {
  const tables = await extractTables(page);
  const headings = await extractHeadingsWithContent(page);
  const mainText = await extractMainText(page);

  // Build sections from tables found near headings
  const result = { scraped_sections: {}, raw_table_count: tables.length };

  // Map tables by their probable section based on content
  tables.forEach((table, i) => {
    if (table.rows.length === 0) return;
    const firstRow = table.rows[0];
    const keys = Object.keys(firstRow);

    // Detect variable tables: have variable/name + type + description columns
    const hasName = keys.some((k) => k.includes("variable") || k.includes("name"));
    const hasType = keys.some((k) => k.includes("type"));
    const hasDesc = keys.some((k) => k.includes("description") || k.includes("desc"));

    if (hasName && hasType && hasDesc) {
      const sectionLabel = headings[i] ? headings[i].text : `section_${i}`;
      const variables = table.rows.map((row) => {
        const name = row[keys.find((k) => k.includes("variable") || k.includes("name"))] || "";
        const type = row[keys.find((k) => k.includes("type"))] || "";
        const description =
          row[keys.find((k) => k.includes("description") || k.includes("desc"))] || "";
        return { name, type, description };
      }).filter((v) => v.name);

      if (variables.length > 0) {
        const key = sectionLabel.toLowerCase().replace(/\s+/g, "_").substring(0, 40);
        result.scraped_sections[key] = { label: sectionLabel, variables };
      }
    }
  });

  // Extract cache-disabling note from text
  if (mainText.includes("disable") && mainText.includes("cache")) {
    const match = mainText.match(/following variables[^:]*:\s*([^\n]+)/i);
    if (match) {
      result.cache_note = match[1].trim();
    }
  }

  return result;
}

async function parseFiltersPage(page) {
  const tables = await extractTables(page);
  const filters = [];

  tables.forEach((table) => {
    const keys = Object.keys(table.rows[0] || {});
    const hasFilter = keys.some((k) => k.includes("filter") || k.includes("name"));
    const hasSyntax = keys.some((k) => k.includes("syntax"));

    if (!hasFilter) return;

    table.rows.forEach((row) => {
      const name =
        row[keys.find((k) => k.includes("filter") || k.includes("name"))] || "";
      const syntax = row[keys.find((k) => k.includes("syntax"))] || "";
      const params = row[keys.find((k) => k.includes("param"))] || "";
      const returns = row[keys.find((k) => k.includes("return"))] || "";
      const description =
        row[keys.find((k) => k.includes("description") || k.includes("desc"))] || "";
      const example = row[keys.find((k) => k.includes("example"))] || "";

      if (name && name !== "Filter") {
        filters.push({ name: name.replace(/\*\*/g, "").trim(), syntax, params, returns, description, example });
      }
    });
  });

  return filters.length > 0 ? { scraped_filters: filters } : {};
}

async function parseFunctionsPage(page) {
  const headings = await extractHeadingsWithContent(page);
  const codeBlocks = await extractCodeBlocks(page);
  const mainText = await extractMainText(page);

  // Extract function names and signatures from headings and text
  const functions = [];
  const fnPattern = /\*\*(\w+)\*\*[\s\S]*?Syntax[:\s]+`([^`]+)`/g;
  let match;

  while ((match = fnPattern.exec(mainText)) !== null) {
    functions.push({
      name: match[1],
      syntax: match[2],
    });
  }

  // Also pull from h3/h4 headings that look like function names
  headings.forEach((h) => {
    if (h.level === "H3" || h.level === "H4") {
      const name = h.text.replace(/[^a-zA-Z0-9_]/g, "");
      if (name && !functions.find((f) => f.name === name)) {
        functions.push({ name, syntax: `${name}(...)` });
      }
    }
  });

  // Get limits and notes from text
  const limits = [];
  const limitPattern = /(\d+)\s+(calls?|functions?|posts?|authors?|tags?)[^.]+per[^.]+\./gi;
  let lmatch;
  while ((lmatch = limitPattern.exec(mainText)) !== null) {
    limits.push(lmatch[0].trim());
  }

  return functions.length > 0 ? { scraped_functions: functions, scraped_limits: limits } : {};
}

async function parseTagsPage(page) {
  const headings = await extractHeadingsWithContent(page);
  const codeBlocks = await extractCodeBlocks(page);
  const mainText = await extractMainText(page);

  const tags = [];

  // Extract tag syntax patterns from code blocks
  codeBlocks.forEach((code) => {
    const tagMatch = code.match(/\{%\s+(\w+)\s/);
    if (tagMatch) {
      const existing = tags.find((t) => t.name === tagMatch[1]);
      if (!existing) {
        tags.push({ name: tagMatch[1], syntax: code.split("\n")[0].trim() });
      }
    }
  });

  // Get parameter tables
  const tables = await extractTables(page);
  tables.forEach((table) => {
    const paramKey = Object.keys(table.rows[0] || {}).find((k) => k.includes("param"));
    const descKey = Object.keys(table.rows[0] || {}).find(
      (k) => k.includes("desc") || k.includes("description")
    );
    if (paramKey && table.rows.length > 0) {
      table.rows.forEach((row) => {
        // Merge into existing tags if possible
      });
    }
  });

  return tags.length > 0 ? { scraped_tags: tags } : {};
}

async function parseOperatorsPage(page) {
  const tables = await extractTables(page);
  const operators = [];
  const tests = [];

  tables.forEach((table) => {
    const keys = Object.keys(table.rows[0] || {});
    const hasOperator = keys.some((k) => k.includes("operator") || k.includes("test"));

    if (!hasOperator) return;

    const isTest = keys.some((k) => k.includes("test"));

    table.rows.forEach((row) => {
      const op = row[keys.find((k) => k.includes("operator") || k.includes("test"))] || "";
      const desc = row[keys.find((k) => k.includes("desc") || k.includes("purpose") || k.includes("behavior"))] || "";
      const example = row[keys.find((k) => k.includes("example"))] || "";

      if (op) {
        const entry = { operator: op.replace(/\*\*/g, "").trim(), description: desc, example };
        if (isTest) tests.push(entry);
        else operators.push(entry);
      }
    });
  });

  return { scraped_operators: operators, scraped_tests: tests };
}

async function parseCLIPage(page) {
  const tables = await extractTables(page);
  const commands = [];

  tables.forEach((table) => {
    const keys = Object.keys(table.rows[0] || {});
    const cmdKey = keys.find((k) => k.includes("command"));
    const descKey = keys.find((k) => k.includes("desc") || k.includes("description"));

    if (!cmdKey) return;

    table.rows.forEach((row) => {
      const command = row[cmdKey] || "";
      const description = row[descKey] || "";
      if (command && command !== "Command") {
        commands.push({ command: command.replace(/`/g, "").trim(), description });
      }
    });
  });

  return commands.length > 0 ? { scraped_commands: commands } : {};
}

async function parseHubDBPage(page) {
  const tables = await extractTables(page);
  const mainText = await extractMainText(page);
  const result = {};

  // Extract column types from tables
  tables.forEach((table) => {
    const keys = Object.keys(table.rows[0] || {});
    if (keys.some((k) => k.includes("type") || k.includes("column"))) {
      result.scraped_column_types = table.rows.map(
        (r) => r[Object.keys(r)[0]]
      ).filter(Boolean);
    }
  });

  // Extract limits from text
  const limitMatches = [];
  const patterns = [
    /(\d[\d,]*)\s+tables?\s+maximum/gi,
    /(\d[\d,]*)\s+rows?\s+(per|maximum)/gi,
    /(\d+)\s+columns?\s+maximum/gi,
    /(\d+,\d+)\s+characters?/gi,
  ];
  patterns.forEach((p) => {
    let m;
    while ((m = p.exec(mainText)) !== null) {
      limitMatches.push(m[0].trim());
    }
  });
  if (limitMatches.length > 0) result.scraped_limits = [...new Set(limitMatches)];

  return Object.keys(result).length > 0 ? result : {};
}

async function parseServerlessPage(page) {
  const codeBlocks = await extractCodeBlocks(page);
  const mainText = await extractMainText(page);
  const result = {};

  // Extract limits
  const limitPatterns = [
    /(\d+)[- ]second/gi,
    /(\d+)\s+MB/gi,
    /(\d+)\s+endpoint/gi,
    /(\d+)\s+secret/gi,
    /(\d+)\s+execution seconds/gi,
  ];
  const limits = [];
  limitPatterns.forEach((p) => {
    let m;
    while ((m = p.exec(mainText)) !== null) {
      limits.push(m[0].trim());
    }
  });
  if (limits.length > 0) result.scraped_limits = [...new Set(limits)];

  // Extract code examples
  const jsExamples = codeBlocks.filter(
    (c) => c.includes("exports.main") || c.includes("async context") || c.includes("statusCode")
  );
  if (jsExamples.length > 0) result.scraped_examples = jsExamples;

  return Object.keys(result).length > 0 ? result : {};
}

async function parseModuleFieldsPage(page) {
  const tables = await extractTables(page);
  const headings = await extractHeadingsWithContent(page);
  const codeBlocks = await extractCodeBlocks(page);
  const fieldTypes = [];

  // Try to extract field type definitions
  headings.forEach((h, i) => {
    if (h.level === "H2" || h.level === "H3") {
      const name = h.text.trim();
      const relatedCode = codeBlocks[i] || "";
      if (name && !name.toLowerCase().includes("overview") && !name.toLowerCase().includes("introduction")) {
        fieldTypes.push({
          type: name.toLowerCase().replace(/\s+/g, "_"),
          label: name,
          example_code: relatedCode.substring(0, 500),
        });
      }
    }
  });

  // Extract property tables
  tables.forEach((table, i) => {
    const keys = Object.keys(table.rows[0] || {});
    const propKey = keys.find((k) => k.includes("property") || k.includes("param") || k.includes("field"));
    const typeKey = keys.find((k) => k.includes("type"));
    const descKey = keys.find((k) => k.includes("desc") || k.includes("description"));

    if (propKey && table.rows.length > 0 && fieldTypes[i]) {
      fieldTypes[i].properties = table.rows.map((r) => ({
        property: r[propKey] || "",
        type: r[typeKey] || "",
        description: r[descKey] || "",
      }));
    }
  });

  return fieldTypes.length > 0 ? { scraped_field_types: fieldTypes } : {};
}

async function parseTemplatesPage(page) {
  const tables = await extractTables(page);
  const headings = await extractHeadingsWithContent(page);
  const templateTypes = [];

  tables.forEach((table) => {
    const keys = Object.keys(table.rows[0] || {});
    const typeKey = keys.find((k) => k.includes("template") || k.includes("type") || k.includes("name"));
    const annotKey = keys.find((k) => k.includes("annotation") || k.includes("value"));
    const descKey = keys.find((k) => k.includes("desc") || k.includes("purpose"));

    if (!typeKey) return;

    table.rows.forEach((row) => {
      const type = row[typeKey] || "";
      const annotation = row[annotKey] || "";
      const description = row[descKey] || "";
      if (type && type !== "Template Type") {
        templateTypes.push({
          type: type.replace(/\*\*/g, "").trim(),
          annotation: annotation.trim(),
          description: description.trim(),
        });
      }
    });
  });

  return templateTypes.length > 0 ? { scraped_template_types: templateTypes } : {};
}

// ─── Knowledge merge ──────────────────────────────────────────────────────────

function mergeIntoKnowledge(filename, newData, mergeKey) {
  const filePath = path.join(KNOWLEDGE_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠ Knowledge file not found: ${filename}`);
    return false;
  }

  const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const existingStr = JSON.stringify(existing);

  if (mergeKey) {
    // Merge into a specific key
    existing[mergeKey] = newData;
  } else {
    // Merge scraped data under a 'scraped' top-level key
    existing.scraped = newData;
    existing.last_scraped = new Date().toISOString();
  }

  // Deep-merge new data into existing where applicable
  // For arrays: add new items that don't exist (by name)
  mergeArrays(existing, newData);

  const newStr = JSON.stringify(existing);
  if (newStr === existingStr) return false;

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf-8");
  return true;
}

function mergeArrays(target, source) {
  if (!source || typeof source !== "object") return;

  // Look for scraped arrays that can extend existing ones
  const arrayMergeMap = {
    scraped_filters: "filters",
    scraped_functions: "functions",
    scraped_tags: "tags",
    scraped_commands: null, // handled via groups
    scraped_field_types: "field_types_from_scrape",
    scraped_template_types: "template_types_from_scrape",
  };

  for (const [scrapedKey, targetKey] of Object.entries(arrayMergeMap)) {
    if (!source[scrapedKey]) continue;
    const scraped = source[scrapedKey];
    if (!targetKey || !Array.isArray(target[targetKey])) continue;

    let added = 0;
    scraped.forEach((item) => {
      const name = item.name || item.type || item.command;
      if (!name) return;
      const exists = target[targetKey].some(
        (existing) => (existing.name || existing.type || existing.command) === name
      );
      if (!exists) {
        target[targetKey].push({ ...item, scraped_new: true });
        added++;
      }
    });

    if (added > 0) {
      console.log(`    → Added ${added} new item(s) to ${targetKey}`);
    }
  }
}

// ─── Last-updated tracking ───────────────────────────────────────────────────

function loadLastUpdated() {
  if (fs.existsSync(LAST_UPDATED_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(LAST_UPDATED_FILE, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveLastUpdated(data) {
  fs.writeFileSync(LAST_UPDATED_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("Fatal scraper error:", err);
  process.exit(1);
});
