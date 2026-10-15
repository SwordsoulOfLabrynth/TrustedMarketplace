/**
 * TrustedMarketplace — Task 2: Admin Disputes Queue & Adjudication Test Suite
 *
 * Verifies:
 * 1. Order placement and shipping lifecycle
 * 2. Buyer filing a dispute complaint on shipped order (POST /orders/{id}/complaints)
 * 3. Automatic transition of order status to 'Disputed'
 * 4. Authorization guard: Non-admin calling GET /api/v1/admin/complaints returns 403 Forbidden
 * 5. Admin queries GET /api/v1/admin/complaints and finds the complaint
 * 6. Admin inspects complaint by ID (GET /api/v1/complaints/{id})
 * 7. Admin records complaint decision (POST /api/v1/admin/complaints/{id}/decision)
 * 8. Admin resolves disputed order as Completed (POST /api/v1/admin/orders/{id}/resolve-dispute)
 * 9. Order status is now 'Completed' with immutable audit history
 */

const BASE_URL = process.env.API_URL || "http://localhost:5248";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runAdminDisputesSuite() {
  console.log("\n==================================================================");
  console.log("  TrustedMarketplace — Admin Disputes & Adjudication Suite       ");
  console.log("==================================================================\n");

  // 1. Authenticate Buyer, Seller, and Admin
  console.log("--- 1. Authenticate Personas ---");
  const buyerLoginResp = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "buyer@trustedmarketplace.local",
      password: "BuyerDemo123!",
    }),
  });
  assert(buyerLoginResp.status === 200, `Buyer authenticated successfully`);
  const buyerToken = (await buyerLoginResp.json()).accessToken;

  const sellerLoginResp = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "artisan.seller@trustedmarketplace.local",
      password: "SellerDemo123!",
    }),
  });
  assert(sellerLoginResp.status === 200, `Seller authenticated successfully`);
  const sellerToken = (await sellerLoginResp.json()).accessToken;

  const adminLoginResp = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@trustedmarketplace.local",
      password: "AdminDemo123!",
    }),
  });
  assert(adminLoginResp.status === 200, `Admin authenticated successfully`);
  const adminToken = (await adminLoginResp.json()).accessToken;

  // 2. Discover a Published Product
  console.log("\n--- 2. Discover Product & Create Order ---");
  const catalogResp = await fetch(`${BASE_URL}/api/v1/products?pageSize=20`);
  assert(catalogResp.status === 200, `Catalog retrieved successfully`);
  const catalogData = await catalogResp.json();
  const product = catalogData.items.find(p => p.storeName === "Mandalay Marionettes & Crafts") || catalogData.items[0];

  // 3. Buyer Places Order
  const orderResp = await fetch(`${BASE_URL}/api/v1/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({
      productId: product.id,
      quantity: 1,
      buyerContactPhone: "09977889900",
      deliveryAddress: "73rd Street, Corner of 28th St",
      deliveryCityOrTownship: "Mandalay",
      deliveryNotes: "Call when dispatcher arrives.",
    }),
  });
  assert(orderResp.status === 201, `Order placed successfully (HTTP 201)`);
  const order = await orderResp.json();
  assert(order.status === "Placed", `Initial status is 'Placed'`);

  // 4. Seller Accepts and Ships Order
  console.log("\n--- 3. Seller Order Dispatch ---");
  const acceptResp = await fetch(`${BASE_URL}/api/v1/orders/${order.id}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  assert(acceptResp.status === 200, `Seller accepted order (HTTP 200)`);

  const shipResp = await fetch(`${BASE_URL}/api/v1/orders/${order.id}/ship`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sellerToken}`,
    },
    body: JSON.stringify({ courierTrackingReference: "DISPUTE-TEST-WAYBILL-772" }),
  });
  assert(shipResp.status === 200, `Seller shipped order with tracking (HTTP 200)`);
  const shippedOrder = await shipResp.json();
  assert(shippedOrder.status === "Shipped", `Order status transitioned to 'Shipped'`);

  // 5. Buyer Files Dispute Complaint
  console.log("\n--- 4. Buyer Files Dispute Complaint ---");
  const disputeResp = await fetch(`${BASE_URL}/api/v1/orders/${order.id}/complaints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyerToken}`,
    },
    body: JSON.stringify({
      description: "Waybill tracking shows delivery failed; seller dispatcher unreachable after 7 days.",
    }),
  });
  assert(disputeResp.status === 201, `Dispute complaint filed successfully (HTTP 201)`);
  const complaint = await disputeResp.json();
  assert(complaint.id, `Complaint ID generated: ${complaint.id}`);
  assert(complaint.orderId === order.id, `Complaint linked to order ID`);

  // 6. Verify Order Status Shifted to Disputed
  const checkOrderResp = await fetch(`${BASE_URL}/api/v1/orders/${order.id}`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  const disputedOrderData = await checkOrderResp.json();
  assert(disputedOrderData.status === "Disputed", `Order status automatically shifted to 'Disputed'`);

  // 7. Security Check: Non-Admin Access to Admin Complaints Blocked
  console.log("\n--- 5. Security & Admin Authorization Checks ---");
  const unauthResp = await fetch(`${BASE_URL}/api/v1/admin/complaints`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  assert(unauthResp.status === 403, `Non-admin calling GET /admin/complaints returns 403 Forbidden (HTTP ${unauthResp.status})`);

  // 8. Admin Lists Complaints Queue
  console.log("\n--- 6. Admin Complaints Queue & Inspection ---");
  const adminComplaintsResp = await fetch(`${BASE_URL}/api/v1/admin/complaints`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminComplaintsResp.status === 200, `Admin retrieved complaints list (HTTP 200)`);
  const allComplaints = await adminComplaintsResp.json();
  const foundComplaint = allComplaints.find((c) => c.id === complaint.id);
  assert(foundComplaint, `Filed complaint is visible in admin complaints queue`);
  assert(foundComplaint.description.includes("seller dispatcher unreachable"), `Complaint description matches`);

  // 9. Admin Inspects Complaint by ID
  const detailResp = await fetch(`${BASE_URL}/api/v1/complaints/${complaint.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(detailResp.status === 200, `Admin inspected complaint detail by ID (HTTP 200)`);

  // 10. Admin Adjudicates Complaint Decision
  console.log("\n--- 7. Admin Complaint Decision & Order Dispute Settlement ---");
  const decisionResp = await fetch(`${BASE_URL}/api/v1/admin/complaints/${complaint.id}/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      resolutionCode: "GoodsDeliveredConfirmed",
      resolutionSummary: "Courier dispatcher confirmed parcel was re-delivered and signed by recipient on Oct 14.",
    }),
  });
  assert(decisionResp.status === 200, `Admin complaint decision recorded (HTTP 200)`);
  const resolvedComplaint = await decisionResp.json();
  assert(resolvedComplaint.status === "Resolved", `Complaint status transitioned to 'Resolved'`);
  assert(resolvedComplaint.resolutionCode === "GoodsDeliveredConfirmed", `Resolution code is 'GoodsDeliveredConfirmed'`);

  // 11. Admin Resolves Disputed Order to Completed
  const resolveOrderResp = await fetch(`${BASE_URL}/api/v1/admin/orders/${order.id}/resolve-dispute`, {
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
  assert(resolveOrderResp.status === 200, `Admin dispute resolution succeeded (HTTP 200)`);
  const finalizedOrder = await resolveOrderResp.json();
  assert(finalizedOrder.status === "Completed", `Order status transitioned from Disputed to 'Completed'`);
  assert(finalizedOrder.completedAtUtc, `Order CompletedAtUtc timestamp recorded`);

  // 12. Verify Audit History
  const finalizedOrderDetailsResp = await fetch(`${BASE_URL}/api/v1/orders/${order.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const orderWithHist = await finalizedOrderDetailsResp.json();
  const disputeHistoryEntry = orderWithHist.history.find(
    (h) => (h.newStatus || h.NewStatus) === "Disputed"
  );
  assert(disputeHistoryEntry, `Status history contains Disputed record`);
  const completedHistoryEntry = orderWithHist.history.find(
    (h) => (h.newStatus || h.NewStatus) === "Completed"
  );
  assert(completedHistoryEntry, `Status history contains Completed resolution record`);

  console.log("\n==================================================================");
  console.log("🎉 ALL 18 ADMIN DISPUTES & ADJUDICATION ASSERTIONS PASSED!");
  console.log("==================================================================\n");
}

runAdminDisputesSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
