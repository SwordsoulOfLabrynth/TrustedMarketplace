/**
 * MatchGuard — Idempotent Marketplace Catalog Seeder & Verification Script
 *
 * Safely triggers and verifies idempotent catalog expansion across:
 * - Electronics & Gadgets
 * - Fashion & Accessories
 * - Beauty & Personal Care
 * - Home & Living
 * - Food & Local Products
 * - Handicrafts & Art
 *
 * Usage:
 *   node scripts/seed_marketplace_catalog.mjs
 *   API_BASE=http://localhost:5248/api/v1 node scripts/seed_marketplace_catalog.mjs
 */

const API_BASE = process.env.API_BASE || "https://trustedmarketplace-hyr0.onrender.com/api/v1";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@trustedmarketplace.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "AdminDemo123!";

async function main() {
  console.log("==================================================================");
  console.log("  MatchGuard — Catalog Seeder & Integrity Verification Script    ");
  console.log(`  Target Backend: ${API_BASE}`);
  console.log("==================================================================\n");

  // Step 1: Health check
  console.log("1. Checking API Health...");
  const healthRes = await fetch(`${API_BASE}/health`);
  if (!healthRes.ok) {
    throw new Error(`Health check failed with status: ${healthRes.status}`);
  }
  const health = await healthRes.json();
  console.log(`   ✅ API Status: ${health.status} (${health.timestampUtc || "OK"})\n`);

  // Step 2: Check current categories
  console.log("2. Inspecting Product Categories...");
  const catRes = await fetch(`${API_BASE}/categories`);
  const categories = await catRes.json();
  console.log(`   Found ${categories.length} categories:`);
  for (const cat of categories) {
    console.log(`   - [${cat.slug}] ${cat.name} (${cat.id})`);
  }
  console.log();

  // Step 3: Check current catalog state
  console.log("3. Inspecting Existing Catalog Products...");
  const initialProdRes = await fetch(`${API_BASE}/products?page=1&pageSize=100`);
  const initialProds = await initialProdRes.json();
  console.log(`   Current total products: ${initialProds.totalCount}`);
  for (const p of initialProds.items) {
    console.log(`   - ${p.title} | Category: ${p.categoryName} | Seller: ${p.storeName} | Verification: ${p.sellerVerificationStatus || "N/A"}`);
  }
  console.log();

  // Step 4: Authenticate as Admin
  console.log("4. Authenticating as Admin...");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!loginRes.ok) {
    const errText = await loginRes.text();
    throw new Error(`Admin login failed (${loginRes.status}): ${errText}`);
  }
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log(`   ✅ Admin authenticated: ${loginData.user.displayName} (${loginData.user.role})\n`);

  // Step 5: Execute Idempotent Demo Catalog Seed
  console.log("5. Triggering Idempotent Demo Catalog Seed (POST /api/v1/admin/catalog/seed-demo-data)...");
  const seedRes = await fetch(`${API_BASE}/admin/catalog/seed-demo-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!seedRes.ok) {
    const errText = await seedRes.text();
    console.warn(`   ⚠️ Seed endpoint returned status ${seedRes.status}: ${errText}`);
    console.warn(`   (If deployed backend has not yet updated to latest build with seed-demo-data endpoint, please wait for Render deployment.)`);
    return;
  }

  const seedResult = await seedRes.json();
  console.log(`   ✅ Seed response:`, seedResult);
  console.log();

  // Step 6: Post-seed verification
  console.log("6. Verifying Expanded Catalog Distribution & Integrity...");
  const postProdRes = await fetch(`${API_BASE}/products?page=1&pageSize=100`);
  const postProds = await postProdRes.json();
  console.log(`   Total products in catalog: ${postProds.totalCount}`);

  // Count by category
  const categoryCounts = {};
  const sellerCounts = {};
  const statusCounts = {};

  for (const p of postProds.items) {
    categoryCounts[p.categoryName] = (categoryCounts[p.categoryName] || 0) + 1;
    sellerCounts[p.storeName] = (sellerCounts[p.storeName] || 0) + 1;
    const vStatus = p.sellerVerificationStatus || "Unverified";
    statusCounts[vStatus] = (statusCounts[vStatus] || 0) + 1;
  }

  console.log("\n   Distribution by Category:");
  for (const [cat, cnt] of Object.entries(categoryCounts)) {
    console.log(`   - ${cat}: ${cnt} products`);
  }

  console.log("\n   Distribution by Seller Store:");
  for (const [store, cnt] of Object.entries(sellerCounts)) {
    console.log(`   - ${store}: ${cnt} products`);
  }

  console.log("\n   Distribution by Verification Status:");
  for (const [st, cnt] of Object.entries(statusCounts)) {
    console.log(`   - ${st}: ${cnt} products`);
  }

  // Step 7: Verify price sorting
  console.log("\n7. Verifying Price Sorting (Ascending / Descending)...");
  const ascRes = await fetch(`${API_BASE}/products?sortBy=price_asc&pageSize=5`);
  const ascData = await ascRes.json();
  const ascPrices = ascData.items.map((p) => p.priceAmount);
  console.log(`   Price ASC (first 5):`, ascPrices);
  const isAscending = ascPrices.every((val, i, arr) => !i || arr[i - 1] <= val);
  console.log(`   ASC sort check: ${isAscending ? "✅ PASSED" : "❌ FAILED"}`);

  const descRes = await fetch(`${API_BASE}/products?sortBy=price_desc&pageSize=5`);
  const descData = await descRes.json();
  const descPrices = descData.items.map((p) => p.priceAmount);
  console.log(`   Price DESC (first 5):`, descPrices);
  const isDescending = descPrices.every((val, i, arr) => !i || arr[i - 1] >= val);
  console.log(`   DESC sort check: ${isDescending ? "✅ PASSED" : "❌ FAILED"}`);

  console.log("\n==================================================================");
  console.log("🎉 CATALOG SEED & VERIFICATION COMPLETED SUCCESSFULLY!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("\n❌ Script error:", err);
  process.exit(1);
});
