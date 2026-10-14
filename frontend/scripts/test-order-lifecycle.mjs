/**
 * End-to-End Integration Test for Task F-04 Non-Custodial Order Lifecycle
 * Tests the complete state machine against the live ASP.NET Core backend at http://localhost:5248
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

async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email} with status ${res.status}`);
  const data = await res.json();
  return { token: data.accessToken, user: data.user };
}

async function runTests() {
  console.log("=================================================");
  console.log("  TrustedMarketplace F-04 Order Lifecycle Test  ");
  console.log("=================================================\n");

  // 1. Authenticate as Buyer and Seller
  console.log("--- 1. Authentication Setup ---");
  const buyer = await loginUser("buyer@trustedmarketplace.local", "BuyerDemo123!");
  assert(buyer.token && buyer.user.role === "Buyer", "Buyer authenticated successfully");

  const seller = await loginUser("artisan.seller@trustedmarketplace.local", "SellerDemo123!");
  assert(seller.token, "Seller authenticated successfully");

  // 2. Discover a Product owned by the Seller
  console.log("\n--- 2. Product Discovery for Order ---");
  const sellerProdsRes = await fetch(`${API_BASE}/seller/products`, {
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  assert(sellerProdsRes.status === 200, "GET /api/v1/seller/products returns 200 OK");
  const sellerProds = await sellerProdsRes.json();
  const sellerProduct = sellerProds.find((p) => p.status === "Published") || sellerProds[0];
  assert(sellerProduct !== undefined, `Found product '${sellerProduct?.title}' (status: ${sellerProduct?.status}) owned by seller`);

  // 3. Validation & Self-Ordering Restrictions
  console.log("\n--- 3. Validation & Security Checks ---");
  // Seller attempting to buy their own product
  const selfOrderRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${seller.token}`,
    },
    body: JSON.stringify({
      productId: sellerProduct.id,
      quantity: 1,
      buyerContactPhone: "09111222333",
      deliveryAddress: "Self Address",
      deliveryCityOrTownship: "Mandalay",
    }),
  });
  assert(selfOrderRes.status === 409, "Seller attempting to purchase own listing returns 409 Conflict");

  // Quantity 0 validation
  const badQtyRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyer.token}`,
    },
    body: JSON.stringify({
      productId: sellerProduct.id,
      quantity: 0,
      buyerContactPhone: "09111222333",
      deliveryAddress: "Buyer Address",
      deliveryCityOrTownship: "Yangon",
    }),
  });
  assert(badQtyRes.status === 400, "Order with quantity 0 returns 400 BadRequest");

  // 4. Place Valid Order (Buyer)
  console.log("\n--- 4. Order Creation (Buyer) ---");
  const createOrderRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyer.token}`,
    },
    body: JSON.stringify({
      productId: sellerProduct.id,
      quantity: 2,
      buyerContactPhone: "09977889900",
      deliveryAddress: "No. 120, Inya Road, Kamayut Township",
      deliveryCityOrTownship: "Yangon",
      deliveryNotes: "Call upon arrival",
    }),
  });
  assert(createOrderRes.status === 201, "POST /api/v1/orders returns 201 Created");
  const order = await createOrderRes.json();
  assert(order.id && typeof order.id === "string", "Order created with valid ID");
  assert(order.status === "Placed", "Initial order status is 'Placed'");
  assert(order.subtotalAmount === sellerProduct.priceAmount * 2, `Subtotal is correct: ${order.subtotalAmount} MMK`);
  assert(order.items.length === 1, "Order contains 1 line item");
  assert(order.items[0].quantity === 2, "Line item quantity is 2");
  assert(order.history.length >= 1, "Order contains status history record");

  // 5. Query Order by ID & Verify IDOR Protection (SEC-06)
  console.log("\n--- 5. Order Detail & IDOR Protection ---");
  const detailRes = await fetch(`${API_BASE}/orders/${order.id}`, {
    headers: { Authorization: `Bearer ${buyer.token}` },
  });
  assert(detailRes.status === 200, "Buyer can view their order via GET /api/v1/orders/{id}");

  // Unrelated third-party buyer attempting to access this order
  const otherBuyer = await loginUser("buyer@trustedmarketplace.local", "BuyerDemo123!");
  // Register a temporary disposable user to test IDOR
  const tempEmail = `idor_test_${Date.now()}@trustedmarketplace.local`;
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: "Third Party",
      email: tempEmail,
      password: "TestPassword123!",
    }),
  });
  const tempUser = await loginUser(tempEmail, "TestPassword123!");
  const idorRes = await fetch(`${API_BASE}/orders/${order.id}`, {
    headers: { Authorization: `Bearer ${tempUser.token}` },
  });
  assert(idorRes.status === 403, "Unrelated third-party accessing order returns 403 Forbidden (SEC-06)");

  // 6. Buyer and Seller Order List Queries
  console.log("\n--- 6. Buyer & Seller Order Lists ---");
  const buyerOrdersRes = await fetch(`${API_BASE}/buyer/orders`, {
    headers: { Authorization: `Bearer ${buyer.token}` },
  });
  assert(buyerOrdersRes.status === 200, "GET /api/v1/buyer/orders returns 200 OK");
  const buyerOrders = await buyerOrdersRes.json();
  assert(buyerOrders.some((o) => o.id === order.id), "New order appears in Buyer's order list");

  const sellerOrdersRes = await fetch(`${API_BASE}/seller/orders`, {
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  assert(sellerOrdersRes.status === 200, "GET /api/v1/seller/orders returns 200 OK");
  const sellerOrders = await sellerOrdersRes.json();
  assert(sellerOrders.some((o) => o.id === order.id), "New order appears in Seller's order list");

  // 7. Unauthorized State Transitions
  console.log("\n--- 7. State Machine Authorization ---");
  // Buyer cannot accept the order (only seller can)
  const buyerAcceptRes = await fetch(`${API_BASE}/orders/${order.id}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${buyer.token}` },
  });
  assert(buyerAcceptRes.status === 403, "Buyer calling accept returns 403 Forbidden");

  // Seller cannot confirm delivery (only buyer can, SEC-07)
  const sellerConfirmRes = await fetch(`${API_BASE}/orders/${order.id}/confirm-delivery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  assert(sellerConfirmRes.status === 403, "Seller calling confirm-delivery returns 403 Forbidden (SEC-07)");

  // 8. Invalid Transition (Ship before Accept)
  console.log("\n--- 8. Invalid Transition Guards ---");
  const prematureShipRes = await fetch(`${API_BASE}/orders/${order.id}/ship`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${seller.token}`,
    },
    body: JSON.stringify({ courierTrackingReference: "EARLY-TRACK" }),
  });
  assert(prematureShipRes.status === 400, "Shipping a Placed order before Accepting returns 400 BadRequest (DOMAIN_RULE_VIOLATION)");

  // 9. Seller Accepts Order
  console.log("\n--- 9. Seller Accepts Order ---");
  const acceptRes = await fetch(`${API_BASE}/orders/${order.id}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  assert(acceptRes.status === 200, "Seller accept returns 200 OK");
  const acceptedOrder = await acceptRes.json();
  assert(acceptedOrder.status === "Accepted", "Order status transitioned to 'Accepted'");

  // 10. Seller Ships Order
  console.log("\n--- 10. Seller Ships Order ---");
  const shipRes = await fetch(`${API_BASE}/orders/${order.id}/ship`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${seller.token}`,
    },
    body: JSON.stringify({ courierTrackingReference: "ROYAL-EXP-77291" }),
  });
  assert(shipRes.status === 200, "Seller ship returns 200 OK");
  const shippedOrder = await shipRes.json();
  assert(shippedOrder.status === "Shipped", "Order status transitioned to 'Shipped'");
  assert(shippedOrder.courierTrackingReference === "ROYAL-EXP-77291", "Courier tracking reference recorded");
  assert(shippedOrder.shippedAtUtc !== null, "ShippedAtUtc timestamp recorded");

  // 11. Review Eligibility Guard (SEC-11: Only Completed orders can be reviewed)
  console.log("\n--- 11. Premature Review Guard (SEC-11) ---");
  const prematureReviewRes = await fetch(`${API_BASE}/orders/${order.id}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyer.token}`,
    },
    body: JSON.stringify({
      rating: 5,
      comment: "Trying to review before delivery confirmation",
    }),
  });
  assert(prematureReviewRes.status === 409, "Reviewing a Shipped (uncompleted) order returns 409 Conflict (SEC-11)");

  // 12. Buyer Confirms Delivery (SEC-07, SEC-08)
  console.log("\n--- 12. Buyer Confirms Delivery (SEC-07) ---");
  const confirmDeliveryRes = await fetch(`${API_BASE}/orders/${order.id}/confirm-delivery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${buyer.token}` },
  });
  assert(confirmDeliveryRes.status === 200, "Buyer confirm-delivery returns 200 OK");
  const completedOrder = await confirmDeliveryRes.json();
  assert(completedOrder.status === "Completed", "Order status transitioned to 'Completed'");
  assert(completedOrder.completedAtUtc !== null, "CompletedAtUtc timestamp recorded");

  // 13. Transaction-Linked Review Submission (SEC-09, SEC-10)
  console.log("\n--- 13. Transaction-Linked Review Submission ---");
  const reviewRes = await fetch(`${API_BASE}/orders/${order.id}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyer.token}`,
    },
    body: JSON.stringify({
      rating: 5,
      comment: "F-04 automated test review: Exceptional quality and prompt courier delivery in Yangon!",
    }),
  });
  assert(reviewRes.status === 201, "Review submission on Completed order returns 201 Created");
  const review = await reviewRes.json();
  assert(review.rating === 5, "Review rating is 5");
  assert(review.orderId === order.id, "Review is strictly linked to this order ID");

  // 14. Duplicate Review Prevention (SEC-10)
  console.log("\n--- 14. Duplicate Review Prevention (SEC-10) ---");
  const dupReviewRes = await fetch(`${API_BASE}/orders/${order.id}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyer.token}`,
    },
    body: JSON.stringify({
      rating: 4,
      comment: "Attempting duplicate review",
    }),
  });
  assert(dupReviewRes.status === 409, "Duplicate review on same transaction returns 409 Conflict (SEC-10)");

  // 15. Cancellation Lifecycle
  console.log("\n--- 15. Cancellation Lifecycle ---");
  const order2Res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyer.token}`,
    },
    body: JSON.stringify({
      productId: sellerProduct.id,
      quantity: 1,
      buyerContactPhone: "09977889900",
      deliveryAddress: "Test Address for Cancel",
      deliveryCityOrTownship: "Yangon",
    }),
  });
  const order2 = await order2Res.json();
  assert(order2.status === "Placed", "Order 2 created in Placed status");

  const cancelRes = await fetch(`${API_BASE}/orders/${order2.id}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyer.token}`,
    },
    body: JSON.stringify({ reason: "Buyer changed delivery preference" }),
  });
  assert(cancelRes.status === 200, "Buyer cancel Placed order returns 200 OK");
  const cancelledOrder = await cancelRes.json();
  assert(cancelledOrder.status === "Cancelled", "Order 2 status transitioned to 'Cancelled'");

  // Seller cannot accept a cancelled order
  const acceptCancelledRes = await fetch(`${API_BASE}/orders/${order2.id}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  assert(acceptCancelledRes.status === 400, "Accepting a Cancelled order returns 400 BadRequest (DOMAIN_RULE_VIOLATION)");

  console.log("\n=================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} ORDER LIFECYCLE TESTS PASSED!`);
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
