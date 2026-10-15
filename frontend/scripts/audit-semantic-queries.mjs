/**
 * Special Semantic Search Evaluation Script (Phase 6 Audit)
 * Tests representative queries inside and outside the 10 craft clusters.
 */

const API_BASE = "http://localhost:5248";

const testQueries = [
  // Inside Clusters - Burmese
  { q: "ရုပ်သေး", lang: "my", inCluster: true, desc: "Marionette/Puppet" },
  { q: "ယွန်းထည်", lang: "my", inCluster: true, desc: "Lacquerware" },
  { q: "ကြာပိုးထည်", lang: "my", inCluster: true, desc: "Lotus silk textile" },
  { q: "ကျွန်းသစ် ပန်းပု", lang: "my", inCluster: true, desc: "Teakwood carving" },
  { q: "လက်ဖက်", lang: "my", inCluster: true, desc: "Pickled tea" },

  // Inside Clusters - English
  { q: "marionette", lang: "en", inCluster: true, desc: "Puppet" },
  { q: "traditional wooden puppet", lang: "en", inCluster: true, desc: "Puppet natural language" },
  { q: "bagan lacquerware bowl", lang: "en", inCluster: true, desc: "Lacquerware bowl" },
  { q: "handwoven lotus silk", lang: "en", inCluster: true, desc: "Silk textile" },

  // Outside Clusters - Burmese
  { q: "ဖုန်းကာဗာ", lang: "my", inCluster: false, desc: "Phone case / cover" },
  { q: "စာအုပ်", lang: "my", inCluster: false, desc: "Book" },
  { q: "ဖိနပ်", lang: "my", inCluster: false, desc: "Footwear / shoes" },
  { q: "ကော်ဖီ", lang: "my", inCluster: false, desc: "Coffee" },

  // Outside Clusters - English
  { q: "laptop charger", lang: "en", inCluster: false, desc: "Electronics" },
  { q: "leather wallet", lang: "en", inCluster: false, desc: "Accessories" },
  { q: "smart watch", lang: "en", inCluster: false, desc: "Wearable tech" },
  { q: "acoustic guitar", lang: "en", inCluster: false, desc: "Musical instrument" },
];

async function run() {
  console.log("=========================================================================");
  console.log("  TrustedMarketplace — Semantic Search Audit: Query Evaluation Set       ");
  console.log("=========================================================================\n");

  const results = [];

  for (const item of testQueries) {
    const url = `${API_BASE}/api/v1/products?keyword=${encodeURIComponent(item.q)}&pageSize=5`;
    const start = Date.now();
    const res = await fetch(url);
    const durationMs = Date.now() - start;
    const json = await res.json();

    const topItems = (json.items || []).slice(0, 3).map((p) => ({
      title: p.title,
      price: p.priceAmount,
      category: p.categoryName,
    }));

    results.push({
      query: item.q,
      lang: item.lang,
      inCluster: item.inCluster,
      desc: item.desc,
      totalCount: json.totalCount,
      returnedCount: (json.items || []).length,
      durationMs,
      topItems,
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error);
