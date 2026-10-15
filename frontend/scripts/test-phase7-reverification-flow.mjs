import assert from "node:assert";

const API_BASE = "http://localhost:5248/api/v1";

async function postJson(endpoint, body, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = res.status !== 204 ? await res.json().catch(() => null) : null;
  return { status: res.status, data };
}

async function getJson(endpoint, token = null) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { headers });
  const data = res.status !== 204 ? await res.json().catch(() => null) : null;
  return { status: res.status, data };
}

async function putJson(endpoint, body, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  const data = res.status !== 204 ? await res.json().catch(() => null) : null;
  return { status: res.status, data };
}

async function run() {
  console.log("==================================================================");
  console.log("  TrustedMarketplace — Phase 7: Store Re-verification E2E Suite   ");
  console.log("==================================================================\n");

  const uid = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

  // 1. Admin login
  console.log("--- 1. Authenticate Admin ---");
  const adminLogin = await postJson("/auth/login", {
    email: "admin@trustedmarketplace.local",
    password: "AdminDemo123!",
  });
  assert.strictEqual(adminLogin.status, 200, "Admin login failed");
  const adminToken = adminLogin.data.accessToken;
  console.log("✅ PASSED: Admin authenticated (HTTP 200)");

  // 2. Register Seller
  console.log("\n--- 2. Onboard & Verify Artisan Seller ---");
  const sellerEmail = `artisan_${uid}@trustedmarketplace.local`;
  const sellerReg = await postJson("/auth/register", {
    displayName: `Artisan ${uid}`,
    email: sellerEmail,
    password: "Password123!",
  });
  assert.strictEqual(sellerReg.status, 201, "Seller registration failed");

  const sellerLogin = await postJson("/auth/login", {
    email: sellerEmail,
    password: "Password123!",
  });
  assert.strictEqual(sellerLogin.status, 200, "Seller login failed");
  const sellerToken = sellerLogin.data.accessToken;
  const sellerUserId = sellerLogin.data.user.id;
  console.log("✅ PASSED: Seller registered and logged in (HTTP 200)");

  // Submit application
  const appRes = await postJson(
    "/seller-applications",
    {
      proposedStoreName: `Original Workshop ${uid}`,
      businessType: "ArtisanWorkshop",
      businessRegistrationNumber: "BRN-12345",
      contactPhone: "0911223344",
      businessAddress: "Mandalay Heritage Zone",
    },
    sellerToken
  );
  assert.strictEqual(appRes.status, 201, "Seller application failed");
  const appId = appRes.data.id;

  // Admin approves application
  const approveApp = await postJson(
    `/admin/seller-applications/${appId}/decision`,
    { decision: "Approved", reason: "Genuine workshop credentials verified." },
    adminToken
  );
  assert.strictEqual(approveApp.status, 200, "App approval failed");
  console.log("✅ PASSED: Application approved and store initialized (HTTP 200)");

  // Verify store status is 'Verified'
  const storeRes = await getJson("/seller/store", sellerToken);
  assert.strictEqual(storeRes.status, 200, "Get store failed");
  assert.strictEqual(storeRes.data.verificationStatus, "Verified");
  console.log("✅ PASSED: Initial store status is 'Verified'");

  // 3. Contact details update (Preserves Verified status)
  console.log("\n--- 3. Contact Details Update (Status Preservation) ---");
  const updatePhoneRes = await putJson(
    "/seller/store",
    {
      storeName: `Original Workshop ${uid}`, // unchanged store name
      contactPhone: "0999887766",
      cityOrTownship: "Mandalay Chanayethazan",
      bio: "Master wood carvers and traditional lacquer artisans.",
    },
    sellerToken
  );
  assert.strictEqual(updatePhoneRes.status, 200, "Update phone failed");
  assert.strictEqual(updatePhoneRes.data.verificationStatus, "Verified");
  console.log("✅ PASSED: Contact-detail-only change preserves 'Verified' status");

  // 4. Store name rename triggers PendingReverification
  console.log("\n--- 4. Store Name Change Triggers PendingReverification ---");
  const renameRes = await putJson(
    "/seller/store",
    {
      storeName: `Modified Brand Name ${uid}`, // changed store name
      contactPhone: "0999887766",
      cityOrTownship: "Mandalay Chanayethazan",
      bio: "Master wood carvers.",
    },
    sellerToken
  );
  assert.strictEqual(renameRes.status, 200, "Rename store failed");
  assert.strictEqual(renameRes.data.verificationStatus, "PendingReverification");
  console.log("✅ PASSED: Store name change shifts status to 'PendingReverification'");

  // 5. Product creation succeeds as draft, but publishing is blocked
  console.log("\n--- 5. Publishing Blocked While In PendingReverification ---");
  const catsRes = await getJson("/categories");
  const categoryId = catsRes.data[0].id;

  const createProdRes = await postJson(
    "/seller/products",
    {
      categoryId,
      title: `Draft Wooden Statue ${uid}`,
      description: "Hand-carved traditional teak statue.",
      priceAmount: 85000,
      condition: "New",
    },
    sellerToken
  );
  assert.strictEqual(createProdRes.status, 201, "Create draft failed");
  const productId = createProdRes.data.id;
  console.log("✅ PASSED: Seller can create draft product (HTTP 201)");

  const pubBlockedRes = await postJson(`/seller/products/${productId}/publish`, {}, sellerToken);
  assert.strictEqual(pubBlockedRes.status, 403, "Publish should be 403 Forbidden");
  console.log("✅ PASSED: SEC-04: Product publishing strictly blocked while PendingReverification (HTTP 403)");

  // 6. Admin inspects store queue
  console.log("\n--- 6. Admin Store Queue Inspection ---");
  const adminStoresRes = await getJson("/admin/seller-stores?status=PendingReverification", adminToken);
  assert.strictEqual(adminStoresRes.status, 200, "Admin stores failed");
  const foundInQueue = adminStoresRes.data.some((s) => s.sellerUserId === sellerUserId);
  assert.strictEqual(foundInQueue, true, "Store not found in admin queue");
  console.log("✅ PASSED: Store listed in GET /api/v1/admin/seller-stores");

  // 7. Security: Non-admin calling decision endpoint is 403
  console.log("\n--- 7. Security: Non-Admin Forbidden ---");
  const nonAdminDecRes = await postJson(
    `/admin/seller-stores/${sellerUserId}/decision`,
    { decision: "Approved" },
    sellerToken
  );
  assert.strictEqual(nonAdminDecRes.status, 403, "Non-admin should be forbidden");
  console.log("✅ PASSED: Non-admin decision attempt rejected with HTTP 403 Forbidden");

  // 8. Admin rejects without reason -> 400
  console.log("\n--- 8. Admin Decision Validation ---");
  const missingReasonRes = await postJson(
    `/admin/seller-stores/${sellerUserId}/decision`,
    { decision: "Rejected", reason: "" },
    adminToken
  );
  assert.strictEqual(missingReasonRes.status, 400, "Should reject empty reason");
  console.log("✅ PASSED: Rejection without rationale rejected with HTTP 400 BadRequest");

  // 9. Admin Rejects Re-verification
  console.log("\n--- 9. Admin Rejects Store Profile Change ---");
  const rejectRes = await postJson(
    `/admin/seller-stores/${sellerUserId}/decision`,
    { decision: "Rejected", reason: "Store name spoofing attempt detected." },
    adminToken
  );
  assert.strictEqual(rejectRes.status, 200, "Reject decision failed");
  assert.strictEqual(rejectRes.data.verificationStatus, "ReverificationRejected");
  console.log("✅ PASSED: Status transitioned to 'ReverificationRejected' (HTTP 200)");

  // Publishing still blocked
  const pubStillBlocked = await postJson(`/seller/products/${productId}/publish`, {}, sellerToken);
  assert.strictEqual(pubStillBlocked.status, 403, "Publish should still be forbidden");
  console.log("✅ PASSED: Publishing remains blocked while in 'ReverificationRejected' (HTTP 403)");

  // 10. Admin Approves Re-verification
  console.log("\n--- 10. Admin Approves Store Profile Change ---");
  const approveRes = await postJson(
    `/admin/seller-stores/${sellerUserId}/decision`,
    { decision: "Approved", reason: "Official business license verified for new store name." },
    adminToken
  );
  assert.strictEqual(approveRes.status, 200, "Approve decision failed");
  assert.strictEqual(approveRes.data.verificationStatus, "Verified");
  console.log("✅ PASSED: Status restored to 'Verified' (HTTP 200)");

  // 11. Publishing now succeeds!
  console.log("\n--- 11. Publishing Unblocked ---");
  const pubSuccessRes = await postJson(`/seller/products/${productId}/publish`, {}, sellerToken);
  assert.strictEqual(pubSuccessRes.status, 200, "Publish should succeed");
  assert.strictEqual(pubSuccessRes.data.status, "Published");
  console.log("✅ PASSED: Product publishing now succeeds with HTTP 200 OK!");

  console.log("\n==================================================================");
  console.log("🎉 ALL 18/18 STORE RE-VERIFICATION ASSERTIONS PASSED!");
  console.log("==================================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
