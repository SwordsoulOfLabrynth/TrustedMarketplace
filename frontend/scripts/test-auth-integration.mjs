/**
 * End-to-End Integration Test for Task F-02 Authentication Workflows
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
  console.log("   TrustedMarketplace F-02 Auth Integration Test   ");
  console.log("=================================================\n");

  // Helper to extract cookie from set-cookie header
  function extractCookie(response) {
    const raw = response.headers.get("set-cookie");
    if (!raw) return null;
    return raw.split(";")[0];
  }

  // 1. Health check
  console.log("--- 1. Backend Connectivity Check ---");
  const healthRes = await fetch("http://localhost:5248/api/v1/health");
  assert(healthRes.status === 200, "Health endpoint returns 200 OK");
  const healthData = await healthRes.json();
  assert(healthData.status === "Healthy", `Backend health status is Healthy (${healthData.status})`);

  // 2. Buyer Authentication
  console.log("\n--- 2. Buyer Login & Identity Verification ---");
  const buyerLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "buyer@trustedmarketplace.local",
      password: "BuyerDemo123!",
    }),
  });
  assert(buyerLoginRes.status === 200, "Buyer login returns 200 OK");
  const buyerCookie = extractCookie(buyerLoginRes);
  assert(buyerCookie && buyerCookie.startsWith("refreshToken="), "Buyer login sets refreshToken cookie");
  const buyerData = await buyerLoginRes.json();
  assert(buyerData.accessToken && buyerData.accessToken.length > 20, "Buyer login returns valid JWT accessToken");
  assert(buyerData.user.role === "Buyer", `Buyer identity role is 'Buyer' (${buyerData.user.role})`);
  assert(buyerData.user.accountStatus === "Active", "Buyer account standing is 'Active'");

  // Verify GET /api/v1/auth/me with Buyer Token
  const buyerMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${buyerData.accessToken}` },
  });
  assert(buyerMeRes.status === 200, "GET /api/v1/auth/me returns 200 OK for Buyer");
  const buyerMe = await buyerMeRes.json();
  assert(buyerMe.email === "buyer@trustedmarketplace.local", "GET /api/v1/auth/me returns correct email");

  // Buyer should NOT have a seller store (expect 404)
  const buyerStoreRes = await fetch(`${API_BASE}/seller/store`, {
    headers: { Authorization: `Bearer ${buyerData.accessToken}` },
  });
  assert(buyerStoreRes.status === 404, "GET /api/v1/seller/store returns 404 for standard buyer");

  // 3. Token Refresh with Cookie
  console.log("\n--- 3. Refresh Token Rotation Flow ---");
  const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: buyerCookie,
    },
  });
  assert(refreshRes.status === 200, "POST /api/v1/auth/refresh returns 200 OK");
  const newCookie = extractCookie(refreshRes);
  assert(newCookie && newCookie.startsWith("refreshToken="), "Refresh rotates and issues fresh refreshToken cookie");
  const refreshData = await refreshRes.json();
  assert(refreshData.accessToken && refreshData.accessToken !== buyerData.accessToken, "Refresh generates fresh access token");

  // 4. Seller Authentication & Store Profile
  console.log("\n--- 4. Seller Login & Store Profile ---");
  const sellerLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "artisan.seller@trustedmarketplace.local",
      password: "SellerDemo123!",
    }),
  });
  assert(sellerLoginRes.status === 200, "Seller login returns 200 OK");
  const sellerData = await sellerLoginRes.json();
  assert(sellerData.user.role === "Buyer", "Seller Identity role is 'Buyer' (Seller profile is a domain concept)");

  const sellerStoreRes = await fetch(`${API_BASE}/seller/store`, {
    headers: { Authorization: `Bearer ${sellerData.accessToken}` },
  });
  assert(sellerStoreRes.status === 200, "GET /api/v1/seller/store returns 200 OK for verified seller");
  const sellerStore = await sellerStoreRes.json();
  assert(sellerStore.verificationStatus === "Verified", `Seller store verification status is 'Verified' (${sellerStore.verificationStatus})`);
  assert(sellerStore.storeName && sellerStore.storeName.length > 0, `Seller store has storeName: "${sellerStore.storeName}"`);

  // 5. Admin Authentication
  console.log("\n--- 5. Admin Login & Authorization ---");
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@trustedmarketplace.local",
      password: "AdminDemo123!",
    }),
  });
  assert(adminLoginRes.status === 200, "Admin login returns 200 OK");
  const adminData = await adminLoginRes.json();
  assert(adminData.user.role === "Admin", "Admin user role is 'Admin'");

  const adminMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${adminData.accessToken}` },
  });
  assert(adminMeRes.status === 200, "GET /api/v1/auth/me returns 200 OK for Admin");

  // 6. Registration of New User & Auto-Login
  console.log("\n--- 6. Registration Flow ---");
  const testEmail = `newbuyer_${Date.now()}@trustedmarketplace.local`;
  const registerRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: "New Registered Buyer",
      email: testEmail,
      password: "BuyerPassword123!",
    }),
  });
  assert(registerRes.status === 201, "POST /api/v1/auth/register returns 201 Created");
  const registerData = await registerRes.json();
  assert(registerData.email === testEmail, "Registration returns correct email");
  assert(registerData.role === "Buyer", "New registered user assigned 'Buyer' role");
  assert(registerData.accountStatus === "Active", "New registered user assigned 'Active' status");

  // Immediate login of newly registered user
  const newLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: "BuyerPassword123!",
    }),
  });
  assert(newLoginRes.status === 200, "Immediate login for new user returns 200 OK");

  // 7. Logout & Revocation Flow
  console.log("\n--- 7. Logout & Revocation Flow ---");
  const newCookie2 = extractCookie(newLoginRes);
  const logoutRes = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: newCookie2,
    },
  });
  assert(logoutRes.status === 204, "POST /api/v1/auth/logout returns 204 No Content");

  // Attempting to refresh with the revoked token must fail with 401
  const revokedRefreshRes = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: newCookie2,
    },
  });
  assert(revokedRefreshRes.status === 401, "POST /api/v1/auth/refresh with revoked cookie returns 401 Unauthorized");

  // 8. Uniform Error on Invalid Credentials (SEC-13)
  console.log("\n--- 8. Anti-Enumeration & Validation Security (SEC-13) ---");
  const badLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "nonexistent@trustedmarketplace.local",
      password: "WrongPassword123!",
    }),
  });
  assert(badLoginRes.status === 401, "Invalid login returns uniform 401 Unauthorized");

  console.log("\n=================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} AUTH INTEGRATION TESTS PASSED!`);
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
