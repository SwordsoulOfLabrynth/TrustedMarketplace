/**
 * End-to-End Integration Test for Task F-03 Public Marketplace & Catalog Discovery
 * Tests against the live running ASP.NET Core backend at http://localhost:5248
 */

const API_BASE = "http://localhost:5248/api/v1";

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
  passedTests++;
}

async function runTests() {
  console.log("=================================================");
  console.log("  TrustedMarketplace F-03 Catalog Integration Test  ");
  console.log("=================================================\n");

  // 1. Categories
  console.log("--- 1. Product Categories Retrieval ---");
  const catRes = await fetch(`${API_BASE}/categories`);
  assert(catRes.status === 200, "GET /api/v1/categories returns 200 OK");
  const categories = await catRes.json();
  assert(Array.isArray(categories) && categories.length >= 4, `Categories returned as array of ${categories.length} items`);
  const handicrafts = categories.find((c) => c.slug === "handicrafts-art");
  assert(handicrafts !== undefined, "Found 'handicrafts-art' category");
  const textiles = categories.find((c) => c.slug === "fashion-accessories" || c.slug === "traditional-fashion-textiles");
  assert(textiles !== undefined, "Found fashion category ('fashion-accessories' or 'traditional-fashion-textiles')");

  // 2. Public Catalog Search & Pagination
  console.log("\n--- 2. Public Catalog Browsing ---");
  const prodRes = await fetch(`${API_BASE}/products?page=1&pageSize=10`);
  assert(prodRes.status === 200, "GET /api/v1/products returns 200 OK");
  const pagedResult = await prodRes.json();
  assert(pagedResult.items && Array.isArray(pagedResult.items), "PagedResult contains items array");
  assert(pagedResult.totalCount >= 3, `Catalog has totalCount: ${pagedResult.totalCount}`);
  assert(pagedResult.page === 1, `Current page is 1`);
  assert(pagedResult.pageSize === 10, `Page size is 10`);

  const firstProduct = pagedResult.items[0];
  assert(firstProduct.id && typeof firstProduct.id === "string", "Product has valid UUID string ID");
  assert(firstProduct.title && firstProduct.title.length > 0, `Product title: "${firstProduct.title}"`);
  assert(firstProduct.priceAmount > 0, `Product priceAmount: ${firstProduct.priceAmount} ${firstProduct.currencyCode}`);
  assert(firstProduct.status === "Published", `Product status is 'Published' (${firstProduct.status})`);
  assert(firstProduct.condition && firstProduct.condition.length > 0, `Product condition: ${firstProduct.condition}`);

  // 3. Keyword Search
  console.log("\n--- 3. Keyword Search ---");
  const searchRes = await fetch(`${API_BASE}/products?keyword=marionette`);
  assert(searchRes.status === 200, "GET /api/v1/products?keyword=marionette returns 200 OK");
  const searchData = await searchRes.json();
  assert(searchData.items.length > 0, `Found ${searchData.items.length} items matching 'marionette'`);
  const allMatchKeyword = searchData.items.every(
    (p) =>
      p.title.toLowerCase().includes("marionette") ||
      p.description.toLowerCase().includes("marionette")
  );
  assert(allMatchKeyword, "All returned items contain 'marionette' in title or description");

  // 4. Category Filter
  console.log("\n--- 4. Category Filtering ---");
  const catFilterRes = await fetch(`${API_BASE}/products?categoryId=${handicrafts.id}`);
  assert(catFilterRes.status === 200, `GET /api/v1/products?categoryId=${handicrafts.id} returns 200 OK`);
  const catFilterData = await catFilterRes.json();
  assert(catFilterData.items.length > 0, `Found ${catFilterData.items.length} items in Handicrafts category`);
  const allMatchCategory = catFilterData.items.every((p) => p.categoryId === handicrafts.id);
  assert(allMatchCategory, "All items match the requested CategoryId");

  // 5. Price Bounds Filter
  console.log("\n--- 5. Price Bounds Filtering ---");
  const minP = 40000;
  const maxP = 70000;
  const priceFilterRes = await fetch(`${API_BASE}/products?minPrice=${minP}&maxPrice=${maxP}`);
  assert(priceFilterRes.status === 200, `GET /api/v1/products?minPrice=${minP}&maxPrice=${maxP} returns 200 OK`);
  const priceData = await priceFilterRes.json();
  assert(priceData.items.length > 0, `Found ${priceData.items.length} items in price range`);
  const allInPriceRange = priceData.items.every(
    (p) => p.priceAmount >= minP && p.priceAmount <= maxP
  );
  assert(allInPriceRange, `All items satisfy price range [${minP}, ${maxP}] MMK`);

  // 6. Product Detail Lookup & 404 Handling
  console.log("\n--- 6. Product Detail & Unknown Handling ---");
  const detailRes = await fetch(`${API_BASE}/products/${firstProduct.id}`);
  assert(detailRes.status === 200, `GET /api/v1/products/${firstProduct.id} returns 200 OK`);
  const detailData = await detailRes.json();
  assert(detailData.id === firstProduct.id, "Detail product ID matches requested ID");
  assert(detailData.storeName && detailData.storeName.length > 0, `Product belongs to store: "${detailData.storeName}"`);

  const fakeId = "00000000-0000-0000-0000-000000000000";
  const notFoundRes = await fetch(`${API_BASE}/products/${fakeId}`);
  assert(notFoundRes.status === 404, `GET /api/v1/products/${fakeId} correctly returns 404 Not Found`);

  // 7. Seller Storefront & Verified Trust Profile
  console.log("\n--- 7. Seller Storefront & Trust Profile ---");
  const sellerId = detailData.sellerUserId;
  const storeRes = await fetch(`${API_BASE}/sellers/${sellerId}/store`);
  assert(storeRes.status === 200, `GET /api/v1/sellers/${sellerId}/store returns 200 OK`);
  const storeData = await storeRes.json();
  assert(storeData.sellerUserId === sellerId, "Store belongs to correct sellerUserId");
  assert(storeData.verificationStatus === "Verified", `Seller store verification status is 'Verified'`);

  const trustRes = await fetch(`${API_BASE}/sellers/${sellerId}/trust-profile`);
  assert(trustRes.status === 200, `GET /api/v1/sellers/${sellerId}/trust-profile returns 200 OK`);
  const trustData = await trustRes.json();
  assert(trustData.sellerUserId === sellerId, "Trust profile belongs to correct sellerUserId");
  assert(trustData.verificationStatus === "Verified", "Trust profile verificationStatus is 'Verified'");
  assert(trustData.disclaimer && trustData.disclaimer.length > 10, `Trust profile disclaimer: "${trustData.disclaimer}"`);
  assert(typeof trustData.completedOrdersCount === "number", `Completed orders count is number (${trustData.completedOrdersCount})`);
  assert(typeof trustData.averageRating === "number", `Average rating is number (${trustData.averageRating})`);

  // 8. Seller Reviews
  console.log("\n--- 8. Transaction-Linked Reviews ---");
  const reviewsRes = await fetch(`${API_BASE}/sellers/${sellerId}/reviews`);
  assert(reviewsRes.status === 200, `GET /api/v1/sellers/${sellerId}/reviews returns 200 OK`);
  const reviewsData = await reviewsRes.json();
  assert(Array.isArray(reviewsData.items), "Reviews returned as PagedResult array");
  if (reviewsData.items.length > 0) {
    const rev = reviewsData.items[0];
    assert(rev.rating >= 1 && rev.rating <= 5, `Review rating is in valid range 1-5 (${rev.rating})`);
    assert(rev.comment && rev.comment.length > 0, `Review comment: "${rev.comment}"`);
    assert(rev.orderId && rev.orderId.length > 0, "Review is linked to verified orderId");
  }

  // 9. Unknown Seller 404 Handling
  const fakeSellerId = "99999999-9999-9999-9999-999999999999";
  const fakeStoreRes = await fetch(`${API_BASE}/sellers/${fakeSellerId}/store`);
  assert(fakeStoreRes.status === 404, `GET /api/v1/sellers/${fakeSellerId}/store correctly returns 404 Not Found`);

  console.log("\n=================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} CATALOG INTEGRATION TESTS PASSED!`);
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
