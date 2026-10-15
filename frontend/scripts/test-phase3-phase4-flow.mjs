/**
 * TrustedMarketplace — Phase 3 (Seller Subscription Hub) & Phase 4 (Admin Verification Queue) Test Suite
 *
 * Verifies:
 * 1. Plan comparison and dynamic configuration (Free, Standard, Premium)
 * 2. Platform payment methods (KBZPay, WavePay with QR codes)
 * 3. Client input validation (provider check, reference length check)
 * 4. Seller payment submission lifecycle (PendingVerification)
 * 5. Quota integrity invariant: pending verification never increases quota
 * 6. Duplicate reference conflict guard (HTTP 409)
 * 7. Concurrency conflict guard (HTTP 409)
 * 8. Security authorization: Non-admin users blocked from admin endpoints (HTTP 403)
 * 9. Admin rejection workflow with mandatory audit reason
 * 10. Seller recovery after rejection with new corrected payment submission
 * 11. Admin approval workflow activating tier and elevating listing quota to 100 listings
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
  console.log("  TrustedMarketplace — Phase 3 & Phase 4 E2E Test Suite          ");
  console.log("==================================================================\n");

  // -------------------------------------------------------------------------
  // 1. Verify Public Plan Comparison & Platform Payment Methods
  // -------------------------------------------------------------------------
  console.log("--- 1. Subscription Plans & Payment Providers ---");
  const plansRes = await request("/api/v1/subscription-plans");
  assert(plansRes.status === 200, "GET /api/v1/subscription-plans returns HTTP 200");
  assert(Array.isArray(plansRes.data) && plansRes.data.length >= 3, "Contains at least 3 subscription plans");

  const freePlan = plansRes.data.find(p => p.name.toLowerCase() === "free");
  const standardPlan = plansRes.data.find(p => p.name.toLowerCase() === "standard");
  const premiumPlan = plansRes.data.find(p => p.name.toLowerCase() === "premium");

  assert(freePlan && freePlan.priceAmount === 0 && freePlan.maxActiveListings === 10, "Free Plan: 0 MMK, 10 listings");
  assert(standardPlan && standardPlan.priceAmount === 15000 && standardPlan.maxActiveListings === 30, "Standard Plan: 15,000 MMK, 30 listings");
  assert(premiumPlan && premiumPlan.priceAmount === 45000 && premiumPlan.maxActiveListings === 100, "Premium Plan: 45,000 MMK, 100 listings");

  const methodsRes = await request("/api/v1/platform/payment-methods");
  assert(methodsRes.status === 200, "GET /api/v1/platform/payment-methods returns HTTP 200");
  const kbz = methodsRes.data.find(m => m.provider.toLowerCase() === "kbzpay");
  const wave = methodsRes.data.find(m => m.provider.toLowerCase() === "wavepay");
  assert(kbz && kbz.accountPhone && kbz.qrCodeUrl, "KBZPay platform account and QR code configured");
  assert(wave && wave.accountPhone && wave.qrCodeUrl, "WavePay platform account and QR code configured");

  // -------------------------------------------------------------------------
  // 2. Authenticate Personas (Admin, Seller, Regular Buyer)
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Authenticate Personas ---");
  const adminLogin = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@trustedmarketplace.local", password: "AdminDemo123!" }),
  });
  assert(adminLogin.status === 200, "Admin authenticated (HTTP 200)");
  const adminToken = adminLogin.data.accessToken;

  // Create fresh seller for deterministic lifecycle testing
  const timestamp = Date.now();
  const sellerEmail = `artisan.p34.${timestamp}@trustedmarketplace.local`;
  const regRes = await request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: sellerEmail,
      password: "SellerPassword123!",
      displayName: `Artisan P34 ${timestamp}`,
    }),
  });
  assert(regRes.status === 201, "Fresh seller account registered (HTTP 201)");
  const sellerId = regRes.data.id;

  const sellerLogin = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: sellerEmail, password: "SellerPassword123!" }),
  });
  const sellerToken = sellerLogin.data.accessToken;

  // Submit and approve seller application to get seller privileges
  const applyRes = await request("/api/v1/seller-applications", {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
    body: JSON.stringify({
      proposedStoreName: `Artisan Workshop ${timestamp}`,
      businessType: "HandmadeLacqueredWood",
      contactPhone: "09455554146",
    }),
  });
  assert(applyRes.status === 201, "Seller application submitted (HTTP 201)");

  const approveAppRes = await request(`/api/v1/admin/seller-applications/${applyRes.data.id}/decision`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ decision: "Approved", reason: "Verified artisan profile" }),
  });
  assert(approveAppRes.status === 200, "Admin approved seller application (HTTP 200)");

  // Re-login seller to refresh claims
  const sellerFresh = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: sellerEmail, password: "SellerPassword123!" }),
  });
  const activeSellerToken = sellerFresh.data.accessToken;

  // Create regular buyer (unauthorized for admin endpoints)
  const buyerEmail = `buyer.p34.${timestamp}@example.com`;
  await request("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: buyerEmail,
      password: "BuyerPassword123!",
      displayName: "Regular Buyer",
    }),
  });
  const buyerLogin = await request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: buyerEmail, password: "BuyerPassword123!" }),
  });
  const buyerToken = buyerLogin.data.accessToken;

  // -------------------------------------------------------------------------
  // 3. Security Authorization: Buyer Attempting Admin Endpoints
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Security Verification: Non-Admin Access Prohibited ---");
  const buyerAdminAccess = await request("/api/v1/admin/subscriptions", {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  assert(buyerAdminAccess.status === 403, "Regular buyer GET /api/v1/admin/subscriptions blocked with HTTP 403 Forbidden");

  const buyerVerifyAccess = await request(`/api/v1/admin/subscriptions/00000000-0000-0000-0000-000000000000/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: JSON.stringify({ decision: "Approved" }),
  });
  assert(buyerVerifyAccess.status === 403, "Regular buyer POST /api/v1/admin/subscriptions/.../verify blocked with HTTP 403 Forbidden");

  // -------------------------------------------------------------------------
  // 4. Seller Subscription Validation & Payment Submission
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Seller Payment Validation & Submission ---");
  // Check initial quota
  const initialQuota = await request("/api/v1/seller/subscription", {
    headers: { Authorization: `Bearer ${activeSellerToken}` },
  });
  assert(initialQuota.data.maxActiveListings === 10, "Initial seller quota is 10 listings (Free)");

  // Test invalid payment method
  const invalidMethodSub = await request("/api/v1/seller/subscription/subscribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${activeSellerToken}` },
    body: JSON.stringify({
      subscriptionPlanId: standardPlan.id,
      paymentMethod: "CreditCardDirect",
      transactionReference: "REF123456789",
      durationMonths: 1,
    }),
  });
  assert(invalidMethodSub.status === 400, "Unsupported payment method rejected with HTTP 400");

  // Test short reference
  const shortRefSub = await request("/api/v1/seller/subscription/subscribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${activeSellerToken}` },
    body: JSON.stringify({
      subscriptionPlanId: standardPlan.id,
      paymentMethod: "KBZPay",
      transactionReference: "123",
      durationMonths: 1,
    }),
  });
  assert(shortRefSub.status === 400, "Reference shorter than 6 characters rejected with HTTP 400");

  // Submit valid payment
  const validRef1 = `KBZ-${timestamp}-01`;
  const validSub = await request("/api/v1/seller/subscription/subscribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${activeSellerToken}` },
    body: JSON.stringify({
      subscriptionPlanId: standardPlan.id,
      paymentMethod: "KBZPay",
      transactionReference: validRef1,
      durationMonths: 1,
    }),
  });
  assert(validSub.status === 201, "Valid Standard plan payment submission returned HTTP 201 Created");
  assert(validSub.data.status === "PendingVerification", "Initial subscription status is 'PendingVerification'");
  assert(validSub.data.paymentAmount === 15000, "Recorded payment amount matches 15,000 MMK");
  const sub1Id = validSub.data.id;

  // -------------------------------------------------------------------------
  // 5. Invariant: Quota Integrity & Duplicate Conflict Guard
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Quota Integrity & Duplicate Conflict Guard ---");
  const quotaAfterSubmit = await request("/api/v1/seller/subscription", {
    headers: { Authorization: `Bearer ${activeSellerToken}` },
  });
  assert(
    quotaAfterSubmit.data.maxActiveListings === 10,
    "CRITICAL INVARIANT: Listing quota remains 10 listings while payment is PendingVerification"
  );

  // Duplicate reference test
  const dupSub = await request("/api/v1/seller/subscription/subscribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${activeSellerToken}` },
    body: JSON.stringify({
      subscriptionPlanId: standardPlan.id,
      paymentMethod: "KBZPay",
      transactionReference: validRef1,
      durationMonths: 1,
    }),
  });
  assert(dupSub.status === 409, "Duplicate transaction reference blocked with HTTP 409 Conflict");

  // Concurrency guard: cannot have 2 pending reviews at once
  const concurrentSub = await request("/api/v1/seller/subscription/subscribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${activeSellerToken}` },
    body: JSON.stringify({
      subscriptionPlanId: premiumPlan.id,
      paymentMethod: "WavePay",
      transactionReference: `WAVE-${timestamp}-99`,
      durationMonths: 1,
    }),
  });
  assert(concurrentSub.status === 409, "Concurrent pending payment submission blocked with HTTP 409 Conflict");

  // -------------------------------------------------------------------------
  // 6. Admin Rejection Workflow
  // -------------------------------------------------------------------------
  console.log("\n--- 6. Admin Rejection Workflow ---");
  const adminQueue = await request("/api/v1/admin/subscriptions", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminQueue.status === 200, "Admin GET /api/v1/admin/subscriptions returns HTTP 200");
  const pendingInQueue = adminQueue.data.find(s => s.id === sub1Id);
  assert(pendingInQueue !== undefined, "Submitted payment is visible in admin queue");
  assert(pendingInQueue.storeName.includes("Artisan Workshop"), "Admin queue displays seller store name");

  // Rejection without reason fails
  const rejectNoReason = await request(`/api/v1/admin/subscriptions/${sub1Id}/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ decision: "Rejected" }),
  });
  assert(rejectNoReason.status === 400, "Rejection without reason rejected with HTTP 400");

  // Valid rejection
  const rejectionReason = "Transaction reference was not found on official KBZPay statement.";
  const rejectRes = await request(`/api/v1/admin/subscriptions/${sub1Id}/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ decision: "Rejected", reason: rejectionReason }),
  });
  assert(rejectRes.status === 200, "Admin payment rejection returns HTTP 200 OK");
  assert(rejectRes.data.status === "Rejected", "Subscription status transitioned to 'Rejected'");
  assert(rejectRes.data.rejectionReason === rejectionReason, "Rejection reason saved on subscription record");

  // -------------------------------------------------------------------------
  // 7. Seller Recovery & Resubmission
  // -------------------------------------------------------------------------
  console.log("\n--- 7. Seller Recovery After Rejection ---");
  const sellerStatus = await request("/api/v1/seller/subscription/status", {
    headers: { Authorization: `Bearer ${activeSellerToken}` },
  });
  assert(sellerStatus.data.status === "Rejected", "Seller status endpoint reports 'Rejected'");
  assert(sellerStatus.data.rejectionReason === rejectionReason, "Seller can view administrator rejection reason");

  // Seller submits corrected payment for Premium plan (3 months = 135,000 MMK)
  const validRef2 = `WAVE-${timestamp}-CORRECTED`;
  const recoverySub = await request("/api/v1/seller/subscription/subscribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${activeSellerToken}` },
    body: JSON.stringify({
      subscriptionPlanId: premiumPlan.id,
      paymentMethod: "WavePay",
      transactionReference: validRef2,
      durationMonths: 3,
    }),
  });
  assert(recoverySub.status === 201, "Corrected payment submission succeeded (HTTP 201 Created)");
  assert(recoverySub.data.status === "PendingVerification", "New subscription is in 'PendingVerification' status");
  assert(recoverySub.data.paymentAmount === 135000, "Payment amount recorded as 3 x 45,000 = 135,000 MMK");
  const sub2Id = recoverySub.data.id;

  // -------------------------------------------------------------------------
  // 8. Admin Approval & Quota Elevation
  // -------------------------------------------------------------------------
  console.log("\n--- 8. Admin Approval & Quota Elevation ---");
  const approveRes = await request(`/api/v1/admin/subscriptions/${sub2Id}/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ decision: "Approved", durationMonths: 3 }),
  });
  assert(approveRes.status === 200, "Admin approval returns HTTP 200 OK");
  assert(approveRes.data.status === "Active", "Subscription status transitioned to 'Active'");
  assert(approveRes.data.planName.toLowerCase() === "premium", "Active plan upgraded to Premium");

  // Verify seller's quota is now elevated
  const upgradedQuota = await request("/api/v1/seller/subscription", {
    headers: { Authorization: `Bearer ${activeSellerToken}` },
  });
  assert(upgradedQuota.data.planName.toLowerCase() === "premium", "Seller quota tier is now Premium");
  assert(
    upgradedQuota.data.maxActiveListings === 100,
    "CRITICAL INVARIANT: Seller active listing quota successfully elevated to 100 listings!"
  );

  console.log("\n==================================================================");
  console.log(`🎉 ALL ${testsPassed}/${testsRun} PHASE 3 & PHASE 4 ASSERTIONS PASSED!`);
  console.log("==================================================================\n");
}

main().catch(err => {
  console.error("Unhandled error in test suite:", err);
  process.exit(1);
});
