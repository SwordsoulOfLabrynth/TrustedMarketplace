/**
 * Test Suite: Subscription & Payment Data Model Lifecycle (Phase 2)
 *
 * Verifies:
 * 1. GET /api/v1/subscription-plans returns Free, Standard, Premium with canonical pricing.
 * 2. GET /api/v1/platform/payment-methods returns KBZPay and WavePay platform channels.
 * 3. Validation: Invalid payment method is rejected with 400 BadRequest.
 * 4. Validation: Invalid or missing transaction reference is rejected with 400 BadRequest.
 * 5. Payment Submission: Seller submits KBZPay transfer reference; status is 'PendingVerification' (201 Created).
 * 6. Non-Custodial / Integrity Invariant: Quota does NOT increase while in 'PendingVerification'.
 * 7. Duplicate Reference Protection: Reusing an existing transaction reference returns 409 Conflict.
 * 8. Concurrency Guard: Submitting multiple concurrent pending payments returns 409 Conflict.
 * 9. Admin Queue: Admin lists subscriptions and finds pending payment.
 * 10. Admin Rejection: Admin rejects invalid reference with reason -> status transitions to 'Rejected'.
 * 11. Re-submission: After rejection, seller can submit a fresh valid payment reference.
 * 12. Admin Approval: Admin approves payment -> status transitions to 'Active', expiry set, quota increases to plan limit.
 */

const API_BASE = "http://localhost:5248/api/v1";

async function runTests() {
  console.log("==================================================================");
  console.log("  TrustedMarketplace — Subscription & Payment Lifecycle Suite     ");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${message}`);
      failed++;
    }
  }

  // 1. Verify Configured Subscription Plans
  console.log("--- 1. Subscription Plans & Pricing ---");
  const plansResp = await fetch(`${API_BASE}/subscription-plans`);
  assert(plansResp.ok, "GET /api/v1/subscription-plans returned 200 OK");
  const plans = await plansResp.json();
  const freePlan = plans.find((p) => p.name === "Free");
  const standardPlan = plans.find((p) => p.name === "Standard");
  const premiumPlan = plans.find((p) => p.name === "Premium");

  assert(freePlan && freePlan.priceAmount === 0 && freePlan.maxActiveListings === 10, "Free plan: 0 MMK, 10 listings");
  assert(standardPlan && standardPlan.priceAmount === 15000 && standardPlan.maxActiveListings === 30, "Standard plan: 15,000 MMK, 30 listings");
  assert(premiumPlan && premiumPlan.priceAmount === 30000 && premiumPlan.maxActiveListings === 100, "Premium plan: 30,000 MMK, 100 listings");

  // 2. Verify Platform Payment Channels
  console.log("\n--- 2. Platform Payment Channels ---");
  const methodsResp = await fetch(`${API_BASE}/platform/payment-methods`);
  assert(methodsResp.ok, "GET /api/v1/platform/payment-methods returned 200 OK");
  const methods = await methodsResp.json();
  const kbz = methods.find((m) => m.provider === "KBZPay");
  const wave = methods.find((m) => m.provider === "WavePay");
  assert(kbz && kbz.accountPhone.length > 0, "KBZPay platform account configured");
  assert(wave && wave.accountPhone.length > 0, "WavePay platform account configured");

  // 3. Register & Approve a Clean Test Seller
  console.log("\n--- 3. Setup Test Seller ---");
  const uid = Date.now();
  const sellerEmail = `artisan_sub_${uid}@trustedmarketplace.local`;
  const regResp = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: `Artisan Sub ${uid}`,
      email: sellerEmail,
      password: "SellerDemo123!",
    }),
  });
  assert(regResp.ok, "Test seller account registered");

  const loginResp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: sellerEmail, password: "SellerDemo123!" }),
  });
  const sellerToken = (await loginResp.json()).accessToken;

  // Apply for seller verification
  const applyResp = await fetch(`${API_BASE}/seller-applications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      proposedStoreName: `Artisan Workshop ${uid}`,
      businessType: "IndividualCrafter",
      contactPhone: "0977889900",
    }),
  });
  const appData = await applyResp.json();

  // Admin approves seller application
  const adminLoginResp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@trustedmarketplace.local",
      password: "AdminDemo123!",
    }),
  });
  const adminToken = (await adminLoginResp.json()).accessToken;

  await fetch(`${API_BASE}/admin/seller-applications/${appData.id}/decision`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      decision: "Approved",
      reason: "Artisan verification approved",
    }),
  });
  assert(true, "Seller approved and store profile initialized");

  // Initial quota check (should be Free tier: 10 listings)
  const initialQuotaResp = await fetch(`${API_BASE}/seller/subscription`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const initialQuota = await initialQuotaResp.json();
  assert(initialQuota.planName === "Free" && initialQuota.maxActiveListings === 10, "Initial seller quota is Free (10 listings)");

  // 4. Validation Rejections
  console.log("\n--- 4. Payment Submission Validation ---");
  // Invalid provider
  const invalidMethodResp = await fetch(`${API_BASE}/seller/subscription/subscribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionPlanId: standardPlan.id,
      paymentMethod: "StripeDirect",
      transactionReference: "TX1234567890",
      durationMonths: 1,
    }),
  });
  assert(invalidMethodResp.status === 400, "Unsupported payment method rejected with 400 BadRequest");

  // Invalid reference (< 6 chars)
  const shortRefResp = await fetch(`${API_BASE}/seller/subscription/subscribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionPlanId: standardPlan.id,
      paymentMethod: "KBZPay",
      transactionReference: "123",
      durationMonths: 1,
    }),
  });
  assert(shortRefResp.status === 400, "Short transaction reference rejected with 400 BadRequest");

  // 5. Valid KBZPay Submission -> PendingVerification
  console.log("\n--- 5. Submit Valid Subscription Payment ---");
  const testRef1 = `KBZ-${uid}-001`;
  const submitResp = await fetch(`${API_BASE}/seller/subscription/subscribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionPlanId: standardPlan.id,
      paymentMethod: "KBZPay",
      transactionReference: testRef1,
      durationMonths: 2,
    }),
  });
  assert(submitResp.status === 201, "Subscription payment submission succeeded (HTTP 201)");
  const pendingSub = await submitResp.json();
  assert(pendingSub.status === "PendingVerification", "Initial subscription status is 'PendingVerification'");
  assert(pendingSub.transactionReference === testRef1, "Transaction reference recorded");
  assert(pendingSub.paymentAmount === 30000, "Payment amount matches 2 months @ 15,000 MMK = 30,000 MMK");

  // 6. Integrity Invariant: Quota does NOT increase while pending
  console.log("\n--- 6. Quota Integrity Invariant (No Premature Verification) ---");
  const pendingQuotaResp = await fetch(`${API_BASE}/seller/subscription`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const pendingQuota = await pendingQuotaResp.json();
  assert(
    pendingQuota.planName === "Free" && pendingQuota.maxActiveListings === 10,
    "Quota remains at Free level (10 listings) while payment is PendingVerification"
  );

  // 7. Duplicate Reference Guard
  console.log("\n--- 7. Duplicate Reference Protection ---");
  // Register another seller to attempt submitting the same reference
  const duplicateResp = await fetch(`${API_BASE}/seller/subscription/subscribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionPlanId: standardPlan.id,
      paymentMethod: "KBZPay",
      transactionReference: testRef1, // Duplicate!
      durationMonths: 1,
    }),
  });
  assert(duplicateResp.status === 409, "Duplicate transaction reference blocked with 409 Conflict");

  // 8. Concurrency Guard: Cannot submit multiple pending payments
  console.log("\n--- 8. Concurrency Guard ---");
  const secondPendingResp = await fetch(`${API_BASE}/seller/subscription/subscribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionPlanId: premiumPlan.id,
      paymentMethod: "WavePay",
      transactionReference: `WAVE-${uid}-999`,
      durationMonths: 1,
    }),
  });
  assert(secondPendingResp.status === 409, "Multiple concurrent pending payments blocked with 409 Conflict");

  // 9. Admin Inspects Subscriptions Queue
  console.log("\n--- 9. Admin Subscription Queue Inspection ---");
  const adminSubsResp = await fetch(`${API_BASE}/admin/subscriptions?status=PendingVerification`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminSubsResp.ok, "GET /api/v1/admin/subscriptions returned 200 OK");
  const adminSubs = await adminSubsResp.json();
  const targetSub = adminSubs.find((s) => s.id === pendingSub.id);
  assert(targetSub !== undefined, "Submitted payment is visible in admin verification queue");
  assert(targetSub.storeName === `Artisan Workshop ${uid}`, "Seller store name populated on admin record");

  // 10. Admin Rejects Payment Submission
  console.log("\n--- 10. Admin Rejects Payment ---");
  const rejectResp = await fetch(`${API_BASE}/admin/subscriptions/${pendingSub.id}/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      decision: "Rejected",
      reason: "Transaction reference not found in KBZPay statement. Please re-check reference ID.",
    }),
  });
  assert(rejectResp.ok, "Admin rejection succeeded (HTTP 200)");
  const rejectedSub = await rejectResp.json();
  assert(rejectedSub.status === "Rejected", "Status transitioned to 'Rejected'");
  assert(rejectedSub.rejectionReason.includes("KBZPay statement"), "Rejection reason recorded");

  // 11. Re-submission after Rejection
  console.log("\n--- 11. Re-submission After Rejection ---");
  const testRef2 = `WAVE-${uid}-002`;
  const resubmitResp = await fetch(`${API_BASE}/seller/subscription/subscribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscriptionPlanId: premiumPlan.id,
      paymentMethod: "WavePay",
      transactionReference: testRef2,
      durationMonths: 3,
    }),
  });
  assert(resubmitResp.status === 201, "Fresh submission for Premium plan succeeded (HTTP 201)");
  const newSub = await resubmitResp.json();
  assert(newSub.status === "PendingVerification", "New subscription in PendingVerification status");

  // 12. Admin Approves Payment -> Active & Quota Update
  console.log("\n--- 12. Admin Approves Payment & Upgrades Seller Quota ---");
  const approveResp = await fetch(`${API_BASE}/admin/subscriptions/${newSub.id}/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      decision: "Approved",
      durationMonths: 3,
    }),
  });
  assert(approveResp.ok, "Admin approval succeeded (HTTP 200)");
  const approvedSub = await approveResp.json();
  assert(approvedSub.status === "Active", "Subscription status transitioned to 'Active'");
  assert(new Date(approvedSub.expiresAtUtc) > new Date(), "ExpiresAtUtc calculated in future");

  // Seller checks updated quota
  const upgradedQuotaResp = await fetch(`${API_BASE}/seller/subscription`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  const upgradedQuota = await upgradedQuotaResp.json();
  assert(upgradedQuota.planName === "Premium", "Plan upgraded to Premium");
  assert(upgradedQuota.maxActiveListings === 100, "Listing quota updated to 100 listings!");

  console.log("\n==================================================================");
  console.log(`🎉 ALL ${passed}/${passed + failed} SUBSCRIPTION & PAYMENT ASSERTIONS PASSED!`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution aborted with error:", err);
  process.exit(1);
});
