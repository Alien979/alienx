/**
 * Bundle SIGMA rules by category
 *
 * Creates one JSON file per category in public/sigma-rules/
 * This eliminates the need for import.meta.glob and reduces bundle size
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULES_SOURCE = path.join(__dirname, "../src/sigma-master/rules/windows");
const OUTPUT_DIR = path.join(__dirname, "../public/sigma-rules");

async function bundleRules() {
  console.log("📦 Bundling SIGMA rules by category...\n");

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all rule files
  const ruleFiles = glob.sync("**/*.{yml,yaml}", {
    cwd: RULES_SOURCE,
    absolute: true,
  });

  console.log(`Found ${ruleFiles.length} rule files\n`);

  if (ruleFiles.length === 0) {
    // Write empty manifest and exit gracefully
    const manifestFile = path.join(OUTPUT_DIR, "manifest.json");
    fs.writeFileSync(manifestFile, JSON.stringify({}, null, 2), "utf8");
    console.log("⚠️  No rule files found. Written empty manifest.");
    console.log("   Ensure src/sigma-master contains the SigmaHQ rules.\n");
    return;
  }

  // Group by category (top-level directory)
  const categories = {};

  for (const filePath of ruleFiles) {
    const relativePath = path.relative(RULES_SOURCE, filePath);
    const parts = relativePath.split(path.sep);
    const category = parts[0]; // First directory is the category

    if (!categories[category]) {
      categories[category] = [];
    }

    try {
      const content = fs.readFileSync(filePath, "utf8");
      categories[category].push({
        path: relativePath,
        content: content,
      });
    } catch (error) {
      console.warn(`⚠️  Failed to read ${relativePath}: ${error.message}`);
    }
  }

  // Write one JSON file per category
  let totalSize = 0;
  const manifest = {};

  for (const [category, rules] of Object.entries(categories)) {
    const outputFile = path.join(OUTPUT_DIR, `${category}.json`);
    const data = JSON.stringify(rules);

    fs.writeFileSync(outputFile, data);

    const sizeKB = (data.length / 1024).toFixed(2);
    totalSize += data.length;
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
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

  console.log(`\n📋 Manifest: manifest.json`);
  console.log(
    `\n📊 Total: ${Object.keys(categories).length} categories, ${ruleFiles.length} rules, ${(totalSize / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`✅ Done! Files written to public/sigma-rules/\n`);
}

bundleRules().catch((error) => {
  console.error("❌ Error bundling rules:", error);
  process.exit(1);
});
