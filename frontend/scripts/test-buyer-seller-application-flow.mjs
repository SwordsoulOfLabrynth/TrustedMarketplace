/**
 * TrustedMarketplace — Task 1: Buyer Seller Application & Evidence Upload Test Suite
 *
 * Verifies:
 * 1. Buyer registration and authentication
 * 2. GET /api/v1/seller-applications/me returns 404 before submission
 * 3. POST /api/v1/seller-applications creates application with Pending status (201 Created)
 * 4. Duplicate submission is prevented (409 Conflict)
 * 5. Multipart evidence upload with magic byte validation (JPEG/PNG) succeeds (201 Created)
 * 6. Security SEC-12: Prohibited SVG file upload is rejected (400 Bad Request)
 * 7. Security SEC-12: Prohibited oversized file (> 5MB) is rejected (400 Bad Request)
 * 8. GET /api/v1/seller-applications/me returns application with evidence records
 * 9. Admin lists application in GET /api/v1/admin/seller-applications
 * 10. Admin approves application with audit rationale (200 OK)
 */

const BASE_URL = process.env.API_URL || "http://localhost:5248";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runBuyerSellerApplicationSuite() {
  console.log("\n==================================================================");
  console.log("  TrustedMarketplace — Buyer Seller Application & Evidence Suite  ");
  console.log("==================================================================\n");

  const timestamp = Date.now();
  const buyerEmail = `artisan_applicant_${timestamp}@trustedmarketplace.local`;
  const buyerPassword = "ApplicantPassword123!";
  const storeName = `Bagan Wood Carvings ${timestamp}`;

  // 1. Register a fresh Buyer account
  console.log("--- 1. Register Buyer Account ---");
  const regResp = await fetch(`${BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: "Ko Min Thein",
      email: buyerEmail,
      password: buyerPassword,
    }),
  });
  assert(regResp.status === 201, `Buyer registration succeeded (HTTP ${regResp.status})`);

  // 2. Login to obtain access token
  const loginResp = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: buyerEmail, password: buyerPassword }),
  });
  assert(loginResp.status === 200, `Buyer login succeeded (HTTP ${loginResp.status})`);
  const loginData = await loginResp.json();
  const buyerToken = loginData.accessToken;
  assert(buyerToken, "Access token received");

  // 3. Verify GET /api/v1/seller-applications/me returns 404
  console.log("\n--- 2. Pre-Application Verification Check ---");
  const preCheckResp = await fetch(`${BASE_URL}/api/v1/seller-applications/me`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  assert(preCheckResp.status === 404, `Pre-application status is 404 NotFound (HTTP ${preCheckResp.status})`);

  // 4. Submit Seller Application
  console.log("\n--- 3. Submit Seller Application ---");
  const submitResp = await fetch(`${BASE_URL}/api/v1/seller-applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({
      proposedStoreName: storeName,
      businessType: "ArtisanWorkshop",
      contactPhone: "09988776655",
    }),
  });
  assert(submitResp.status === 201, `Application submitted successfully (HTTP ${submitResp.status})`);
  const appData = await submitResp.json();
  assert(appData.id, `Application ID generated: ${appData.id}`);
  assert(appData.proposedStoreName === storeName, `Store name matches: ${storeName}`);
  assert(appData.status === "Pending", `Initial application status is 'Pending'`);

  // 5. Duplicate Submission Guard
  console.log("\n--- 4. Duplicate Submission Guard ---");
  const dupResp = await fetch(`${BASE_URL}/api/v1/seller-applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({
      proposedStoreName: "Another Store",
      businessType: "RetailShop",
      contactPhone: "0911223344",
    }),
  });
  assert(dupResp.status === 409, `Duplicate application correctly rejected with 409 Conflict (HTTP ${dupResp.status})`);

  // 6. Security SEC-12: Reject Prohibited SVG
  console.log("\n--- 5. Security SEC-12: Reject Prohibited Files ---");
  const svgContent = "<svg xmlns='http://www.w3.org/2000/svg'><script>alert('xss')</script></svg>";
  const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
  const svgFormData = new FormData();
  svgFormData.append("evidenceType", "NationalIdFront");
  svgFormData.append("file", svgBlob, "exploit.svg");

  const svgResp = await fetch(`${BASE_URL}/api/v1/seller-applications/me/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: svgFormData,
  });
  assert(svgResp.status === 400, `Prohibited SVG upload correctly blocked with 400 BadRequest (HTTP ${svgResp.status})`);

  // 7. Security SEC-12: Reject Oversized File (> 5MB)
  const oversizedBuffer = new Uint8Array(6 * 1024 * 1024); // 6MB
  // Pretend JPEG header
  oversizedBuffer[0] = 0xff;
  oversizedBuffer[1] = 0xd8;
  oversizedBuffer[2] = 0xff;
  oversizedBuffer[3] = 0xe0;
  const oversizedBlob = new Blob([oversizedBuffer], { type: "image/jpeg" });
  const oversizedFormData = new FormData();
  oversizedFormData.append("evidenceType", "NationalIdFront");
  oversizedFormData.append("file", oversizedBlob, "huge.jpg");

  const oversizedResp = await fetch(`${BASE_URL}/api/v1/seller-applications/me/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: oversizedFormData,
  });
  assert(oversizedResp.status === 400, `Oversized file correctly rejected with 400 BadRequest (HTTP ${oversizedResp.status})`);

  // 8. Upload Valid JPEG Evidence (NRC Front)
  console.log("\n--- 6. Upload Valid NRC Verification Evidence ---");
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const jpegBlob = new Blob([jpegHeader], { type: "image/jpeg" });
  const jpegFormData = new FormData();
  jpegFormData.append("evidenceType", "NationalIdFront");
  jpegFormData.append("file", jpegBlob, "nrc_front.jpg");

  const upload1Resp = await fetch(`${BASE_URL}/api/v1/seller-applications/me/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: jpegFormData,
  });
  assert(upload1Resp.status === 201, `NRC Front upload succeeded (HTTP ${upload1Resp.status})`);
  const ev1Data = await upload1Resp.json();
  assert(ev1Data.id, `Evidence ID: ${ev1Data.id}`);
  assert(ev1Data.evidenceType === "NationalIdFront", `EvidenceType is NationalIdFront`);
  assert(ev1Data.reviewStatus === "Pending", `ReviewStatus is Pending`);
  assert(ev1Data.sha256Checksum, `Cryptographic checksum generated: ${ev1Data.sha256Checksum.slice(0, 12)}...`);

  // 9. Upload Valid PNG Evidence (NRC Back)
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const pngBlob = new Blob([pngHeader], { type: "image/png" });
  const pngFormData = new FormData();
  pngFormData.append("evidenceType", "NationalIdBack");
  pngFormData.append("file", pngBlob, "nrc_back.png");

  const upload2Resp = await fetch(`${BASE_URL}/api/v1/seller-applications/me/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: pngFormData,
  });
  assert(upload2Resp.status === 201, `NRC Back upload succeeded (HTTP ${upload2Resp.status})`);
  const ev2Data = await upload2Resp.json();
  assert(ev2Data.evidenceType === "NationalIdBack", `EvidenceType is NationalIdBack`);

  // 10. Verify GET /api/v1/seller-applications/me reflects uploaded evidence
  console.log("\n--- 7. Verify Application State with Evidence ---");
  const myAppResp = await fetch(`${BASE_URL}/api/v1/seller-applications/me`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  assert(myAppResp.status === 200, `GET /seller-applications/me returned 200 OK`);
  const myAppData = await myAppResp.json();
  assert(myAppData.evidence && myAppData.evidence.length === 2, `Application contains 2 attached evidence files`);

  // 11. Admin Logs In and Reviews Application
  console.log("\n--- 8. Admin Application Review & Decision ---");
  const adminLoginResp = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@trustedmarketplace.local",
      password: "AdminDemo123!",
    }),
  });
  assert(adminLoginResp.status === 200, `Admin logged in successfully`);
  const adminToken = (await adminLoginResp.json()).accessToken;

  // Admin lists applications
  const adminListResp = await fetch(`${BASE_URL}/api/v1/admin/seller-applications`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminListResp.status === 200, `Admin retrieved applications list (HTTP 200)`);
  const adminApps = await adminListResp.json();
  const foundApp = adminApps.find((a) => a.id === appData.id);
  assert(foundApp, `Newly submitted application is visible in admin queue`);

  // Admin approves application
  const approveResp = await fetch(`${BASE_URL}/api/v1/admin/seller-applications/${appData.id}/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      decision: "Approved",
      reason: "Artisan credentials and physical workshop evidence verified in Mandalay.",
    }),
  });
  assert(approveResp.status === 200, `Admin approval recorded successfully (HTTP 200)`);
  const approvedData = await approveResp.json();
  assert(approvedData.status === "Approved", `Application status transitioned to 'Approved'`);

  // 12. Verify Buyer's Application is Now Approved
  const finalCheckResp = await fetch(`${BASE_URL}/api/v1/seller-applications/me`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  const finalAppData = await finalCheckResp.json();
  assert(finalAppData.status === "Approved", `Buyer confirms application is officially 'Approved'`);
  assert(finalAppData.decisionReason.includes("Artisan credentials"), `Audit decision note is visible to applicant`);

  console.log("\n==================================================================");
  console.log("🎉 ALL 18 BUYER SELLER APPLICATION ASSERTIONS PASSED!");
  console.log("==================================================================\n");
}

runBuyerSellerApplicationSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
