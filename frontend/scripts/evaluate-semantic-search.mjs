import { performance } from "perf_hooks";

const API_BASE = "http://localhost:5248/api/v1";

const EVAL_SET = [
  // 1. Burmese crafts and direct synonyms
  { category: "Burmese Crafts & Synonyms", query: "ယွန်းထည်", expectedRelevance: "Lacquerware craft items", expectMatch: true },
  { category: "Burmese Crafts & Synonyms", query: "ရုပ်သေး", expectedRelevance: "Puppets / Marionettes", expectMatch: true },
  { category: "Burmese Crafts & Synonyms", query: "ပိုးထည်", expectedRelevance: "Handwoven Silk textiles", expectMatch: true },
  { category: "Burmese Crafts & Synonyms", query: "ကျွန်းသစ် ပန်းပု", expectedRelevance: "Teak wood carving sculpture", expectMatch: true },
  { category: "Burmese Crafts & Synonyms", query: "လက်ဖက်ခြောက်", expectedRelevance: "Organic Shan tea leaves", expectMatch: true },

  // 2. English translations and conceptual paraphrases
  { category: "English Translations & Paraphrases", query: "lacquerware", expectedRelevance: "Burmese lacquerware / Bagan crafts", expectMatch: true },
  { category: "English Translations & Paraphrases", query: "wooden puppet", expectedRelevance: "Marionette / puppet crafts", expectMatch: true },
  { category: "English Translations & Paraphrases", query: "handwoven silk", expectedRelevance: "Silk longyi / textiles", expectMatch: true },
  { category: "English Translations & Paraphrases", query: "teak sculpture", expectedRelevance: "Carved teak artwork", expectMatch: true },
  { category: "English Translations & Paraphrases", query: "organic green tea", expectedRelevance: "Shan artisan tea leaves", expectMatch: true },

  // 3. Mixed Burmese-English queries
  { category: "Mixed Burmese-English", query: "Bagan ယွန်းထည်", expectedRelevance: "Bagan authentic lacquerware", expectMatch: true },
  { category: "Mixed Burmese-English", query: "Mandalay ရုပ်သေး puppet", expectedRelevance: "Mandalay string puppets", expectMatch: true },
  { category: "Mixed Burmese-English", query: "Silk ပုဆိုး", expectedRelevance: "Silk men's pasoe / textiles", expectMatch: true },
  { category: "Mixed Burmese-English", query: "Handmade သစ်သား", expectedRelevance: "Handcrafted wood carvings", expectMatch: true },

  // 4. Spelling / script variations & transliterations
  { category: "Spelling & Script Variations", query: "ယွန်းထည", expectedRelevance: "Lacquerware (subword / typo tolerant)", expectMatch: true },
  { category: "Spelling & Script Variations", query: "ပိုးထညျ", expectedRelevance: "Silk fabric (Zawgyi medial variant)", expectMatch: true },
  { category: "Spelling & Script Variations", query: "marionet", expectedRelevance: "Puppet (English typo)", expectMatch: true },
  { category: "Spelling & Script Variations", query: "yoonthe", expectedRelevance: "Lacquerware phonetic transliteration", expectMatch: false },

  // 5. Broad / ambiguous queries
  { category: "Broad & Ambiguous Queries", query: "traditional gift", expectedRelevance: "Artisan crafts / heritage products", expectMatch: true },
  { category: "Broad & Ambiguous Queries", query: "souvenir", expectedRelevance: "Cultural memorabilia / crafts", expectMatch: true },
  { category: "Broad & Ambiguous Queries", query: "အလှဆင်", expectedRelevance: "Home decor / decorative craft", expectMatch: true },
  { category: "Broad & Ambiguous Queries", query: "crafts", expectedRelevance: "General artisan catalog items", expectMatch: true },

  // 6. Out-of-catalog / modern items (Negative controls - expect 0 results)
  { category: "Negative Controls (Modern / Out-of-Catalog)", query: "iPhone 16 Pro", expectedRelevance: "No false positive matches", expectMatch: false },
  { category: "Negative Controls (Modern / Out-of-Catalog)", query: "gaming laptop RTX", expectedRelevance: "No false positive matches", expectMatch: false },
  { category: "Negative Controls (Modern / Out-of-Catalog)", query: "crypto hardware wallet", expectedRelevance: "No false positive matches", expectMatch: false },
  { category: "Negative Controls (Modern / Out-of-Catalog)", query: "basketball sneakers", expectedRelevance: "No false positive matches", expectMatch: false },
];

async function runEvaluation() {
  console.log("=== TrustedMarketplace: Multilingual Semantic Search Empirical Benchmark ===");
  console.log(`Endpoint: ${API_BASE}/products?keyword=...\n`);

  const results = [];

  for (const item of EVAL_SET) {
    const encoded = encodeURIComponent(item.query);
    const url = `${API_BASE}/products?keyword=${encoded}&page=1&pageSize=10`;

    const start = performance.now();
    let status = 0;
    let data = null;
    let error = null;

    try {
      const resp = await fetch(url);
      status = resp.status;
      data = await resp.json();
    } catch (err) {
      error = err.message;
    }
    const durationMs = performance.now() - start;

    const totalMatches = data?.totalCount ?? 0;
    const topItem = data?.items?.[0] ? `${data.items[0].title} (${data.items[0].categoryName || "General"})` : "None";

    let evaluation = "PASS";
    if (item.expectMatch && totalMatches === 0) {
      evaluation = "MISS (0 items)";
    } else if (!item.expectMatch && totalMatches > 0) {
      evaluation = "FALSE POSITIVE";
    }

    results.push({
      category: item.category,
      query: item.query,
      durationMs: durationMs.toFixed(1),
      totalMatches,
      topItem,
      evaluation,
      expected: item.expectedRelevance,
    });
  }

  // Print Summary Table
  console.log("| # | Category | Query | Latency (ms) | Matches | Top-1 Match | Result | Expected |");
  console.log("|---|---|---|---|---|---|---|---|");

  results.forEach((r, idx) => {
    console.log(`| ${idx + 1} | ${r.category} | \`${r.query}\` | ${r.durationMs}ms | ${r.totalMatches} | ${r.topItem} | **${r.evaluation}** | ${r.expected} |`);
  });

  // Calculate Aggregates
  const totalQueries = results.length;
  const passCount = results.filter(r => r.evaluation === "PASS").length;
  const avgLatency = (results.reduce((acc, r) => acc + parseFloat(r.durationMs), 0) / totalQueries).toFixed(1);
  const falsePositives = results.filter(r => r.category.includes("Negative Controls") && r.totalMatches > 0).length;

  console.log("\n### Benchmark Summary Metrics");
  console.log(`- **Total Queries Evaluated**: ${totalQueries}`);
  console.log(`- **Test Pass Rate**: ${passCount} / ${totalQueries} (${((passCount / totalQueries) * 100).toFixed(1)}%)`);
  console.log(`- **Average Query Latency**: ${avgLatency} ms (In-memory cosine + lexical hybrid)`);
  console.log(`- **False Positive Rate on Modern Out-of-Catalog Goods**: ${falsePositives} / 4 (${((falsePositives / 4) * 100).toFixed(1)}%)`);

  return results;
}

runEvaluation().catch(err => {
  console.error("Evaluation script encountered fatal error:", err);
  process.exit(1);
});
