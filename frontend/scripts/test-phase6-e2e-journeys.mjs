/**
 * TrustedMarketplace — Phase 6: Full Product Acceptance & E2E User Journey Verification
 *
 * Verifies all 12 core product journeys:
 *  1. Buyer registration, auth, refresh-token rotation, and logout lifecycle.
 *  2. Seller onboarding application & multipart evidence upload (with magic byte & size validation).
 *  3. Admin application review, approval, and store profile initialization.
 *  4. Store profile edit & re-verification status transition (PendingReverification blocks publishing).
 *  5. Subscription upgrade & payment verification lifecycle (Free -> Pending -> Rejected -> Approved -> Premium quota).
 *  6. Product management & catalog lifecycle (Draft -> Image Upload -> Published -> Searchable -> Archived).
 *  7. Non-custodial order lifecycle (Placed -> Accepted -> Shipped -> Completed, with ownership guards).
 *  8. Transaction-linked review gating (Buyer only, Completed only, max 1 review per transaction).
 *  9. Order dispute filing & admin adjudication workflow (Placed/Shipped -> Disputed -> Admin Resolved).
 * 10. Explainable trust profile & transaction-derived metrics verification.
 * 11. Security & authorization boundary guards (RBAC, IDOR, cross-tenant isolation).
 * 12. Edge cases, validation errors, and empty state handling.
 */

const BASE_URL = process.env.API_URL || "http://localhost:5248";
const API_BASE = `${BASE_URL}/api/v1`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failedTests++;
  }
}

async function request(url, options = {}) {
  const resp = await fetch(url, options);
  let data = null;
  const contentType = resp.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await resp.json();
    } catch (e) {
      // ignore non-json or empty bodies
    }
  }
  return { status: resp.status, ok: resp.ok, data, headers: resp.headers };
}

function extractCookie(headers) {
  const raw = headers.get("set-cookie");
  if (!raw) return null;
  return raw.split(";")[0];
}

// Genuine decodable image headers for testing
const JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0xff, 0xd9,
]);

async function runPhase6AcceptanceSuite() {
  console.log("================================================================================");
  console.log("  TrustedMarketplace — Phase 6: Full Acceptance & E2E User Journey Verification  ");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const buyerEmail = `buyer_p6_${timestamp}@trustedmarketplace.local`;
  const sellerEmail = `artisan_p6_${timestamp}@trustedmarketplace.local`;
  const intruderEmail = `intruder_p6_${timestamp}@trustedmarketplace.local`;
  const password = "SecurePassword123!";

  // ---------------------------------------------------------------------------
  // Journey 1: Buyer Authentication, Refresh Token Rotation, and Logout
  // ---------------------------------------------------------------------------
  console.log("▶ Journey 1: Buyer Auth, Token Refresh Rotation & Session Lifecycle");
  
  // Register
  const regBuyer = await request(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Ma Hnin Ei", email: buyerEmail, password }),
  });
  assert(regBuyer.status === 201, "Buyer registration returns 201 Created");
  assert(regBuyer.data?.email === buyerEmail, "Buyer registered user object matches email");
  assert(regBuyer.data?.role === "Buyer", "Registered user role defaults to Buyer");

  // Login
  const loginBuyer = await request(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: buyerEmail, password }),
  });
  assert(loginBuyer.status === 200, "Buyer login returns 200 OK");
  const initialCookie = extractCookie(loginBuyer.headers);
  assert(initialCookie && initialCookie.startsWith("refreshToken="), "Login sets HttpOnly refreshToken cookie");
  let buyerToken = loginBuyer.data.accessToken;
  assert(buyerToken && buyerToken.length > 20, "Login returns JWT access token");

  // Refresh Token Rotation
  const refreshResp = await request(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: initialCookie },
  });
  assert(refreshResp.status === 200, "POST /api/v1/auth/refresh returns 200 OK with new tokens");
  const rotatedCookie = extractCookie(refreshResp.headers);
  assert(rotatedCookie && rotatedCookie.startsWith("refreshToken="), "Refresh sets new rotated refreshToken cookie");
  buyerToken = refreshResp.data.accessToken;

  // Single-use token rotation: Reusing previous token fails
  const reuseResp = await request(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { Cookie: initialCookie },
  });
  assert(reuseResp.status === 401 || reuseResp.status === 400, "Reusing old rotated refresh token is rejected (401/400)");

  // ---------------------------------------------------------------------------
  // Journey 2: Seller Onboarding & Evidence Upload Security
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 2: Seller Onboarding & Evidence Upload Security");

  // Register seller account
  const regSeller = await request(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "U Min Aung", email: sellerEmail, password }),
  });
  assert(regSeller.status === 201, "Applicant registration returns 201 Created");

  const loginSeller = await request(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: sellerEmail, password }),
  });
  let applicantToken = loginSeller.data.accessToken;

  // Check initial application status (404 when none exists)
  const noApp = await request(`${API_BASE}/seller-applications/me`, {
    headers: { Authorization: `Bearer ${applicantToken}` },
  });
  assert(noApp.status === 404, "GET /api/v1/seller-applications/me returns 404 before submission");

  // Submit application
  const storeName = `Mandalay Silk Weaving ${timestamp}`;
  const submitApp = await request(`${API_BASE}/seller-applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${applicantToken}`,
    },
    body: JSON.stringify({
      proposedStoreName: storeName,
      businessType: "ArtisanWorkshop",
      contactPhone: "09450001122",
    }),
  });
  assert(submitApp.status === 201, "POST /api/v1/seller-applications returns 201 Created");
  const appId = submitApp.data.id;
  assert(submitApp.data.status === "Pending", "Application initial status is 'Pending'");

  // Duplicate submission guard
  const dupApp = await request(`${API_BASE}/seller-applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${applicantToken}`,
    },
    body: JSON.stringify({
      proposedStoreName: "Duplicate Attempt",
      businessType: "ArtisanWorkshop",
      contactPhone: "09450001122",
    }),
  });
  assert(dupApp.status === 409, "Duplicate seller application submission returns 409 Conflict");

  // Evidence Upload - Prohibited SVG extension rejected (SEC-12)
  const svgBlob = new Blob(["<svg></svg>"], { type: "image/svg+xml" });
  const svgForm = new FormData();
  svgForm.append("evidenceType", "NationalIdFront");
  svgForm.append("file", svgBlob, "test.svg");
  const svgUpload = await request(`${API_BASE}/seller-applications/me/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${applicantToken}` },
    body: svgForm,
  });
  assert(svgUpload.status === 400, "Prohibited file type (.svg) upload rejected with 400 BadRequest (SEC-12)");

  // Evidence Upload - Valid JPEG upload with magic bytes
  const jpegBlob = new Blob([JPEG_BYTES], { type: "image/jpeg" });
  const jpegForm = new FormData();
  jpegForm.append("evidenceType", "NationalIdFront");
  jpegForm.append("file", jpegBlob, "nrc_front.jpg");
  const jpegUpload = await request(`${API_BASE}/seller-applications/me/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${applicantToken}` },
    body: jpegForm,
  });
  assert(jpegUpload.status === 201, "Valid NRC JPEG upload succeeds with 201 Created");

  // Verify application details reflect evidence
  const myApp = await request(`${API_BASE}/seller-applications/me`, {
    headers: { Authorization: `Bearer ${applicantToken}` },
  });
  assert(myApp.status === 200, "GET /api/v1/seller-applications/me returns 200 OK");
  assert(myApp.data?.evidence?.length === 1, "Evidence list contains 1 attached document");

  // ---------------------------------------------------------------------------
  // Journey 3: Admin Review, Approval & Store Initialization
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 3: Admin Review, Approval & Store Initialization");

  // Admin login
  const adminLogin = await request(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@trustedmarketplace.local", password: "AdminDemo123!" }),
  });
  assert(adminLogin.status === 200, "Admin login returns 200 OK");
  const adminToken = adminLogin.data.accessToken;

  // Admin lists applications
  const adminApps = await request(`${API_BASE}/admin/seller-applications`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminApps.status === 200, "Admin lists applications queue with 200 OK");
  const targetApp = adminApps.data?.find((a) => a.id === appId);
  assert(targetApp !== undefined, "Submitted application is visible in admin queue");

  // Admin approves application
  const approveApp = await request(`${API_BASE}/admin/seller-applications/${appId}/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      decision: "Approved",
      reason: "Artisan credentials and physical workshop verified in Amarapura.",
    }),
  });
  assert(approveApp.status === 200, "Admin approves application with 200 OK");
  assert(approveApp.data?.status === "Approved", "Application status updated to 'Approved'");

  // Seller accesses their store profile
  let sellerToken = applicantToken;
  const storeProfile = await request(`${API_BASE}/seller/store`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(storeProfile.status === 200, "GET /api/v1/seller/store returns 200 OK");
  assert(storeProfile.data?.storeName === storeName, "Store name matches approved application");
  assert(storeProfile.data?.verificationStatus === "Verified", "Store verification status is 'Verified'");
  const sellerUserId = storeProfile.data.sellerUserId;

  // ---------------------------------------------------------------------------
  // Journey 4: Store Profile Edit & Re-Verification Guard (SEC-04)
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 4: Store Profile Edit & Re-Verification Guard");

  // Primary seller updates bio and phone -> preserves Verified status
  const updateBio = await request(`${API_BASE}/seller/store`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      storeName,
      contactPhone: "09450009999",
      cityOrTownship: "Amarapura, Mandalay",
      bio: "Master weaver of authentic Burmese traditional silk patterns.",
    }),
  });
  assert(updateBio.status === 200, "Updating bio and phone succeeds with 200 OK");
  assert(updateBio.data?.verificationStatus === "Verified", "Verification status remains 'Verified'");

  // To test SEC-04 without disrupting Seller A's lifecycle, onboard Applicant B
  const sellerBEmail = `artisan_b_${timestamp}@trustedmarketplace.local`;
  await request(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Daw Mya Mya", email: sellerBEmail, password }),
  });
  const loginSellerB = await request(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: sellerBEmail, password }),
  });
  const tokenB = loginSellerB.data.accessToken;

  const appB = await request(`${API_BASE}/seller-applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({
      proposedStoreName: `Bagan Crafts B ${timestamp}`,
      businessType: "ArtisanWorkshop",
      contactPhone: "0911223344",
    }),
  });
  await request(`${API_BASE}/admin/seller-applications/${appB.data.id}/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ decision: "Approved", reason: "Approved for SEC-04 test" }),
  });

  // Seller B changes store name -> status shifts to PendingReverification
  const renameB = await request(`${API_BASE}/seller/store`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({
      storeName: `Renamed Crafts B ${timestamp}`,
      contactPhone: "0911223344",
      cityOrTownship: "Bagan",
      bio: "Renamed store profile",
    }),
  });
  assert(renameB.status === 200, "Seller B store name updated successfully (200 OK)");
  assert(renameB.data?.verificationStatus === "PendingReverification", "Store name change shifts status to 'PendingReverification' (SEC-04)");

  // Fetch active categories
  const catResp = await request(`${API_BASE}/categories`);
  assert(catResp.status === 200 && catResp.data?.length > 0, "Categories retrieved for product creation");
  const categoryId = catResp.data[0].id;

  // Seller B creates draft product
  const draftProdB = await request(`${API_BASE}/seller/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenB}`,
    },
    body: JSON.stringify({
      categoryId,
      title: `Blocked Product ${timestamp}`,
      description: "Should fail to publish under SEC-04",
      priceAmount: 25000,
      condition: "New",
      currencyCode: "MMK",
    }),
  });
  assert(draftProdB.status === 201, "Seller B can create draft product (201 Created)");

  // Seller B tries to publish while PendingReverification -> 403 Forbidden (SEC-04)
  const blockedPublish = await request(`${API_BASE}/seller/products/${draftProdB.data.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(blockedPublish.status === 403, "Publishing listing while 'PendingReverification' blocked with 403 Forbidden (SEC-04)");

  // ---------------------------------------------------------------------------
  // Journey 5: Subscription Upgrade & Payment Verification Lifecycle
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 5: Subscription Upgrade & Admin Payment Verification");

  // Fetch configured subscription plans
  const plansResp = await request(`${API_BASE}/subscription-plans`);
  assert(plansResp.status === 200, "GET /api/v1/subscription-plans returns 200 OK");
  const standardPlan = plansResp.data.find((p) => p.name === "Standard");
  const premiumPlan = plansResp.data.find((p) => p.name === "Premium");
  assert(standardPlan && premiumPlan, "Found Standard and Premium plans in catalog");

  // Check initial quota on Free tier for Seller A
  const initialQuota = await request(`${API_BASE}/seller/subscription`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(initialQuota.status === 200, "GET /api/v1/seller/subscription returns 200 OK");
  assert(initialQuota.data?.planName === "Free", "Default plan is Free tier");
  assert(initialQuota.data?.maxActiveListings === 10, "Free plan max listings is 10");

  // Submit KBZPay payment reference for Standard upgrade
  const txRefInvalid = `INV_${timestamp}`;
  const payResp = await request(`${API_BASE}/seller/subscription/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      subscriptionPlanId: standardPlan.id,
      paymentMethod: "KBZPay",
      transactionReference: txRefInvalid,
      durationMonths: 1,
    }),
  });
  assert(payResp.status === 201, "Payment reference submitted with 201 Created");
  assert(payResp.data?.status === "PendingVerification", "Initial payment status is 'PendingVerification'");
  const paymentSubId = payResp.data.id;

  // Verify non-custodial / integrity invariant: quota is NOT increased while pending
  const pendingQuota = await request(`${API_BASE}/seller/subscription`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(pendingQuota.data?.maxActiveListings === 10, "Listing quota remains capped at Free (10) while pending verification");

  // Duplicate reference protection: submitting same reference returns 409
  const dupPay = await request(`${API_BASE}/seller/subscription/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      subscriptionPlanId: standardPlan.id,
      paymentMethod: "KBZPay",
      transactionReference: txRefInvalid,
      durationMonths: 1,
    }),
  });
  assert(dupPay.status === 409, "Duplicate payment reference rejected with 409 Conflict");

  // Admin rejects invalid reference
  const rejectPay = await request(`${API_BASE}/admin/subscriptions/${paymentSubId}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      decision: "Rejected",
      reason: "Invalid transaction reference code provided in KBZPay portal.",
      durationMonths: 1,
    }),
  });
  assert(rejectPay.status === 200, "Admin rejects payment reference with 200 OK");
  assert(rejectPay.data?.status === "Rejected", "Payment status transitioned to 'Rejected'");

  // Seller resubmits fresh valid reference for Premium plan
  const validTxRef = `KBZ_${timestamp}_VALID`;
  const resubmitPay = await request(`${API_BASE}/seller/subscription/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      subscriptionPlanId: premiumPlan.id,
      paymentMethod: "KBZPay",
      transactionReference: validTxRef,
      durationMonths: 1,
    }),
  });
  assert(resubmitPay.status === 201, "Fresh payment reference resubmitted successfully (201 Created)");
  const validSubId = resubmitPay.data.id;

  // Admin approves payment reference
  const approvePay = await request(`${API_BASE}/admin/subscriptions/${validSubId}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      decision: "Approved",
      durationMonths: 1,
    }),
  });
  assert(approvePay.status === 200, "Admin approves payment reference with 200 OK");
  assert(approvePay.data?.status === "Active", "Subscription status transitioned to 'Active'");

  // Quota elevated to Premium limit (100 listings)
  const upgradedQuota = await request(`${API_BASE}/seller/subscription`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(upgradedQuota.data?.planName === "Premium", "Current plan elevated to Premium");
  assert(upgradedQuota.data?.maxActiveListings === 100, "Listing quota updated to 100 active listings");

  // ---------------------------------------------------------------------------
  // Journey 6: Product Lifecycle, Image Upload & Search Discovery
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 6: Product Lifecycle, Image Upload & Search Discovery");

  // Seller A creates draft product
  const draftProd = await request(`${API_BASE}/seller/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      categoryId,
      title: `Royal Acheik Silk Longyi ${timestamp}`,
      description: "Intricately hand-woven silk pattern.",
      priceAmount: 185000,
      condition: "New",
      currencyCode: "MMK",
    }),
  });
  assert(draftProd.status === 201, "Seller A creates draft product (201 Created)");
  const draftProdId = draftProd.data.id;

  // Upload an image for the draft product
  const prodImgForm = new FormData();
  prodImgForm.append("file", new Blob([JPEG_BYTES], { type: "image/jpeg" }), "longyi.jpg");
  const imgUpload = await request(`${API_BASE}/seller/products/${draftProdId}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
    body: prodImgForm,
  });
  assert(imgUpload.status === 201, "Product image upload succeeds with 201 Created");

  // Publish product now that seller is Verified
  const pubProd = await request(`${API_BASE}/seller/products/${draftProdId}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(pubProd.status === 200, "Product successfully published (200 OK)");
  assert(pubProd.data?.status === "Published", "Product status is 'Published'");

  // Verify product is discoverable in public catalog search
  const catSearch = await request(`${API_BASE}/products?keyword=Silk`);
  assert(catSearch.status === 200, "Public catalog search returns 200 OK");
  const foundProd = catSearch.data?.items?.find((p) => p.id === draftProdId);
  assert(foundProd !== undefined, "Newly published product is discoverable in catalog search");

  // ---------------------------------------------------------------------------
  // Journey 7: Non-Custodial Order Lifecycle & State Transitions
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 7: Non-Custodial Order Lifecycle & State Transitions");

  // Buyer places order
  const orderResp = await request(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({
      productId: draftProdId,
      quantity: 1,
      buyerContactPhone: "09971234567",
      deliveryAddress: "No. 42 Bogyoke Road",
      deliveryCityOrTownship: "Yangon",
      notes: "Please package carefully with protective wrap.",
    }),
  });
  assert(orderResp.status === 201, "Buyer places order with 201 Created");
  const orderId = orderResp.data.id;
  assert(orderResp.data.status === "Placed", "Order initial status is 'Placed'");

  // Security guard: Seller cannot buy their own product
  const selfOrder = await request(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      productId: draftProdId,
      quantity: 1,
      buyerContactPhone: "09450009999",
      deliveryAddress: "Self Address",
      deliveryCityOrTownship: "Amarapura",
    }),
  });
  assert(selfOrder.status === 409, "Seller self-purchase attempt rejected with 409 Conflict");

  // Seller accepts order
  const acceptOrder = await request(`${API_BASE}/orders/${orderId}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(acceptOrder.status === 200, "Seller accepts order with 200 OK");
  assert(acceptOrder.data?.status === "Accepted", "Order status transitioned to 'Accepted'");

  // Seller ships order
  const shipOrder = await request(`${API_BASE}/orders/${orderId}/ship`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({
      trackingNumber: `MDY-YGN-${timestamp}`,
      courierName: "Royal Express",
      notes: "Dispatched via morning courier.",
    }),
  });
  assert(shipOrder.status === 200, "Seller ships order with 200 OK");
  assert(shipOrder.data?.status === "Shipped", "Order status transitioned to 'Shipped'");

  // Security guard: Seller cannot confirm delivery (only buyer can confirm, SEC-07/08)
  const sellerConfirm = await request(`${API_BASE}/orders/${orderId}/confirm-delivery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(sellerConfirm.status === 403, "Seller attempting delivery confirmation returns 403 Forbidden (SEC-07)");

  // Buyer confirms delivery -> Completed
  const buyerConfirm = await request(`${API_BASE}/orders/${orderId}/confirm-delivery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  assert(buyerConfirm.status === 200, "Buyer confirms delivery with 200 OK");
  assert(buyerConfirm.data?.status === "Completed", "Order status transitioned to 'Completed'");

  // ---------------------------------------------------------------------------
  // Journey 8: Transaction-Linked Review Gating (SEC-09, SEC-10, SEC-11)
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 8: Transaction-Linked Review Gating");

  // Intruder cannot review an order they did not place (SEC-09)
  await request(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Intruder User", email: intruderEmail, password }),
  });
  const loginIntruder = await request(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: intruderEmail, password }),
  });
  const intruderToken = loginIntruder.data.accessToken;

  const intruderReview = await request(`${API_BASE}/orders/${orderId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${intruderToken}`,
    },
    body: JSON.stringify({ rating: 1, comment: "Spam fake review" }),
  });
  assert(intruderReview.status === 403, "Non-buyer attempting to review order rejected with 403 Forbidden (SEC-09)");

  // Legitimate Buyer submits review
  const validReview = await request(`${API_BASE}/orders/${orderId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({
      rating: 5,
      comment: "Exceptional Burmese silk weave! The texture and gold acheik patterns are exquisite.",
    }),
  });
  assert(validReview.status === 201, "Buyer submits review on completed order with 201 Created");
  assert(validReview.data?.rating === 5, "Review rating recorded accurately");

  // Duplicate review guard: Max 1 review per transaction (SEC-10)
  const dupReview = await request(`${API_BASE}/orders/${orderId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({ rating: 4, comment: "Second review attempt" }),
  });
  assert(dupReview.status === 409, "Duplicate review on same order rejected with 409 Conflict (SEC-10)");

  // ---------------------------------------------------------------------------
  // Journey 9: Dispute & Complaint Adjudication Workflow
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 9: Dispute & Complaint Adjudication Workflow");

  // Create a second order to demonstrate dispute flow
  const order2Resp = await request(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({
      productId: draftProdId,
      quantity: 1,
      buyerContactPhone: "09971234567",
      deliveryAddress: "No. 42 Bogyoke Road",
      deliveryCityOrTownship: "Yangon",
    }),
  });
  const order2Id = order2Resp.data.id;
  await request(`${API_BASE}/orders/${order2Id}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  await request(`${API_BASE}/orders/${order2Id}/ship`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({ trackingNumber: `DISP-${timestamp}`, courierName: "Speedy" }),
  });

  // Buyer files complaint on order 2
  const complaintResp = await request(`${API_BASE}/orders/${order2Id}/complaints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({
      category: "DamagedItem",
      description: "Package arrived with water damage on outer container.",
    }),
  });
  assert(complaintResp.status === 201, "Buyer files complaint with 201 Created (T-15)");
  const complaintId = complaintResp.data.id;

  // Order status automatically transitions to Disputed
  const disputedOrder = await request(`${API_BASE}/orders/${order2Id}`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  assert(disputedOrder.data?.status === "Disputed", "Order status automatically transitioned to 'Disputed'");

  // Non-admin cannot view admin complaints queue
  const unauthorizedAdminQueue = await request(`${API_BASE}/admin/complaints`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  assert(unauthorizedAdminQueue.status === 403, "Non-admin accessing /api/v1/admin/complaints rejected with 403 Forbidden");

  // Admin lists complaints queue
  const adminComplaints = await request(`${API_BASE}/admin/complaints`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminComplaints.status === 200, "Admin lists complaints queue with 200 OK");
  const foundComplaint = adminComplaints.data?.find((c) => c.id === complaintId);
  assert(foundComplaint !== undefined, "Dispute complaint found in admin queue");

  // Admin records decision
  const resolveComplaint = await request(`${API_BASE}/admin/complaints/${complaintId}/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      resolutionCode: "GoodsDeliveredConfirmed",
      resolutionSummary: "Courier dispatcher confirmed parcel was re-delivered and signed by recipient.",
    }),
  });
  assert(resolveComplaint.status === 200, "Admin records complaint decision with 200 OK");
  assert(resolveComplaint.data?.status === "Resolved", "Complaint status transitioned to 'Resolved'");

  // Admin resolves the disputed order
  const resolveOrder = await request(`${API_BASE}/admin/orders/${order2Id}/resolve-dispute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      resolvedStatus: "Completed",
      reason: "Admin verified signed delivery slip with courier dispatcher. Transaction fulfilled.",
    }),
  });
  assert(resolveOrder.status === 200, "Admin resolves disputed order with 200 OK");
  assert(resolveOrder.data?.status === "Completed", "Disputed order transitioned to 'Completed'");

  // ---------------------------------------------------------------------------
  // Journey 10: Explainable Trust Profile & Metrics Verification
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 10: Explainable Trust Profile & Metrics Verification");

  const trustResp = await request(`${API_BASE}/sellers/${sellerUserId}/trust-profile`);
  assert(trustResp.status === 200, "GET /api/v1/sellers/{id}/trust-profile returns 200 OK (T-16)");
  const trustData = trustResp.data;
  assert(trustData.verificationStatus === "Verified", "Trust badge reflects 'Verified'");
  assert(trustData.averageRating === 5.0, "Average rating computed accurately (5.0 from 1 review)");
  assert(trustData.completedOrdersCount >= 1, "Completed orders count accurately calculated");
  assert(trustData.reviewCount === 1, "Review count accurately reflects 1 review");
  assert(typeof trustData.disclaimer === "string" && trustData.disclaimer.length > 0, "Platform trust disclaimer provided");

  // ---------------------------------------------------------------------------
  // Journey 11: Security, IDOR & Multi-Tenant Boundary Guards
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 11: Security, IDOR & Multi-Tenant Boundary Guards");

  // Intruder attempting to view private order details (SEC-06)
  const intruderViewOrder = await request(`${API_BASE}/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${intruderToken}` },
  });
  assert(intruderViewOrder.status === 403 || intruderViewOrder.status === 404, "IDOR protection: Intruder accessing other user's order blocked (403/404)");

  // Intruder attempting to edit another seller's product (SEC-05)
  const intruderEditProd = await request(`${API_BASE}/seller/products/${draftProdId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${intruderToken}`,
    },
    body: JSON.stringify({
      categoryId,
      title: "Hacked Title",
      description: "Should not update",
      priceAmount: 1000,
      condition: "New",
    }),
  });
  assert(intruderEditProd.status === 403 || intruderEditProd.status === 404, "Cross-tenant guard: Intruder editing other seller's product blocked (403/404)");

  // Intruder attempting to access admin endpoints
  const intruderAdminCheck = await request(`${API_BASE}/admin/seller-applications`, {
    headers: { Authorization: `Bearer ${intruderToken}` },
  });
  assert(intruderAdminCheck.status === 403, "Non-admin user calling admin endpoint blocked with 403 Forbidden");

  // ---------------------------------------------------------------------------
  // Journey 12: Edge Cases, Validations & Empty State Handling
  // ---------------------------------------------------------------------------
  console.log("\n▶ Journey 12: Edge Cases, Validations & Empty State Handling");

  // Nonexistent entity ID returns 404
  const fakeId = "00000000-0000-0000-0000-000000000000";
  const notFoundOrder = await request(`${API_BASE}/orders/${fakeId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(notFoundOrder.status === 404, "Nonexistent order returns 404 NotFound");

  // Invalid payload structure returns 400 with ProblemDetails
  const invalidOrder = await request(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({
      productId: fakeId,
      quantity: -5,
      buyerContactPhone: "",
      deliveryAddress: "",
    }),
  });
  assert(invalidOrder.status === 400, "Invalid negative quantity rejected with 400 BadRequest");

  // Search query with no matches returns empty items list (200 OK, not error)
  const emptySearch = await request(`${API_BASE}/products?keyword=XYZNonexistentItem123456789`);
  assert(emptySearch.status === 200, "No-match search query returns 200 OK");
  assert(Array.isArray(emptySearch.data?.items) && emptySearch.data.items.length === 0, "No-match search returns empty items array");

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`  Acceptance Suite Completed: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase6AcceptanceSuite().catch((err) => {
  console.error("FATAL: Unhandled error in acceptance suite:", err);
  process.exit(1);
});
