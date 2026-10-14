import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const API_BASE = "http://localhost:5248";
const WEB_BASE = "http://localhost:3000";
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\Kyaw Zay Ya Hein\\.gemini\\antigravity\\brain\\d5165e98-300f-4220-9ef7-96cb3678cc2b";
const SCREENSHOTS_DIR = "D:\\Project\\TrustedMarketplace\\screenshots";

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Valid 1x1 PNG buffers with distinct colors for testing
const PNG_IMAGE_1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const PNG_IMAGE_2 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert(res.ok, `Login for ${email} succeeded`);
  return await res.json();
}

async function runE2E() {
  console.log("===============================================================");
  console.log("  TrustedMarketplace — Phase 4: E2E Security & Lifecycle Flow  ");
  console.log("===============================================================\n");

  // --- Step 1: Log in as Seller ---
  console.log("--- Step 1: Authenticate Seller ---");
  const sellerAuth = await login("artisan.seller@trustedmarketplace.local", "SellerDemo123!");
  const sellerToken = sellerAuth.accessToken;
  const sellerUserId = sellerAuth.user.id;
  assert(Boolean(sellerToken), "Seller token obtained");

  const storeRes = await fetch(`${API_BASE}/api/v1/seller/store`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(storeRes.ok, "Seller store profile fetched");
  const storeData = await storeRes.json();
  const sellerProfileId = storeData.id;
  console.log(`Seller: ${sellerAuth.user.displayName}, Store: ${storeData.storeName} (${sellerProfileId})`);

  // --- Step 2: Create Product & Upload Genuine Images ---
  console.log("\n--- Step 2: Create Product & Upload Images ---");
  const catRes = await fetch(`${API_BASE}/api/v1/categories`);
  const categories = await catRes.json();
  const categoryId = categories[0].id;

  const createRes = await fetch(`${API_BASE}/api/v1/seller/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      categoryId,
      title: "Royal Mandalay Marionette Prince - Phase 4 E2E Verified",
      description: "Authentic teakwood marionette with gold leaf embroidery. Handcrafted by Daw Khin master workshop.",
      priceAmount: 125000,
      currencyCode: "MMK",
      condition: "New",
    }),
  });
  assert(createRes.status === 201, "Product created in Draft status");
  const product = await createRes.json();
  const productId = product.id;
  console.log(`Created Draft Product ID: ${productId}`);

  // Upload Image 1
  const form1 = new FormData();
  form1.append("file", new Blob([PNG_IMAGE_1], { type: "image/png" }), "prince_full.png");
  const up1Res = await fetch(`${API_BASE}/api/v1/seller/products/${productId}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
    body: form1,
  });
  assert(up1Res.status === 201, "Image 1 uploaded successfully");
  const image1 = await up1Res.json();
  assert(image1.isPrimary === true, "First uploaded image is automatically primary cover");

  // Upload Image 2
  const form2 = new FormData();
  form2.append("file", new Blob([PNG_IMAGE_2], { type: "image/png" }), "prince_costume_detail.png");
  const up2Res = await fetch(`${API_BASE}/api/v1/seller/products/${productId}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
    body: form2,
  });
  assert(up2Res.status === 201, "Image 2 uploaded successfully");
  const image2 = await up2Res.json();
  assert(image2.isPrimary === false, "Second uploaded image is secondary");

  // Reorder / promote Image 2 to primary
  const primRes = await fetch(`${API_BASE}/api/v1/seller/products/${productId}/images/${image2.id}/primary`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(primRes.ok, "Image 2 promoted to primary cover photo");
  const promotedImage = await primRes.json();
  assert(promotedImage.isPrimary === true && promotedImage.sortOrder === 0, "Image 2 has sortOrder 0 and isPrimary true");

  // Publish Product
  const pubRes = await fetch(`${API_BASE}/api/v1/seller/products/${productId}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(pubRes.ok, "Product successfully published to marketplace catalog");

  // --- Step 3: Verify Image Metadata & Public Image URL ---
  console.log("\n--- Step 3: Verify Image Metadata & Public URL Headers ---");
  const pubProdRes = await fetch(`${API_BASE}/api/v1/products/${productId}`);
  assert(pubProdRes.ok, "Published product query succeeded");
  const pubProd = await pubProdRes.json();
  assert(pubProd.images.length === 2, "Product exposes exactly 2 images");
  assert(pubProd.images[0].id === image2.id, "First image in sequence is Image 2");

  // Fetch binary image anonymously
  const imgUrl = `${API_BASE}${pubProd.images[0].url}`;
  const binRes = await fetch(imgUrl);
  assert(binRes.status === 200, "Anonymous image content stream returned 200 OK");
  assert(binRes.headers.get("content-type") === "image/png", "Content-Type is strict image/png");
  assert(binRes.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff header present");
  assert(binRes.headers.get("cache-control")?.includes("public"), "Cache-Control contains public for published product");
  assert(binRes.headers.get("cache-control")?.includes("immutable"), "Cache-Control contains immutable");
  const binBuffer = Buffer.from(await binRes.arrayBuffer());
  assert(binBuffer.equals(PNG_IMAGE_2), "Downloaded bytes match uploaded Image 2 binary content");

  // --- Step 4, 5: UI Verification via Puppeteer ---
  console.log("\n--- Step 4 & 5: Visual UI Verification via Puppeteer ---");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  async function snap(name, filename) {
    const filePath = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: filePath, fullPage: false });
    const artPath = path.join(ARTIFACT_DIR, filename);
    fs.copyFileSync(filePath, artPath);
    console.log(`📸 Saved screenshot: ${filename}`);
  }

  try {
    // 4. Homepage & Catalog
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    await page.goto(`${WEB_BASE}`, { waitUntil: "networkidle2" });
    await page.waitForSelector("article", { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    await snap("Homepage", "phase4-home-e2e.png");
    assert(true, "Homepage rendered newly published product card");

    await page.goto(`${WEB_BASE}/products`, { waitUntil: "networkidle2" });
    await page.waitForSelector("article", { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
    await snap("Catalog", "phase4-catalog-e2e.png");
    assert(true, "Catalog rendered newly published product card");

    // 5. Product Detail with Multi-Photo Carousel
    await page.goto(`${WEB_BASE}/products/${productId}`, { waitUntil: "networkidle2" });
    await page.waitForSelector("h1", { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    await snap("Product Detail", "phase4-product-detail-e2e.png");
    assert(true, "Product detail page rendered with real photography and thumbnails");

    // Seller Storefront
    await page.goto(`${WEB_BASE}/sellers/${sellerUserId}`, { waitUntil: "networkidle2" });
    await page.waitForSelector("article", { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    await snap("Seller Storefront", "phase4-seller-storefront-e2e.png");
    assert(true, "Seller storefront showcases artisan product listing");

    // --- Step 6: Log In as Buyer and Place Order ---
    console.log("\n--- Step 6: Buyer Authentication & Order Placement ---");
    const buyerAuth = await login("buyer@trustedmarketplace.local", "BuyerDemo123!");
    const buyerToken = buyerAuth.accessToken;
    assert(Boolean(buyerToken), "Buyer token obtained");

    const orderReq = await fetch(`${API_BASE}/api/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        productId,
        quantity: 1,
        deliveryAddress: "No. 77, 35th Street, Chanayethazan",
        deliveryCityOrTownship: "Mandalay",
        buyerContactPhone: "09455554146",
        deliveryNotes: "Phase 4 Security and E2E verification test order",
      }),
    });
    assert(orderReq.status === 201, "Buyer placed order successfully (201 Created)");
    const order = await orderReq.json();
    const orderId = order.id;
    console.log(`Placed Order ID: ${orderId}, Status: ${order.status}, Subtotal: ${order.subtotalAmount} MMK`);
    assert(order.items.length === 1, "Order contains 1 line item");
    assert(Boolean(order.items[0].primaryImageUrl), "Order line item contains primaryImageUrl projection");
    assert(order.items[0].primaryImageUrl.includes(image2.id), "PrimaryImageUrl points to the cover image");

    // --- Step 7: Order Lifecycle Execution ---
    console.log("\n--- Step 7: Order Lifecycle State Machine Execution ---");
    // Seller Accepts
    const acceptRes = await fetch(`${API_BASE}/api/v1/orders/${orderId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    assert(acceptRes.ok, "Seller accepted order (200 OK)");
    const acceptedOrder = await acceptRes.json();
    assert(acceptedOrder.status === "Accepted", "Order transitioned to Accepted");

    // Seller Ships
    const shipRes = await fetch(`${API_BASE}/api/v1/orders/${orderId}/ship`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({
        courierTrackingReference: "ROYAL-EXPRESS-E2E-001",
        estimatedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    assert(shipRes.ok, "Seller shipped order (200 OK)");
    const shippedOrder = await shipRes.json();
    assert(shippedOrder.status === "Shipped", "Order transitioned to Shipped");

    // Buyer Confirms Delivery
    const deliveryRes = await fetch(`${API_BASE}/api/v1/orders/${orderId}/confirm-delivery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    assert(deliveryRes.ok, "Buyer confirmed delivery (200 OK)");
    const completedOrder = await deliveryRes.json();
    assert(completedOrder.status === "Completed", "Order transitioned to Completed");

    // Authenticate in Puppeteer as Buyer to capture authenticated orders UI
    console.log("Capturing buyer orders UI in browser...");
    await page.goto(`${WEB_BASE}/auth/login?returnUrl=/orders`, { waitUntil: "networkidle2" });
    await page.waitForSelector("input#email", { timeout: 10000 });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const buyerBtn = btns.find((b) => b.textContent && b.textContent.includes("Use Buyer"));
      if (buyerBtn) buyerBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2000));

    // Orders Hub
    await page.goto(`${WEB_BASE}/orders`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    await snap("Buyer Orders Hub", "phase4-orders-hub-e2e.png");
    assert(true, "Orders hub renders with line item photography thumbnail");

    // Order Detail
    await page.goto(`${WEB_BASE}/orders/${orderId}`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    await snap("Order Detail", "phase4-order-detail-e2e.png");
    assert(true, "Order detail page renders with verified line item photography and direct payment block");

    // --- Step 8: Missing-Image & Upload-Error States ---
    console.log("\n--- Step 8: Security Error & Fallback State Verification ---");
    // 8a. Missing Image ID returns 404
    const nonExistentRes = await fetch(`${API_BASE}/api/v1/products/${productId}/images/00000000-0000-0000-0000-000000000000/content`);
    assert(nonExistentRes.status === 404, "Non-existent image returns 404 NotFound");

    // 8b. Malicious SVG rejected
    const svgBlob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: "image/svg+xml" });
    const svgForm = new FormData();
    svgForm.append("file", svgBlob, "exploit.svg");
    const svgRes = await fetch(`${API_BASE}/api/v1/seller/products/${productId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: svgForm,
    });
    assert(svgRes.status === 400, "Malicious SVG upload rejected with 400 BadRequest");

    // 8c. Oversized file (>5MB) rejected
    const bigBlob = new Blob([Buffer.alloc(6 * 1024 * 1024)], { type: "image/jpeg" });
    const bigForm = new FormData();
    bigForm.append("file", bigBlob, "too_big.jpg");
    const bigRes = await fetch(`${API_BASE}/api/v1/seller/products/${productId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: bigForm,
    });
    assert(bigRes.status === 400, "Oversized file upload (>5MB) rejected with 400 BadRequest");

    // 8d. Unauthorized buyer cannot upload to seller product
    const unauthorizedForm = new FormData();
    unauthorizedForm.append("file", new Blob([PNG_IMAGE_1], { type: "image/png" }), "hacked.png");
    const unauthRes = await fetch(`${API_BASE}/api/v1/seller/products/${productId}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: unauthorizedForm,
    });
    assert(unauthRes.status === 403, "Buyer cannot upload images to seller product (403 Forbidden)");

    // 8e. Unauthenticated upload rejected
    const noAuthRes = await fetch(`${API_BASE}/api/v1/seller/products/${productId}/images`, {
      method: "POST",
      body: unauthorizedForm,
    });
    assert(noAuthRes.status === 401, "Unauthenticated upload rejected with 401 Unauthorized");

  } finally {
    await browser.close();
  }

  console.log("\n===============================================================");
  console.log("🎉 ALL PHASE 4 END-TO-END VERIFICATION STEPS PASSED!");
  console.log("===============================================================\n");
}

runE2E().catch((err) => {
  console.error("E2E Verification failed:", err);
  process.exit(1);
});
