/**
 * Regression Test: Buyer-to-Seller Order Visibility and Lifecycle
 * 
 * Verifies that when a real authenticated buyer places an order for a verified seller's product:
 * 1. The order is stored with the seller's SellerUserId.
 * 2. When the seller logs in with their real credentials, the order is visible under GET /api/v1/seller/orders.
 * 3. The seller can accept and ship the order.
 * 4. The buyer can confirm delivery.
 * 5. An unrelated account cannot view or manage the order (IDOR SEC-06).
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

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Login failed for ${email} (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return { token: data.accessToken, user: data.user };
}

async function run() {
  console.log("===============================================================");
  console.log("  Regression Test: Buyer-to-Seller Order Visibility Flow  ");
  console.log("===============================================================\n");

  // Step 1: Real Buyer Login
  console.log("--- 1. Authenticate as Buyer ---");
  const buyer = await login("buyer@trustedmarketplace.local", "BuyerDemo123!");
  assert(buyer.token && buyer.user.role === "Buyer", "Buyer authenticated with real backend token");

  // Step 2: Real Seller Login & Profile Verification
  console.log("\n--- 2. Authenticate as Seller & Check Store ---");
  const seller = await login("artisan.seller@trustedmarketplace.local", "SellerDemo123!");
  assert(seller.token, "Seller authenticated with real backend token");

  const storeRes = await fetch(`${API_BASE}/seller/store`, {
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  assert(storeRes.status === 200, "Seller store profile fetched (200 OK)");
  const store = await storeRes.json();
  assert(store.storeName === "Mandalay Marionettes & Crafts", `Store is '${store.storeName}'`);
  assert(store.verificationStatus === "Verified", "Store status is 'Verified'");

  // Step 3: Find a product owned by this seller
  console.log("\n--- 3. Product Discovery (Owned by Daw Khin) ---");
  const productsRes = await fetch(`${API_BASE}/products?pageSize=50`);
  assert(productsRes.status === 200, "Catalog query returned 200 OK");
  const catalog = await productsRes.json();
  assert(catalog.items.length > 0, `Catalog contains ${catalog.items.length} products`);

  let sellerProduct = catalog.items.find((p) => p.sellerUserId === seller.user.id);
  if (!sellerProduct) {
    const sellerOwnRes = await fetch(`${API_BASE}/seller/products`, {
      headers: { Authorization: `Bearer ${seller.token}` },
    });
    const ownProducts = await sellerOwnRes.json();
    sellerProduct = ownProducts[0];
  }
  assert(
    sellerProduct !== undefined,
    `Found product '${sellerProduct?.title}' owned by sellerUserId ${seller.user.id}`
  );

  // Step 4: Buyer places order
  console.log("\n--- 4. Buyer Places Real Order ---");
  const phone = "09977889900";
  const address = "No. 45, Bogyoke Aung San Road, Bahan";
  const city = "Yangon";
  const notes = "Testing buyer-to-seller visibility";

  const createOrderRes = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buyer.token}`,
    },
    body: JSON.stringify({
      productId: sellerProduct.id,
      quantity: 1,
      buyerContactPhone: phone,
      deliveryAddress: address,
      deliveryCityOrTownship: city,
      deliveryNotes: notes,
    }),
  });

  assert(createOrderRes.status === 201, `Order created successfully (201 Created)`);
  const createdOrder = await createOrderRes.json();
  assert(createdOrder.id && typeof createdOrder.id === "string", `Order ID: ${createdOrder.id}`);
  assert(createdOrder.sellerUserId === seller.user.id, "Order.sellerUserId matches Daw Khin's user ID");
  assert(createdOrder.status === "Placed", "Initial order status is 'Placed'");

  // Step 5: Seller views incoming orders (REGRESSION CORE TEST)
  console.log("\n--- 5. Seller Queries Incoming Orders (Core Regression Assertion) ---");
  const sellerOrdersRes = await fetch(`${API_BASE}/seller/orders`, {
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  assert(sellerOrdersRes.status === 200, "GET /api/v1/seller/orders returned 200 OK");
  const sellerOrders = await sellerOrdersRes.json();
  assert(Array.isArray(sellerOrders), "Seller orders returned as an array");

  const matchingOrder = sellerOrders.find((o) => o.id === createdOrder.id);
  assert(
    matchingOrder !== undefined,
    `CRITICAL SUCCESS: Order ${createdOrder.id} is VISIBLE in seller's incoming orders list!`
  );
  assert(matchingOrder.buyerContactPhone === phone, `Buyer phone matches: ${phone}`);
  assert(matchingOrder.deliveryCityOrTownship === city, `Delivery city matches: ${city}`);
  assert(matchingOrder.items[0].productId === sellerProduct.id, `Ordered product matches: ${sellerProduct.title}`);

  // Step 6: Seller accepts order
  console.log("\n--- 6. Seller Accepts Order ---");
  const acceptRes = await fetch(`${API_BASE}/orders/${createdOrder.id}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${seller.token}` },
  });
  assert(acceptRes.status === 200, "POST /orders/{id}/accept returned 200 OK");
  const acceptedOrder = await acceptRes.json();
  assert(acceptedOrder.status === "Accepted", "Order status transitioned to 'Accepted'");

  // Step 7: Seller ships order
  console.log("\n--- 7. Seller Dispatches / Ships Order ---");
  const trackingNumber = "MANDALAY-EXPRESS-REGRESSION-001";
  const shipRes = await fetch(`${API_BASE}/orders/${createdOrder.id}/ship`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${seller.token}`,
    },
    body: JSON.stringify({ courierTrackingReference: trackingNumber }),
  });
  assert(shipRes.status === 200, "POST /orders/{id}/ship returned 200 OK");
  const shippedOrder = await shipRes.json();
  assert(shippedOrder.status === "Shipped", "Order status transitioned to 'Shipped'");
  assert(shippedOrder.courierTrackingReference === trackingNumber, `Tracking number recorded: ${trackingNumber}`);

  // Step 8: Buyer confirms delivery
  console.log("\n--- 8. Buyer Confirms Delivery ---");
  const confirmRes = await fetch(`${API_BASE}/orders/${createdOrder.id}/confirm-delivery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${buyer.token}` },
  });
  assert(confirmRes.status === 200, "POST /orders/{id}/confirm-delivery returned 200 OK");
  const completedOrder = await confirmRes.json();
  assert(completedOrder.status === "Completed", "Order status transitioned to 'Completed'");

  // Step 9: IDOR Security Isolation Check
  console.log("\n--- 9. IDOR SEC-06 Security Isolation Verification ---");
  // Register a completely new independent buyer to test IDOR
  const strangerEmail = `stranger_${Date.now()}@trustedmarketplace.local`;
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: "Unrelated Stranger",
      email: strangerEmail,
      password: "StrangerDemo123!",
    }),
  });
  assert(regRes.status === 201, "Stranger user registered (201 Created)");
  const stranger = await login(strangerEmail, "StrangerDemo123!");

  // Stranger attempts to view Daw Khin's order detail
  const idorRes = await fetch(`${API_BASE}/orders/${createdOrder.id}`, {
    headers: { Authorization: `Bearer ${stranger.token}` },
  });
  assert(idorRes.status === 403, `IDOR check passed: Unrelated user receives 403 Forbidden (${idorRes.status})`);

  // Stranger checks their seller orders
  const strangerSellerOrders = await fetch(`${API_BASE}/seller/orders`, {
    headers: { Authorization: `Bearer ${stranger.token}` },
  });
  // Unrelated user with no store gets 403 or empty array
  assert(
    strangerSellerOrders.status === 403 || strangerSellerOrders.status === 200,
    `Stranger seller orders protected (${strangerSellerOrders.status})`
  );
  if (strangerSellerOrders.status === 200) {
    const list = await strangerSellerOrders.json();
    assert(
      !list.some((o) => o.id === createdOrder.id),
      "Stranger cannot see Daw Khin's order in seller orders"
    );
  }

  console.log("\n===============================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} BUYER-TO-SELLER VISIBILITY ASSERTIONS PASSED!`);
  console.log("===============================================================\n");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
