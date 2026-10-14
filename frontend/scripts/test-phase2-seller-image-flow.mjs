import assert from "node:assert";

const API_BASE = process.env.API_URL || "http://localhost:5248";

// Genuine image byte buffers (valid decodable image files)
const JPEG_HEADER = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const PNG_HEADER = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const WEBP_HEADER = Buffer.from('UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAkA4JaQAA3AA/vuUAAA=', 'base64');
const INVALID_PDF = Buffer.from("%PDF-1.4 Fake document content");

async function post(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function get(path, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function put(path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function del(path, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function uploadImage(productId, fileBuffer, fileName, mimeType, token) {
  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  form.append("file", blob, fileName);

  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/v1/seller/products/${productId}/images`, {
    method: "POST",
    headers,
    body: form,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log("==================================================================");
  console.log("  TrustedMarketplace — Phase 2 Seller Image & Security Suite     ");
  console.log("==================================================================");

  // 1. Authenticate as Daw Khin (Verified Seller A)
  console.log("\n--- 1. Authenticating Seller A (Daw Khin) ---");
  const loginA = await post("/api/v1/auth/login", {
    email: "artisan.seller@trustedmarketplace.local",
    password: "SellerDemo123!",
  });
  assert.strictEqual(loginA.status, 200, "Seller A login failed");
  const tokenA = loginA.data.accessToken;
  const sellerAId = loginA.data.user.id;
  console.log(`✅ PASSED: Seller A authenticated (User ID: ${sellerAId})`);

  // 2. Fetch craft categories
  console.log("\n--- 2. Fetching Catalog Categories ---");
  const catRes = await get("/api/v1/categories");
  assert.strictEqual(catRes.status, 200);
  assert.ok(catRes.data.length > 0, "No categories returned");
  const categoryId = catRes.data[0].id;
  console.log(`✅ PASSED: Retrieved ${catRes.data.length} categories (Using Category: ${catRes.data[0].name})`);

  // 3. Create a new product listing in Draft status
  console.log("\n--- 3. Create Draft Product Listing ---");
  const productTitle = `Bagan Lacquerware Tea Set - Test ${Date.now()}`;
  const createProdRes = await post(
    "/api/v1/seller/products",
    {
      categoryId,
      title: productTitle,
      description: "Authentic handcrafted Bagan lacquerware crafted from natural bamboo and lacquer sap.",
      priceAmount: 85000,
      condition: "New",
      currencyCode: "MMK",
    },
    tokenA
  );
  assert.strictEqual(createProdRes.status, 201, `Failed to create product: ${JSON.stringify(createProdRes.data)}`);
  const product = createProdRes.data;
  console.log(`✅ PASSED: Product created in Draft status (ID: ${product.id})`);
  assert.strictEqual(product.status, "Draft");

  // 4. Upload Genuine Image 1 (JPEG) -> Becomes Cover Photo
  console.log("\n--- 4. Upload Genuine Image 1 (JPEG) ---");
  const img1Res = await uploadImage(product.id, JPEG_HEADER, "bagan_front.jpg", "image/jpeg", tokenA);
  assert.strictEqual(img1Res.status, 201, `Failed to upload image 1: ${JSON.stringify(img1Res.data)}`);
  const image1 = img1Res.data;
  assert.strictEqual(image1.sortOrder, 0, "First image must have sortOrder 0");
  assert.strictEqual(image1.isPrimary, true, "First image must be marked as primary");
  assert.ok(image1.url.includes(`/api/v1/products/${product.id}/images/${image1.id}/content`), "URL must match content endpoint");
  console.log(`✅ PASSED: Image 1 uploaded as primary cover photo (ID: ${image1.id})`);

  // 5. Upload Genuine Image 2 (PNG) -> Secondary
  console.log("\n--- 5. Upload Genuine Image 2 (PNG) ---");
  const img2Res = await uploadImage(product.id, PNG_HEADER, "bagan_detail.png", "image/png", tokenA);
  assert.strictEqual(img2Res.status, 201);
  const image2 = img2Res.data;
  assert.strictEqual(image2.sortOrder, 1, "Second image must have sortOrder 1");
  assert.strictEqual(image2.isPrimary, false, "Second image must not be primary");
  console.log(`✅ PASSED: Image 2 uploaded (ID: ${image2.id}, sortOrder: 1)`);

  // 6. Upload Genuine Image 3 (WebP)
  console.log("\n--- 6. Upload Genuine Image 3 (WebP) ---");
  const img3Res = await uploadImage(product.id, WEBP_HEADER, "bagan_base.webp", "image/webp", tokenA);
  assert.strictEqual(img3Res.status, 201);
  const image3 = img3Res.data;
  console.log(`✅ PASSED: Image 3 uploaded (ID: ${image3.id}, sortOrder: 2)`);

  // 7. Validation: Reject Invalid File Format (PDF disguised as image)
  console.log("\n--- 7. Security: Reject Invalid Format (PDF/Script) ---");
  const invalidFormatRes = await uploadImage(product.id, INVALID_PDF, "hacker.jpg", "image/jpeg", tokenA);
  assert.strictEqual(invalidFormatRes.status, 400, "Backend must reject invalid magic bytes with 400 BadRequest");
  console.log("✅ PASSED: Correctly rejected forged image with non-image magic bytes");

  // 8. Validation: Reject Oversized File (> 5MB)
  console.log("\n--- 8. Security: Reject Oversized Image (> 5MB) ---");
  const oversizedBuffer = Buffer.concat([JPEG_HEADER, Buffer.alloc(6 * 1024 * 1024)]);
  const oversizedRes = await uploadImage(product.id, oversizedBuffer, "giant.jpg", "image/jpeg", tokenA);
  assert.strictEqual(oversizedRes.status, 400, "Backend must reject files > 5MB with 400 BadRequest");
  console.log("✅ PASSED: Correctly rejected file exceeding 5MB limit");

  // 9. Set Image 2 as Primary Cover Photo
  console.log("\n--- 9. Set Image 2 as Primary Cover Photo ---");
  const setPrimaryRes = await put(
    `/api/v1/seller/products/${product.id}/images/${image2.id}/primary`,
    {},
    tokenA
  );
  assert.strictEqual(setPrimaryRes.status, 200);
  assert.strictEqual(setPrimaryRes.data.isPrimary, true);
  assert.strictEqual(setPrimaryRes.data.sortOrder, 0);
  console.log("✅ PASSED: Image 2 promoted to primary cover photo (sortOrder = 0)");

  // 10. Reorder Images
  console.log("\n--- 10. Reorder Images ---");
  const reorderRes = await put(
    `/api/v1/seller/products/${product.id}/images/reorder`,
    { imageIds: [image3.id, image1.id, image2.id] },
    tokenA
  );
  assert.strictEqual(reorderRes.status, 200);
  assert.strictEqual(reorderRes.data[0].id, image3.id);
  assert.strictEqual(reorderRes.data[0].sortOrder, 0);
  assert.strictEqual(reorderRes.data[0].isPrimary, true);
  console.log("✅ PASSED: Reordered images sequence successfully committed");

  // 11. Public Image Content Serving
  console.log("\n--- 11. Public Binary Image Stream Serving ---");
  // Check stream of draft product for owner
  const streamRes = await fetch(`${API_BASE}/api/v1/products/${product.id}/images/${image1.id}/content`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(streamRes.status, 200);
  assert.ok(streamRes.headers.get("content-type")?.includes("image/"), "Content-Type must be an image");
  assert.ok(streamRes.headers.get("cache-control")?.includes("private") || streamRes.headers.get("cache-control")?.includes("no-store"), "Draft image must contain private/no-store Cache-Control");
  console.log("✅ PASSED: Binary image stream served with proper headers, MIME type, and private cache control for draft");

  // 12. Security Boundary: IDOR Protection against Seller B (SEC-05)
  console.log("\n--- 12. Security SEC-05: IDOR Protection Between Different Sellers ---");
  // Register a separate Seller B
  const strangerEmail = `seller.stranger.${Date.now()}@test.mm`;
  const registerStranger = await post("/api/v1/auth/register", {
    displayName: "Stranger Seller",
    email: strangerEmail,
    password: "Password123!",
  });
  assert.strictEqual(registerStranger.status, 201);
  const loginStranger = await post("/api/v1/auth/login", {
    email: strangerEmail,
    password: "Password123!",
  });
  const tokenB = loginStranger.data.accessToken;

  // Seller B attempts to upload image to Seller A's product -> 403 Forbidden
  const idorUpload = await uploadImage(product.id, JPEG_HEADER, "stranger.jpg", "image/jpeg", tokenB);
  assert.strictEqual(idorUpload.status, 403, "Stranger uploading to another's product must return 403 Forbidden");
  console.log("✅ PASSED: Stranger upload attempt blocked with 403 Forbidden");

  // Seller B attempts to delete Seller A's image -> 403 Forbidden
  const idorDelete = await del(`/api/v1/seller/products/${product.id}/images/${image1.id}`, tokenB);
  assert.strictEqual(idorDelete.status, 403, "Stranger deleting another's image must return 403 Forbidden");
  console.log("✅ PASSED: Stranger delete attempt blocked with 403 Forbidden");

  // Seller B attempts to reorder Seller A's images -> 403 Forbidden
  const idorReorder = await put(
    `/api/v1/seller/products/${product.id}/images/reorder`,
    { imageIds: [image2.id, image1.id] },
    tokenB
  );
  assert.strictEqual(idorReorder.status, 403, "Stranger reordering another's images must return 403 Forbidden");
  console.log("✅ PASSED: Stranger reorder attempt blocked with 403 Forbidden");

  // 13. Delete an Image
  console.log("\n--- 13. Delete Product Image ---");
  const deleteRes = await del(`/api/v1/seller/products/${product.id}/images/${image2.id}`, tokenA);
  assert.strictEqual(deleteRes.status, 204, "Delete image must return 204 NoContent");
  console.log("✅ PASSED: Image 2 deleted cleanly");

  // Verify remaining images count
  const listImages = await get(`/api/v1/products/${product.id}/images`, tokenA);
  assert.strictEqual(listImages.status, 200);
  assert.strictEqual(listImages.data.length, 2, "Must have exactly 2 images remaining");
  console.log("✅ PASSED: Remaining images list accurately reflects deletion");

  // 14. Publish Product
  console.log("\n--- 14. Publish Product to Public Catalog ---");
  const publishRes = await post(`/api/v1/seller/products/${product.id}/publish`, {}, tokenA);
  assert.strictEqual(publishRes.status, 200);
  assert.strictEqual(publishRes.data.status, "Published");
  console.log("✅ PASSED: Product successfully published");

  // 15. Verify Catalog Discovery & Image Presence
  console.log("\n--- 15. Verify Catalog Discovery with Real Image ---");
  const searchRes = await get(`/api/v1/products?keyword=${encodeURIComponent(productTitle)}`);
  assert.strictEqual(searchRes.status, 200);
  assert.ok(searchRes.data.items.length > 0, "Published product must appear in catalog search");
  const foundProduct = searchRes.data.items[0];
  assert.strictEqual(foundProduct.id, product.id);
  assert.ok(foundProduct.images.length >= 2, "Product in catalog must include uploaded images");
  assert.ok(foundProduct.images[0].url.includes("/content"), "Image URL must point to content endpoint");
  const pubStream = await fetch(`${API_BASE}${foundProduct.images[0].url}`);
  assert.strictEqual(pubStream.status, 200);
  assert.ok(pubStream.headers.get("cache-control")?.includes("public"), "Published product image must have public cache");
  assert.ok(pubStream.headers.get("cache-control")?.includes("immutable"), "Published product image must have immutable cache");
  console.log("✅ PASSED: Published product is discoverable with genuine image URLs and public immutable cache!");

  console.log("\n==================================================================");
  console.log("🎉 ALL 15 PHASE 2 SELLER IMAGE & SECURITY TESTS PASSED!");
  console.log("==================================================================\n");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
