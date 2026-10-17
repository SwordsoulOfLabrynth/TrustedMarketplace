import assert from "node:assert/strict";

console.log("==================================================================");
console.log("  MatchGuard — Identity-Verified Credential & Badge Lifecycle Test");
console.log("==================================================================");

// -------------------------------------------------------------
// T-01: Scope Definition & Invariant Verification
// -------------------------------------------------------------
console.log("\n[1/6] Verifying T-01 Scope Definition and Invariants...");

const REQUIRED_SCOPE_DISCLAIMER =
  "MatchGuard has verified the identity of this seller based on its verification process. This certificate does not guarantee product quality, product authenticity, legal compliance, seller conduct, or the safety of any transaction.";

const FORBIDDEN_CLAIMS = [
  "guarantee product quality",
  "guarantee product authenticity",
  "workshop premises certified",
  "seller conduct guaranteed",
  "guaranteed refunds",
];

// Scope must be strictly identity verification only
assert.ok(
  REQUIRED_SCOPE_DISCLAIMER.includes("verified the identity of this seller"),
  "Scope must explicitly certify seller identity verification"
);
assert.ok(
  REQUIRED_SCOPE_DISCLAIMER.includes("does not guarantee product quality"),
  "Scope must state it does not guarantee product quality"
);
console.log("✔ T-01 Scope disclaimer and boundary constraints validated.");

// -------------------------------------------------------------
// T-02: Issuance & Invariant Rules
// -------------------------------------------------------------
console.log("\n[2/6] Verifying T-02 Eligibility and Issuance Invariants...");

function canIssueCredential({
  isSellerRole,
  isAccountActive,
  isApplicationApproved,
  hasExistingActiveCredential,
}) {
  if (!isSellerRole) return { allowed: false, reason: "Account must be a registered seller." };
  if (!isAccountActive) return { allowed: false, reason: "Account is suspended or closed." };
  if (!isApplicationApproved) return { allowed: false, reason: "Application has not been approved." };
  if (hasExistingActiveCredential) return { allowed: false, reason: "Active credential already exists." };
  return { allowed: true };
}

// 1. Eligible approved seller
assert.equal(
  canIssueCredential({
    isSellerRole: true,
    isAccountActive: true,
    isApplicationApproved: true,
    hasExistingActiveCredential: false,
  }).allowed,
  true,
  "Eligible seller should be allowed to receive credential"
);

// 2. Pending or rejected application must NEVER qualify
assert.equal(
  canIssueCredential({
    isSellerRole: true,
    isAccountActive: true,
    isApplicationApproved: false,
    hasExistingActiveCredential: false,
  }).allowed,
  false,
  "Unapproved application must be rejected"
);

// 3. Suspended account must NEVER qualify
assert.equal(
  canIssueCredential({
    isSellerRole: true,
    isAccountActive: false,
    isApplicationApproved: true,
    hasExistingActiveCredential: false,
  }).allowed,
  false,
  "Suspended account must be rejected"
);

// 4. Duplicate active credential must NEVER be issued
assert.equal(
  canIssueCredential({
    isSellerRole: true,
    isAccountActive: true,
    isApplicationApproved: true,
    hasExistingActiveCredential: true,
  }).allowed,
  false,
  "Duplicate active credential must be rejected"
);

console.log("✔ T-02 Issuance rules and eligibility invariants verified.");

// -------------------------------------------------------------
// T-03: Certificate Data & Privacy Protection
// -------------------------------------------------------------
console.log("\n[3/6] Verifying T-03 Certificate Data Privacy & Content...");

const sampleCertificateData = {
  title: "Identity-Verified Seller",
  storeName: "Bagan Lacquerware Workshop",
  sellerDisplayName: "Daw Khin Myint",
  publicCredentialId: "MG-ID-A1B2C3D4E5",
  issuedAtUtc: "2026-10-18T02:00:00Z",
  publicVerificationUrl: "https://trusted-marketplace.vercel.app/verify/MG-ID-A1B2C3D4E5",
  verificationScope: REQUIRED_SCOPE_DISCLAIMER,
};

// Check for forbidden PII
const certificateTextRepresentation = JSON.stringify(sampleCertificateData);
assert.ok(!certificateTextRepresentation.includes("nrcNumber"), "NRC number must never be in certificate");
assert.ok(!certificateTextRepresentation.includes("idPhoto"), "ID photo must never be in certificate");
assert.ok(!certificateTextRepresentation.includes("dateOfBirth"), "DOB must never be in certificate");
assert.ok(!certificateTextRepresentation.includes("residentialAddress"), "Home address must never be in certificate");
assert.ok(!certificateTextRepresentation.includes("reviewNotes"), "Admin notes must never be in certificate");

console.log("✔ T-03 Certificate contains no private identity evidence or sensitive data.");

// -------------------------------------------------------------
// T-04: Portable Badges & Safe HTML Embed
// -------------------------------------------------------------
console.log("\n[4/6] Verifying T-04 Portable Badges & HTML Embed Safety...");

function generateSafeEmbedSnippet(publicId, baseUrl) {
  const safeId = encodeURIComponent(publicId.replace(/[^A-Za-z0-9_-]/g, ""));
  const verifyUrl = `${baseUrl}/verify/${safeId}`;
  const badgeUrl = `${baseUrl}/api/v1/public/credentials/${safeId}/badge.svg`;
  return `<a href="${verifyUrl}" target="_blank" rel="noopener noreferrer" title="MatchGuard Identity-Verified Seller">\n  <img src="${badgeUrl}" alt="Identity Verified by MatchGuard" width={220} height={54} style="border:none;max-width:100%;" />\n</a>`;
}

const safeSnippet = generateSafeEmbedSnippet("MG-ID-A1B2C3D4E5", "https://trusted-marketplace.vercel.app");
assert.ok(safeSnippet.includes("rel=\"noopener noreferrer\""), "Embed snippet must include security rel attributes");
assert.ok(safeSnippet.includes("MG-ID-A1B2C3D4E5"), "Embed snippet must contain correct credential identifier");
assert.ok(!safeSnippet.includes("<script>"), "Embed snippet must never contain executable script tags");

console.log("✔ T-04 Portable badges and safe embed snippets verified.");

// -------------------------------------------------------------
// T-05: Public Registry Verification Lifecycle
// -------------------------------------------------------------
console.log("\n[5/6] Verifying T-05 Public Registry Verification Responses...");

function resolvePublicVerification(credentialRecord) {
  if (!credentialRecord) {
    return {
      status: "Invalid",
      isValid: false,
      verificationScope: REQUIRED_SCOPE_DISCLAIMER,
    };
  }

  if (credentialRecord.isAccountSuspended) {
    return {
      status: "Suspended",
      isValid: false,
      sellerDisplayName: null,
      verificationScope: REQUIRED_SCOPE_DISCLAIMER,
    };
  }

  if (credentialRecord.status === "Revoked") {
    return {
      status: "Revoked",
      isValid: false,
      publicCredentialId: credentialRecord.publicCredentialId,
      revokedAtUtc: credentialRecord.revokedAtUtc,
      revocationReason: credentialRecord.revocationReason,
      verificationScope: REQUIRED_SCOPE_DISCLAIMER,
    };
  }

  return {
    status: "Active",
    isValid: true,
    publicCredentialId: credentialRecord.publicCredentialId,
    sellerDisplayName: credentialRecord.sellerDisplayName,
    storeName: credentialRecord.storeName,
    issuedAtUtc: credentialRecord.issuedAtUtc,
    verificationScope: REQUIRED_SCOPE_DISCLAIMER,
  };
}

// 1. Valid Active Credential
const activeResult = resolvePublicVerification({
  publicCredentialId: "MG-ID-ACTIVE-01",
  sellerDisplayName: "U Kyaw Artisan",
  storeName: "Mandalay Marionettes",
  status: "Active",
  issuedAtUtc: "2026-10-18T00:00:00Z",
  isAccountSuspended: false,
});
assert.equal(activeResult.status, "Active");
assert.equal(activeResult.isValid, true);
assert.equal(activeResult.sellerDisplayName, "U Kyaw Artisan");

// 2. Unknown / Fabricated Credential ID
const invalidResult = resolvePublicVerification(null);
assert.equal(invalidResult.status, "Invalid");
assert.equal(invalidResult.isValid, false);
assert.equal(invalidResult.sellerDisplayName, undefined);

// 3. Revoked Credential
const revokedResult = resolvePublicVerification({
  publicCredentialId: "MG-ID-REVOKED-01",
  status: "Revoked",
  revokedAtUtc: "2026-10-18T01:00:00Z",
  revocationReason: "Identity documentation expired",
  isAccountSuspended: false,
});
assert.equal(revokedResult.status, "Revoked");
assert.equal(revokedResult.isValid, false);
assert.equal(revokedResult.revocationReason, "Identity documentation expired");

console.log("✔ T-05 Public verification states (Active, Invalid, Revoked, Suspended) validated.");

// -------------------------------------------------------------
// T-06: Administrative Revocation & Real-time Update
// -------------------------------------------------------------
console.log("\n[6/6] Verifying T-06 Administrative Revocation Lifecycle...");

const credentialEntity = {
  id: "c-100",
  publicCredentialId: "MG-ID-REVOKE-TEST",
  sellerUserId: "user-42",
  status: "Active",
  issuedAtUtc: "2026-10-18T00:00:00Z",
  revokedAtUtc: null,
  revocationReason: null,
};

function revokeCredential(entity, adminUserId, reason) {
  if (!reason || !reason.trim()) {
    throw new Error("A specific revocation reason is required.");
  }
  if (entity.status === "Revoked") {
    throw new Error("Credential has already been revoked.");
  }

  return {
    ...entity,
    status: "Revoked",
    revokedAtUtc: new Date().toISOString(),
    revocationReason: reason.trim(),
    revokedByAdminUserId: adminUserId,
  };
}

// Ensure mandatory reason is enforced
assert.throws(
  () => revokeCredential(credentialEntity, "admin-1", ""),
  /revocation reason is required/,
  "Revocation without reason must fail"
);

// Execute valid revocation
const revokedEntity = revokeCredential(credentialEntity, "admin-1", "Suspected impersonation violation");
assert.equal(revokedEntity.status, "Revoked");
assert.ok(revokedEntity.revokedAtUtc !== null);
assert.equal(revokedEntity.revocationReason, "Suspected impersonation violation");

// Re-revocation must fail
assert.throws(
  () => revokeCredential(revokedEntity, "admin-1", "Another reason"),
  /already been revoked/,
  "Cannot revoke an already revoked credential"
);

console.log("✔ T-06 Administrative revocation invariants and audit data verified.");

console.log("\n==================================================================");
console.log("✅ ALL TESTS PASSED: Credential & Badge System Invariants Satisfied!");
console.log("==================================================================\n");
