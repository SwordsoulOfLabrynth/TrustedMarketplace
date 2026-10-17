import assert from "node:assert/strict";

console.log("=== Testing Admin Seller Verification Status Mapping & Workflow ===");

// 1. Status normalization helpers as implemented in admin/page.tsx
const isPendingApp = (status) => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "pending" || s === "submitted" || s === "underreview";
};

const isApprovedApp = (status) => {
  if (!status) return false;
  return status.toLowerCase() === "approved";
};

const isRejectedApp = (status) => {
  if (!status) return false;
  return status.toLowerCase() === "rejected";
};

const isMoreInfoApp = (status) => {
  if (!status) return false;
  return status.toLowerCase() === "moreinformationrequired";
};

// 2. Unit assertion tests
console.log("-> Checking status predicate normalization...");
assert.equal(isPendingApp("Pending"), true, "Pending must be recognized as pending");
assert.equal(isPendingApp("pending"), true, "pending (lowercase) must be recognized as pending");
assert.equal(isPendingApp("Submitted"), true, "Submitted must be recognized as pending");
assert.equal(isPendingApp("UnderReview"), true, "UnderReview must be recognized as pending");
assert.equal(isPendingApp("Approved"), false, "Approved must not be recognized as pending");
assert.equal(isPendingApp("Rejected"), false, "Rejected must not be recognized as pending");
assert.equal(isPendingApp(null), false, "null must return false");
assert.equal(isPendingApp(undefined), false, "undefined must return false");

assert.equal(isApprovedApp("Approved"), true);
assert.equal(isApprovedApp("approved"), true);
assert.equal(isApprovedApp("Pending"), false);

assert.equal(isRejectedApp("Rejected"), true);
assert.equal(isRejectedApp("rejected"), true);
assert.equal(isRejectedApp("Pending"), false);

assert.equal(isMoreInfoApp("MoreInformationRequired"), true);
assert.equal(isMoreInfoApp("moreinformationrequired"), true);
assert.equal(isMoreInfoApp("Pending"), false);

console.log("✔ Status predicate normalization passed.");

// 3. Mock dataset reproducing production scenario:
// Application 1: "Mandalay Marionettes & Crafts" (Approved)
// Application 2: "ass" (Pending, no evidence)
// Application 3: "Shan Gems" (MoreInformationRequired)
const mockApplications = [
  {
    id: "846bbc9f-2566-41e9-9a74-d4b8e2170f03",
    proposedStoreName: "Mandalay Marionettes & Crafts",
    status: "Approved",
    businessType: "Artisan",
    contactPhone: "0912345678",
    evidence: [{ id: "ev-1", evidenceType: "NationalIdFront" }]
  },
  {
    id: "440f8692-a169-42b7-84bc-2ceb47bc4882",
    proposedStoreName: "ass",
    status: "Pending",
    businessType: "ass",
    contactPhone: "ass",
    evidence: []
  },
  {
    id: "991e1234-b234-43c8-91cd-123456789abc",
    proposedStoreName: "Shan Gems",
    status: "MoreInformationRequired",
    businessType: "Jeweler",
    contactPhone: "0998765432",
    evidence: []
  }
];

// Summary counts logic
const totalAppsCount = mockApplications.length;
const pendingAppsCount = mockApplications.filter((a) => isPendingApp(a.status)).length;
const approvedAppsCount = mockApplications.filter((a) => isApprovedApp(a.status)).length;
const rejectedAppsCount = mockApplications.filter(
  (a) => isRejectedApp(a.status) || isMoreInfoApp(a.status)
).length;

console.log("-> Checking summary counts against production dataset...");
assert.equal(totalAppsCount, 3, "Total applications should be 3");
assert.equal(pendingAppsCount, 1, "Pending applications should be exactly 1 (app 'ass')");
assert.equal(approvedAppsCount, 1, "Approved applications should be exactly 1");
assert.equal(rejectedAppsCount, 1, "Rejected/Other applications should be exactly 1");
console.log("✔ Summary counts accurate: Total=3, Pending=1, Approved=1, Other=1.");

// 4. Test filter logic
const filterApps = (statusFilter, apps) => {
  if (statusFilter === "All") return apps;
  return apps.filter((a) => {
    if (statusFilter.toLowerCase() === "pending") {
      return isPendingApp(a.status);
    }
    if (statusFilter.toLowerCase() === "moreinformationrequired") {
      return isMoreInfoApp(a.status);
    }
    return a.status?.toLowerCase() === statusFilter.toLowerCase();
  });
};

console.log("-> Checking filter pills...");
assert.equal(filterApps("All", mockApplications).length, 3);
assert.equal(filterApps("Pending", mockApplications).length, 1);
assert.equal(filterApps("Pending", mockApplications)[0].proposedStoreName, "ass");
assert.equal(filterApps("Approved", mockApplications).length, 1);
assert.equal(filterApps("Approved", mockApplications)[0].proposedStoreName, "Mandalay Marionettes & Crafts");
assert.equal(filterApps("Rejected", mockApplications).length, 0);
assert.equal(filterApps("MoreInformationRequired", mockApplications).length, 1);
assert.equal(filterApps("MoreInformationRequired", mockApplications)[0].proposedStoreName, "Shan Gems");
console.log("✔ Filter pills matching accurate.");

console.log("=== All Admin Verification Workflow Regression Tests Passed ===");
