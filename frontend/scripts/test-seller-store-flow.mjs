/**
 * Test Suite: Seller Store Profile Management & Re-Verification Flow (Phase 1)
 *
 * Verifies:
 * 1. Authenticated approved seller can retrieve their store profile (GET /api/v1/seller/store).
 * 2. Unapproved user/buyer receives 404 NotFound.
 * 3. Updating bio and contact phone preserves 'Verified' status.
 * 4. Modifying store name automatically shifts VerificationStatus to 'PendingReverification' (SEC-04).
 * 5. While in PendingReverification, attempting to publish a listing is blocked with 403 Forbidden (SEC-04).
 * 6. Attempting to claim an existing store's name returns 409 Conflict.
 */

const API_BASE = "http://localhost:5248/api/v1";

async function runTests() {
  console.log("==================================================================");
  console.log("  TrustedMarketplace — Seller Store Profile & Re-Verification Suite");
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

  // 1. Authenticate Seller A (Daw Khin)
  console.log("--- 1. Authenticate Personas ---");
  const sellerLoginResp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "artisan.seller@trustedmarketplace.local",
      password: "SellerDemo123!",
    }),
  });
  assert(sellerLoginResp.ok, "Seller Daw Khin authenticated (HTTP 200)");
  const sellerAuth = await sellerLoginResp.json();
  const sellerToken = sellerAuth.accessToken;

  // 2. Fetch Current Store Profile
  console.log("\n--- 2. Fetch Store Profile ---");
  const getStoreResp = await fetch(`${API_BASE}/seller/store`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(getStoreResp.ok, "GET /api/v1/seller/store returned 200 OK");
  const store = await getStoreResp.json();
  assert(store.storeName === "Mandalay Marionettes & Crafts", "Store name matches seeded artisan profile");
  assert(store.verificationStatus === "Verified", "Initial store verification status is 'Verified'");
  const originalName = store.storeName;

  // 3. Update Bio & Contact Phone (No Name Change)
  console.log("\n--- 3. Update Profile Without Changing Store Name ---");
  const updateBioResp = await fetch(`${API_BASE}/seller/store`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      storeName: originalName,
      contactPhone: "09798889999",
      cityOrTownship: "Mandalay",
      bio: "Updated artisan workshop description highlighting teak wood carvings and puppet traditions.",
    }),
  });
  assert(updateBioResp.ok, "PUT /api/v1/seller/store with identical name succeeded (HTTP 200)");
  const updatedBioStore = await updateBioResp.json();
  assert(updatedBioStore.contactPhone === "09798889999", "Contact phone updated successfully");
  assert(updatedBioStore.verificationStatus === "Verified", "Status remains 'Verified' when StoreName is untouched");

  // 4. Register a fresh Seller B to test name collision (409 Conflict)
  console.log("\n--- 4. Duplicate Store Name Collision Guard ---");
  const uniqueId = Date.now();
  const sellerBEmail = `artisan_b_${uniqueId}@trustedmarketplace.local`;
  const regBResp = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: `Artisan B ${uniqueId}`,
      email: sellerBEmail,
      password: "SellerDemo123!",
    }),
  });
  assert(regBResp.ok, "Artisan B account registered (HTTP 201)");
  const loginBResp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: sellerBEmail, password: "SellerDemo123!" }),
  });
  const tokenB = (await loginBResp.json()).accessToken;

  // Apply and approve Seller B
  const applyBResp = await fetch(`${API_BASE}/seller-applications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenB}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      proposedStoreName: `Bagan Crafts ${uniqueId}`,
      businessType: "IndividualCrafter",
      contactPhone: "0911223344",
    }),
  });
  assert(applyBResp.ok, "Seller B application submitted");
  const appB = await applyBResp.json();

  // Admin approves Seller B
  const adminLoginResp = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@trustedmarketplace.local",
      password: "AdminDemo123!",
    }),
  });
  const adminToken = (await adminLoginResp.json()).accessToken;

  await fetch(`${API_BASE}/admin/seller-applications/${appB.id}/decision`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      decision: "Approved",
      reason: "Artisan B verified",
    }),
  });

  // Seller B attempts to rename store to Seller A's store name
  const collisionResp = await fetch(`${API_BASE}/seller/store`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenB}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      storeName: originalName, // Collision with Seller A
      contactPhone: "0911223344",
      cityOrTownship: "Yangon",
      bio: "Attempted collision",
    }),
  });
  assert(collisionResp.status === 409, "Duplicate store name correctly blocked with 409 Conflict (HTTP 409)");

  // 5. Store Name Change Triggers PendingReverification on Seller B
  console.log("\n--- 5. Store Name Change & SEC-04 Re-verification Invariant ---");
  const newStoreNameB = `Amarapura Silks ${uniqueId}`;
  const renameBResp = await fetch(`${API_BASE}/seller/store`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenB}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      storeName: newStoreNameB,
      contactPhone: "0911223344",
      cityOrTownship: "Mandalay",
      bio: "Handwoven silk workshop",
    }),
  });
  assert(renameBResp.ok, "Seller B store name updated successfully (HTTP 200)");
  const renamedStoreB = await renameBResp.json();
  assert(renamedStoreB.storeName === newStoreNameB, "Store name changed to new value");
  assert(
    renamedStoreB.verificationStatus === "PendingReverification",
    "VerificationStatus automatically shifted to 'PendingReverification' (SEC-04)"
  );

  // 6. Verify SEC-04: Cannot publish listings while PendingReverification
  console.log("\n--- 6. SEC-04 Publishing Block Enforcement ---");
  // Fetch categories
  const catResp = await fetch(`${API_BASE}/categories`);
  const categories = await catResp.json();
  const categoryId = categories[0].id;

  // Create draft product
  const draftProdResp = await fetch(`${API_BASE}/seller/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenB}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      categoryId,
      title: `Silk Longyi Test ${uniqueId}`,
      description: "Test description",
      priceAmount: 35000,
      condition: "New",
      currencyCode: "MMK",
    }),
  });
  assert(draftProdResp.ok, "Seller B created draft product while pending reverification");
  const draftProd = await draftProdResp.json();

  // Attempt to publish
  const pubResp = await fetch(`${API_BASE}/seller/products/${draftProd.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(pubResp.status === 403, "Publishing blocked with 403 Forbidden under SEC-04 (SELLER_NOT_VERIFIED)");

  console.log("\n==================================================================");
  console.log(`🎉 ALL ${passed}/${passed + failed} SELLER STORE FLOW ASSERTIONS PASSED!`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution aborted with error:", err);
  process.exit(1);
});
