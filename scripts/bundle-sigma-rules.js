/**
 * Bundle SIGMA rules by category
 *
 * Creates one JSON file per category in public/sigma-rules/
 * This eliminates the need for import.meta.glob and reduces bundle size
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULES_SOURCE = path.join(__dirname, "../src/sigma-master/rules/windows");
const OUTPUT_DIR = path.join(__dirname, "../public/sigma-rules");

/**
 * Recursively find all .yml/.yaml files without using glob (avoids fd leaks)
 */
function findYamlFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findYamlFiles(fullPath));
    } else if (/\.ya?ml$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function bundleRules() {
  console.log("📦 Bundling SIGMA rules by category...\n");

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all rule files (using manual recursion instead of glob to avoid fd issues)
  const ruleFiles = findYamlFiles(RULES_SOURCE);

  console.log(`Found ${ruleFiles.length} rule files\n`);

  if (ruleFiles.length === 0) {
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "manifest.json"),
      JSON.stringify({}, null, 2),
      "utf8",
    );
    console.log("⚠️  No rule files found. Written empty manifest.");
    console.log("   Ensure src/sigma-master contains the SigmaHQ rules.\n");
    return;
  }

  // Group file paths by category (top-level directory) — don't read content yet
  const categoryPaths = {};

  for (const filePath of ruleFiles) {
    const relativePath = path.relative(RULES_SOURCE, filePath);
    const parts = relativePath.split(path.sep);
    const category = parts[0];

    if (!categoryPaths[category]) {
      categoryPaths[category] = [];
    }
    categoryPaths[category].push({ filePath, relativePath });
  }

  // Process one category at a time: read files → write JSON → free memory
  let totalSize = 0;
  let totalRules = 0;
  const manifest = {};

  for (const [category, files] of Object.entries(categoryPaths)) {
    const rules = [];

    for (const { filePath, relativePath } of files) {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        rules.push({ path: relativePath, content });
      } catch (error) {
        console.warn(`⚠️  Failed to read ${relativePath}: ${error.message}`);
      }
    }

    // Write category JSON
    const outputFile = path.join(OUTPUT_DIR, `${category}.json`);
    const data = JSON.stringify(rules);
    fs.writeFileSync(outputFile, data, "utf8");

    const sizeKB = (data.length / 1024).toFixed(2);
    totalSize += data.length;
    totalRules += rules.length;
    manifest[category] = {
      file: `${category}.json`,
      ruleCount: rules.length,
      sizeBytes: data.length,
    };

    console.log(
      `✅ ${category.padEnd(25)} ${String(rules.length).padStart(4)} rules → ${sizeKB.padStart(8)} KB`,
    );
  }

  // Write manifest
  const manifestFile = path.join(OUTPUT_DIR, "manifest.json");
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`\n📋 Manifest: manifest.json`);
  console.log(
    `\n📊 Total: ${Object.keys(categoryPaths).length} categories, ${totalRules} rules, ${(totalSize / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`✅ Done! Files written to public/sigma-rules/\n`);
}

bundleRules().catch((error) => {
  console.error("❌ Error bundling rules:", error);
  process.exit(1);
});
