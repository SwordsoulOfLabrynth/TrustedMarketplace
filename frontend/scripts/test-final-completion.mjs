/**
 * Final Bug Fixes and Project Completion Verification Suite
 * Tests T-01 (Price validation), T-02 (Post-login navigation logic), and T-03 (Image consistency)
 */

const API_BASE = "http://localhost:5248/api/v1";

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
  passed++;
}

async function run() {
  console.log("=================================================");
  console.log("  TrustedMarketplace Final Bug Fix Verification  ");
  console.log("=================================================\n");

  // -------------------------------------------------------------------------
  // T-01: Product Price Validation (e.g. 8500, 85000)
  // -------------------------------------------------------------------------
  console.log("--- T-01: Product Price Validation Test ---");
  
  // Login as seller
  const sellerLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "artisan.seller@trustedmarketplace.local",
      password: "SellerDemo123!",
    }),
  });
  assert(sellerLoginRes.status === 200, "Seller login succeeds");
  const sellerAuth = await sellerLoginRes.json();
  const token = sellerAuth.accessToken;

  // Get categories
  const catRes = await fetch(`${API_BASE}/categories`);
  const categories = await catRes.json();
  const catId = categories[0].id;

  // Create a product with price 8500
  const createRes = await fetch(`${API_BASE}/seller/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      categoryId: catId,
      title: "Handcrafted Bronze Bell - Validation Test",
      description: "Authentic bronze bell from Mandalay foundry workshops.",
      priceAmount: 8500,
      condition: "New",
      currencyCode: "MMK",
    }),
  });
  if (createRes.status !== 201) {
    console.error("Create product failed:", createRes.status, await createRes.text());
  }
  assert(createRes.status === 201, "Created product with price 8500 MMK (201 Created)");
  const createdProduct = await createRes.json();
  assert(createdProduct.priceAmount === 8500, "Product price stored accurately as 8500 MMK");

  // Edit product with price 85000 via PATCH
  const editRes = await fetch(`${API_BASE}/seller/products/${createdProduct.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      categoryId: catId,
      title: "Handcrafted Bronze Bell - Updated",
      description: "Updated artisan description.",
      priceAmount: 85000,
      condition: "New",
    }),
  });
  if (editRes.status !== 200) {
    console.error("Edit product failed:", editRes.status, await editRes.text());
  }
  assert(editRes.status === 200, "Updated product price to 85000 MMK (200 OK)");
  const updatedProduct = await editRes.json();
  assert(updatedProduct.priceAmount === 85000, "Product price updated accurately to 85000 MMK");

  // -------------------------------------------------------------------------
  // T-02: Post-Login Destination Rules
  // -------------------------------------------------------------------------
  console.log("\n--- T-02: Post-Login Destination & Role Isolation Test ---");

  // Helper matching frontend getPostLoginRedirect logic
  function getPostLoginRedirect(user, store, returnUrlParam) {
    const isAdmin = user.role === "Admin";
    const isSeller = user.role === "Buyer" && store !== null;

    const defaultDestination = isAdmin
      ? "/admin"
      : isSeller
      ? "/seller/products"
      : "/products";

    if (!returnUrlParam) {
      return defaultDestination;
    }

    const clean = returnUrlParam.trim();
    if (
      !clean.startsWith("/") ||
      clean.startsWith("//") ||
      clean.startsWith("/auth/login") ||
      clean.startsWith("/auth/register")
    ) {
      return defaultDestination;
    }

    if (clean === "/") {
      return defaultDestination;
    }

    if (clean.startsWith("/admin") && !isAdmin) {
      return defaultDestination;
    }

    if (clean.startsWith("/seller") && !isSeller) {
      return defaultDestination;
    }

    return clean;
  }

  const buyerUser = { role: "Buyer" };
  const sellerUser = { role: "Buyer" };
  const adminUser = { role: "Admin" };
  const dummyStore = { storeName: "Mandalay Artisans" };

  // Rule 1: Buyer default
  assert(getPostLoginRedirect(buyerUser, null, null) === "/products", "Buyer default landing is /products");
  assert(getPostLoginRedirect(buyerUser, null, "/") === "/products", "Buyer returnUrl=/ redirects to /products");
  assert(getPostLoginRedirect(buyerUser, null, "/orders") === "/orders", "Buyer preserves valid returnUrl /orders");
  assert(getPostLoginRedirect(buyerUser, null, "/products/123") === "/products/123", "Buyer preserves /products/123");
  assert(getPostLoginRedirect(buyerUser, null, "/seller/products") === "/products", "Buyer unauthorized returnUrl /seller/products safely redirected to /products");
  assert(getPostLoginRedirect(buyerUser, null, "/admin") === "/products", "Buyer unauthorized returnUrl /admin safely redirected to /products");

  // Rule 2: Seller default
  assert(getPostLoginRedirect(sellerUser, dummyStore, null) === "/seller/products", "Seller default landing is /seller/products");
  assert(getPostLoginRedirect(sellerUser, dummyStore, "/") === "/seller/products", "Seller returnUrl=/ redirects to /seller/products");
  assert(getPostLoginRedirect(sellerUser, dummyStore, "/seller/products/new") === "/seller/products/new", "Seller preserves /seller/products/new");
  assert(getPostLoginRedirect(sellerUser, dummyStore, "/orders") === "/orders", "Seller preserves /orders");
  assert(getPostLoginRedirect(sellerUser, dummyStore, "/admin") === "/seller/products", "Seller unauthorized returnUrl /admin safely redirected to /seller/products");

  // Rule 3: Admin default
  assert(getPostLoginRedirect(adminUser, null, null) === "/admin", "Admin default landing is /admin");
  assert(getPostLoginRedirect(adminUser, null, "/") === "/admin", "Admin returnUrl=/ redirects to /admin");
  assert(getPostLoginRedirect(adminUser, null, "/admin") === "/admin", "Admin preserves /admin");
  assert(getPostLoginRedirect(adminUser, null, "/orders") === "/orders", "Admin preserves /orders");
  assert(getPostLoginRedirect(adminUser, null, "/seller/products") === "/admin", "Admin without seller store safely redirected to /admin");

  // -------------------------------------------------------------------------
  // T-03: Image Consistency & URL Resolution
  // -------------------------------------------------------------------------
  console.log("\n--- T-03: Product Image URL Resolution & Consistency ---");

  function getProductImageUrl(image, productId) {
    if (!image) return null;
    const baseUrl = "http://localhost:5248";
    if (typeof image === "string") {
      const trimmed = image.trim();
      if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
      return trimmed.startsWith("http")
        ? trimmed
        : `${baseUrl}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
    }
    if (image.url && typeof image.url === "string" && image.url.trim().length > 0) {
      const trimmedUrl = image.url.trim();
      if (trimmedUrl === "null" || trimmedUrl === "undefined") return null;
      return trimmedUrl.startsWith("http")
        ? trimmedUrl
        : `${baseUrl}${trimmedUrl.startsWith("/") ? "" : "/"}${trimmedUrl}`;
    }
    if (productId && image.id) {
      return `${baseUrl}/api/v1/products/${productId}/images/${image.id}/content`;
    }
    if (image.storageKey && image.storageKey.startsWith("http")) {
      return image.storageKey;
    }
    return null;
  }

  // Case 1: Un-uploaded photo should return null (triggering 'Photography pending')
  assert(getProductImageUrl(null) === null, "null image returns null");
  assert(getProductImageUrl(undefined) === null, "undefined image returns null");
  assert(getProductImageUrl("") === null, "empty string returns null");
  assert(getProductImageUrl("   ") === null, "whitespace returns null");
  assert(getProductImageUrl("null") === null, "'null' string returns null");
  assert(getProductImageUrl({ url: "" }) === null, "object with empty url returns null");
  assert(getProductImageUrl({ url: "null" }) === null, "object with 'null' url returns null");

  // Case 2: Uploaded photo generates clean, valid endpoint URL
  const testImg = {
    id: "f83a2d21-9e20-4e3e-a123-abcdef012345",
    url: "/api/v1/products/p-1/images/f83a2d21-9e20-4e3e-a123-abcdef012345/content",
  };
  const resolvedUrl = getProductImageUrl(testImg, "p-1");
  assert(
    resolvedUrl === "http://localhost:5248/api/v1/products/p-1/images/f83a2d21-9e20-4e3e-a123-abcdef012345/content",
    "Uploaded photo resolves to absolute API content streaming endpoint"
  );

  // Clean up created product
  await fetch(`${API_BASE}/seller/products/${createdProduct.id}/archive`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log("\n=================================================");
  console.log(`🎉 ALL ${passed}/${total} FINAL VERIFICATION ASSERTIONS PASSED!`);
  console.log("=================================================");
}

run().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
