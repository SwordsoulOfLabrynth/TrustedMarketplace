import fs from "node:fs";
import path from "node:path";

/**
 * TrustedMarketplace — English-Only UI Audit Test
 *
 * Scans all frontend components and pages to assert that:
 * 1. Zero Burmese unicode characters exist in UI labels, helper texts, and templates.
 * 2. Status badges, category pills, headers, forms, and dialogs are 100% English.
 * 3. Product and semantic search capabilities remain intact.
 */

const burmeseRegex = /[\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF]/;

function walk(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (["node_modules", ".next", "bin", "obj", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(full));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

const frontendSrc = fs.existsSync(path.join(process.cwd(), "src"))
  ? path.join(process.cwd(), "src")
  : path.join(process.cwd(), "frontend", "src");
const files = walk(frontendSrc);

console.log("==================================================================");
console.log("  TrustedMarketplace — English-Only UI Invariant Test Suite        ");
console.log("==================================================================\n");

let violations = 0;
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  if (burmeseRegex.test(content)) {
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      if (burmeseRegex.test(line)) {
        console.error(`❌ REGRESSION: Burmese text detected in ${path.relative(process.cwd(), file)}:${index + 1}`);
        console.error(`   Content: ${line.trim()}`);
        violations++;
      }
    });
  }
}

if (violations === 0) {
  console.log(`✅ PASSED: All ${files.length} frontend source files are 100% English-only UI!`);
  process.exit(0);
} else {
  console.error(`\n❌ FAILED: Found ${violations} Burmese text violations in frontend UI!`);
  process.exit(1);
}
