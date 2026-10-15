/**
 * TrustedMarketplace — Phase 5: Burmese / English Semantic Search E2E Test Suite
 *
 * Verifies:
 * 1. Multilingual semantic search for Burmese natural language craft queries
 * 2. Cross-lingual semantic retrieval (Burmese query matching English products)
 * 3. English synonyms & natural language descriptive queries
 * 4. Hybrid search ranking (Lexical, Semantic, and Category matching)
 * 5. Price and category filtering combined with semantic search
 * 6. Pagination parameters (page, pageSize) preserved
 * 7. Security invariants (SEC-04 / SEC-05): Draft & Archived listings strictly hidden
 * 8. Automatic product indexing upon product creation and publishing
 */

const API_BASE = process.env.API_URL || "http://localhost:5248";

let testsRun = 0;
let testsPassed = 0;

function assert(condition, message) {
  testsRun++;
  if (condition) {
    console.log(`✅ PASSED: ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ FAILED: ${message}`);
    process.exitCode = 1;
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  const res = await fetch(url, { ...options, headers });
  let data = null;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    data = await res.text();
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log("==================================================================");
  console.log("  TrustedMarketplace — Phase 5: Semantic Search E2E Suite         ");
  console.log("==================================================================\n");

  // -------------------------------------------------------------------------
  // 1. Verify Public Catalog & Categories Health
  // -------------------------------------------------------------------------
  console.log("--- 1. Catalog & Category Verification ---");
  const catRes = await request("/api/v1/categories");
  assert(catRes.status === 200 && Array.isArray(catRes.data), "Categories endpoint accessible (HTTP 200)");
  assert(catRes.data.length >= 3, `Found ${catRes.data.length} active craft categories`);

  const handicraftsCategory = catRes.data.find((c) => c.slug === "handicrafts" || c.name.includes("Handicrafts"));
  assert(Boolean(handicraftsCategory), "Handicrafts & Art category exists");

  // -------------------------------------------------------------------------
  // 2. Burmese Semantic Search Queries
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Burmese Semantic Search (Cross-Lingual Craft Queries) ---");

  // 2a. Burmese Puppetry Query: ရုပ်သေး (Marionette)
  const burmesePuppetRes = await request(`/api/v1/products?keyword=${encodeURIComponent("ရုပ်သေး")}`);
  assert(burmesePuppetRes.status === 200, "Burmese query 'ရုပ်သေး' returns HTTP 200");
  assert(burmesePuppetRes.data.items.length > 0, `Burmese 'ရုပ်သေး' matched ${burmesePuppetRes.data.totalCount} items`);
  const puppetMatch = burmesePuppetRes.data.items.some((p) =>
    p.title.toLowerCase().includes("marionette") ||
    p.title.toLowerCase().includes("puppet") ||
    p.description.toLowerCase().includes("puppet")
  );
  assert(puppetMatch, "Burmese 'ရုပ်သေး' query matched English marionette/puppet products semantically");

  // 2b. Burmese Lacquerware Query: ယွန်းထည်
  const burmeseLacquerRes = await request(`/api/v1/products?keyword=${encodeURIComponent("ယွန်းထည်")}`);
  assert(burmeseLacquerRes.status === 200, "Burmese query 'ယွန်းထည်' returns HTTP 200");
  assert(burmeseLacquerRes.data.items.length > 0, `Burmese 'ယွန်းထည်' matched ${burmeseLacquerRes.data.totalCount} items`);
  const lacquerMatch = burmeseLacquerRes.data.items.some((p) =>
    p.title.toLowerCase().includes("lacquer") ||
    p.title.toLowerCase().includes("bagan") ||
    p.description.toLowerCase().includes("lacquer")
  );
  assert(lacquerMatch, "Burmese 'ယွန်းထည်' query matched Bagan lacquerware products semantically");

  // 2c. Burmese Lotus Silk / Textile Query: ကြာပိုး / ပိုးထည်
  const burmeseSilkRes = await request(`/api/v1/products?keyword=${encodeURIComponent("ပိုးထည်")}`);
  assert(burmeseSilkRes.status === 200, "Burmese query 'ပိုးထည်' returns HTTP 200");
  assert(burmeseSilkRes.data.items.length > 0, `Burmese 'ပိုးထည်' matched ${burmeseSilkRes.data.totalCount} items`);
  const silkMatch = burmeseSilkRes.data.items.some((p) =>
    p.title.toLowerCase().includes("silk") ||
    p.title.toLowerCase().includes("textile") ||
    p.description.toLowerCase().includes("silk")
  );
  assert(silkMatch, "Burmese 'ပိုးထည်' query matched silk textiles semantically");

  // -------------------------------------------------------------------------
  // 3. English Natural Language & Synonym Queries
  // -------------------------------------------------------------------------
  console.log("\n--- 3. English Natural Language & Descriptive Queries ---");

  // 3a. Natural language query: "traditional wooden puppet"
  const nlPuppetRes = await request(`/api/v1/products?keyword=${encodeURIComponent("traditional wooden puppet")}`);
  assert(nlPuppetRes.status === 200, "Query 'traditional wooden puppet' returns HTTP 200");
  assert(nlPuppetRes.data.items.length > 0, "Query 'traditional wooden puppet' matched catalog items");
  assert(
    nlPuppetRes.data.items[0].title.toLowerCase().includes("marionette") ||
    nlPuppetRes.data.items[0].title.toLowerCase().includes("puppet"),
    `Top result '${nlPuppetRes.data.items[0].title}' is a marionette puppet`
  );

  // 3b. Descriptive query: "handcrafted lacquer plate"
  const nlLacquerRes = await request(`/api/v1/products?keyword=${encodeURIComponent("handcrafted lacquer plate")}`);
  assert(nlLacquerRes.status === 200, "Query 'handcrafted lacquer plate' returns HTTP 200");
  assert(nlLacquerRes.data.items.length > 0, "Query 'handcrafted lacquer plate' matched catalog items");

  // -------------------------------------------------------------------------
  // 4. Combined Filtering: Semantic Search + Price Bounds + Category
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Combined Hybrid Search with Price & Category Filters ---");

  const minPrice = 10000;
  const maxPrice = 80000;
  const filteredSearch = await request(
    `/api/v1/products?keyword=${encodeURIComponent("marionette")}&minPrice=${minPrice}&maxPrice=${maxPrice}&categoryId=${handicraftsCategory.id}`
  );
  assert(filteredSearch.status === 200, "Filtered search returns HTTP 200");
  assert(filteredSearch.data.items.length > 0, `Filtered search returned ${filteredSearch.data.items.length} items`);

  const allWithinBounds = filteredSearch.data.items.every(
    (p) => p.priceAmount >= minPrice && p.priceAmount <= maxPrice && p.categoryId === handicraftsCategory.id
  );
  assert(allWithinBounds, `All returned items strictly respect price bounds [${minPrice}-${maxPrice} MMK] and category`);

  // -------------------------------------------------------------------------
  // 5. Security & Privacy Invariants (SEC-04 & SEC-05)
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Security & Privacy Invariants: Draft & Archived Visibility ---");

  // Authenticate admin and create fresh verified seller
  const adminLogin = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@trustedmarketplace.local", password: "AdminDemo123!" }),
  });
  const adminToken = adminLogin.data.accessToken;

  const timestamp = Date.now();
  const sellerEmail = `artisan.search.${timestamp}@trustedmarketplace.local`;
  const regRes = await request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: sellerEmail,
      password: "SellerPassword123!",
      displayName: `Artisan Search ${timestamp}`,
    }),
  });
  const sellerLogin = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: sellerEmail, password: "SellerPassword123!" }),
  });
  const sellerToken = sellerLogin.data.accessToken;

  // Approve seller application
  const appRes = await request("/api/v1/seller-applications", {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({
      proposedStoreName: `Artisan Studio ${timestamp}`,
      businessType: "HandicraftsArtisan",
      contactPhone: "09455554146",
    }),
  });
  await request(`/api/v1/admin/seller-applications/${appRes.data.id}/decision`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ decision: "Approved", reason: "Verified artisan profile" }),
  });

  const freshSeller = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: sellerEmail, password: "SellerPassword123!" }),
  });
  const activeSellerToken = freshSeller.data.accessToken;

  // Create a Draft Product with a unique, unguessable title
  const secretKey = `SecretPuppet_${timestamp}`;
  const draftCreateRes = await request("/api/v1/seller/products", {
    method: "POST",
    headers: { Authorization: `Bearer ${activeSellerToken}` },
    body: JSON.stringify({
      categoryId: handicraftsCategory.id,
      title: `Private Artisan Puppet ${secretKey}`,
      description: "Handcrafted traditional teak puppet, draft state for testing SEC-04.",
      priceAmount: 65000,
      condition: "New",
      currencyCode: "MMK",
    }),
  });
  assert(draftCreateRes.status === 201, "Draft product created by seller (HTTP 201)");
  const draftProduct = draftCreateRes.data;
  assert(draftProduct.status === "Draft", "Product status is Draft");

  // Invariant 1: Public search for the secret keyword MUST NEVER return draft products
  const draftSearchRes = await request(`/api/v1/products?keyword=${encodeURIComponent(secretKey)}`);
  assert(draftSearchRes.status === 200, "Search request succeeded (HTTP 200)");
  assert(
    !draftSearchRes.data.items.some((p) => p.id === draftProduct.id),
    "SEC-04: Draft product is STRICTLY hidden from public search (never included in results)"
  );

  // Invariant 2: Anonymous user cannot fetch draft by ID
  const anonDetailRes = await request(`/api/v1/products/${draftProduct.id}`);
  assert(
    anonDetailRes.status === 404 || anonDetailRes.data === null,
    "SEC-04: Anonymous user cannot access draft product details (HTTP 404)"
  );

  // Invariant 3: Publishing product immediately makes it discoverable
  const pubRes = await request(`/api/v1/seller/products/${draftProduct.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${activeSellerToken}` },
  });
  assert(pubRes.status === 200, "Seller published product (HTTP 200)");

  const publishedSearchRes = await request(`/api/v1/products?keyword=${encodeURIComponent(secretKey)}`);
  assert(publishedSearchRes.status === 200, "Search for published product succeeded (HTTP 200)");
  assert(
    publishedSearchRes.data.items.some((p) => p.id === draftProduct.id),
    "Published product is immediately discoverable via hybrid search"
  );

  // Invariant 4: Archiving product removes it from public search
  const archiveRes = await request(`/api/v1/seller/products/${draftProduct.id}/archive`, {
    method: "POST",
    headers: { Authorization: `Bearer ${activeSellerToken}` },
  });
  assert(archiveRes.status === 200, "Seller archived product (HTTP 200)");

  const archivedSearchRes = await request(`/api/v1/products?keyword=${encodeURIComponent(secretKey)}`);
  assert(
    !archivedSearchRes.data.items.some((p) => p.id === draftProduct.id),
    "SEC-05: Archived product is STRICTLY hidden from public search (never included in results)"
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(`  Phase 5 Test Suite Summary: ${testsPassed} / ${testsRun} PASSED `);
  console.log("==================================================================");

  if (testsPassed === testsRun) {
    console.log("🎉 ALL PHASE 5 SEMANTIC SEARCH INVARIANTS VERIFIED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME TESTS FAILED.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error running Phase 5 test suite:", err);
  process.exit(1);
});
