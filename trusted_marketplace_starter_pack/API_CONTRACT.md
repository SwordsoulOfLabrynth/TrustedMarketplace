# Initial API Contract

**Base path:** `/api/v1`  
**Version:** 0.3  
**Status:** Aligned with `DECISIONS.md`  

---

## 1. Conventions

- Standard JSON request and response payloads.
- All timestamps formatted as ISO 8601 UTC strings (`2026-10-10T16:00:00Z`).
- Identifiers are formatted as UUID v4 strings.
- Consistent RFC 7807 `ProblemDetails` error responses on failure.
- Pagination query parameters: `page` (default 1) and `pageSize` (default 20, max 100).
- All protected endpoints derive the current caller identity and role strictly from the authenticated server context.

---

## 2. Authentication endpoints

### `POST /auth/register`
- **Access:** Public / Anonymous
- **Request:**
  ```json
  {
    "displayName": "Aung Ko",
    "email": "aungko@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response:** `201 Created`
  ```json
  {
    "id": "e7b0c518-d9c1-48e2-b13c-c8d356fae412",
    "displayName": "Aung Ko",
    "email": "aungko@example.com",
    "role": "Buyer",
    "accountStatus": "Active"
  }
  ```

### `POST /auth/login`
- **Access:** Public / Anonymous
- **Request:**
  ```json
  {
    "email": "aungko@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "expiresInSeconds": 900,
    "user": {
      "id": "e7b0c518-d9c1-48e2-b13c-c8d356fae412",
      "displayName": "Aung Ko",
      "email": "aungko@example.com",
      "role": "Buyer",
      "accountStatus": "Active"
    }
  }
  ```
  *(Note: Refresh token issued via HttpOnly, Secure cookie).*

### `POST /auth/logout`
- **Access:** Authenticated
- **Response:** `204 No Content`

### `GET /auth/me`
- **Access:** Authenticated
- **Response:** `200 OK`
  ```json
  {
    "id": "e7b0c518-d9c1-48e2-b13c-c8d356fae412",
    "displayName": "Aung Ko",
    "email": "aungko@example.com",
    "role": "Buyer",
    "accountStatus": "Active"
  }
  ```

---

## 3. Seller onboarding & Verification endpoints

### `POST /seller-applications`
- **Access:** Authenticated Buyer (`AccountStatus == Active`)
- **Request:**
  ```json
  {
    "proposedStoreName": "Aung Craft Store",
    "businessType": "IndividualCrafter",
    "contactPhone": "0912345678"
  }
  ```
- **Response:** `201 Created`

### `GET /seller-applications/me`
- **Access:** Authenticated Buyer
- **Response:** `200 OK` returns current application and status (`Pending`, `Approved`, etc.).

### `POST /seller-applications/me/evidence`
- **Access:** Authenticated Buyer with active application
- **Request:** `multipart/form-data` with fields `evidenceType` and `file`.
- **Response:** `201 Created` with file metadata (never public URL).

### `GET /admin/seller-applications`
- **Access:** Admin only
- **Response:** `200 OK` paginated list of pending/reviewed applications.

### `GET /admin/seller-applications/{id}`
- **Access:** Admin only
- **Response:** `200 OK` application details and attached evidence records.

### `GET /admin/seller-applications/{id}/evidence/{evidenceId}`
- **Access:** Admin only
- **Response:** `200 OK` file binary stream (records event in `AuditEvents`).

### `POST /admin/seller-applications/{id}/decision`
- **Access:** Admin only
- **Request:**
  ```json
  {
    "decision": "Approved", // or "Rejected", "MoreInformationRequired"
    "reason": "National registration card and store details verified."
  }
  ```
- **Response:** `200 OK`

---

## 4. Public store profile & Trust endpoints

### `GET /sellers/{sellerId}/store`
- **Access:** Public / Anonymous
- **Response:** `200 OK`
  ```json
  {
    "sellerUserId": "e7b0c518-d9c1-48e2-b13c-c8d356fae412",
    "storeName": "Aung Craft Store",
    "slug": "aung-craft-store",
    "bio": "Handmade wooden crafts from Mandalay.",
    "contactPhone": "0912345678",
    "cityOrTownship": "Mandalay",
    "verificationStatus": "Verified",
    "memberSinceUtc": "2026-09-01T00:00:00Z"
  }
  ```

### `GET /sellers/{sellerId}/trust-profile`
- **Access:** Public / Anonymous
- **Response:** `200 OK`
  ```json
  {
    "sellerUserId": "e7b0c518-d9c1-48e2-b13c-c8d356fae412",
    "verificationStatus": "Verified",
    "verifiedSinceUtc": "2026-09-15T10:00:00Z",
    "completedOrdersCount": 42,
    "reviewCount": 38,
    "averageRating": 4.8,
    "resolvedComplaintsCount": 1,
    "disclaimer": "Verification confirms identity documentation at approval; it is not a guarantee of transaction safety or product quality."
  }
  ```

### `PUT /seller/store`
- **Access:** Authenticated Approved Seller
- **Request:**
  ```json
  {
    "storeName": "Aung Premier Crafts",
    "bio": "Updated bio...",
    "contactPhone": "0912345678",
    "cityOrTownship": "Mandalay"
  }
  ```
- **Response:** `200 OK` (Note: changing `storeName` shifts `verificationStatus` to `PendingReverification`).

---

## 5. Product catalog endpoints

- `GET /products` --- Public listing search with `keyword`, `categoryId`, `minPrice`, `maxPrice`, `page`, `pageSize`.
- `GET /products/{productId}` --- Public product detail.
- `POST /seller/products` --- Approved Seller creates draft product (enforces subscription listing quota).
- `PATCH /seller/products/{productId}` --- Seller edits own product.
- `POST /seller/products/{productId}/publish` --- Seller publishes listing.
- `POST /seller/products/{productId}/archive` --- Seller archives listing.

---

## 6. Non-custodial order endpoints

### `POST /orders`
- **Access:** Authenticated Buyer (`AccountStatus == Active`)
- **Request:**
  ```json
  {
    "productId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "quantity": 1,
    "buyerContactPhone": "09777123456",
    "deliveryAddress": "No. 42, 73rd Street",
    "deliveryCityOrTownship": "Mandalay",
    "deliveryNotes": "Call before arrival"
  }
  ```
- **Response:** `201 Created` with initial status `Placed`.

### `GET /orders/{orderId}`
- **Access:** Authenticated Participant (Buyer or Seller) or Admin.

### `GET /buyer/orders`
- **Access:** Authenticated Buyer (returns own placed orders).

### `GET /seller/orders`
- **Access:** Authenticated Seller (returns incoming orders).

### Order State Action Endpoints:
- `POST /orders/{orderId}/accept`
  - **Access:** Seller of the order. Transitions `Placed` &rarr; `Accepted`.
- `POST /orders/{orderId}/ship`
  - **Access:** Seller of the order. Transitions `Accepted` &rarr; `Shipped`. Accepts optional courier waybill tracking string.
- `POST /orders/{orderId}/confirm-delivery`
  - **Access:** **Buyer of the order only.** Transitions `Shipped` &rarr; `Completed`.
- `POST /orders/{orderId}/cancel`
  - **Access:** Buyer (if still `Placed`) or Seller (before `Shipped`). Requires `reason`.
- `POST /admin/orders/{orderId}/resolve-dispute`
  - **Access:** Admin only. Transitions `Disputed` &rarr; `Completed` or `Cancelled` with mandatory audit reason.

---

## 7. Reviews and complaints

### `POST /orders/{orderId}/reviews`
- **Access:** Buyer of the completed order only.
- **Request:**
  ```json
  {
    "rating": 5,
    "comment": "Fast courier delivery and exactly as described. Genuine seller."
  }
  ```
- **Response:** `201 Created` (Rejects if order not `Completed` or review already submitted).

### `GET /sellers/{sellerId}/reviews`
- **Access:** Public / Anonymous. Returns paginated order-level reviews for the seller.

### `POST /orders/{orderId}/complaints`
- **Access:** Buyer or Seller of the order.
- **Request:**
  ```json
  {
    "description": "Item was dispatched but never arrived after 10 days.",
    "evidenceStorageKey": "..."
  }
  ```
- **Response:** `201 Created`. Automatically shifts order status to `Disputed`.

### `GET /complaints/{complaintId}`
- **Access:** Reporter, Subject Seller, or Admin.

### `GET /admin/complaints`
- **Access:** Admin only.

### `POST /admin/complaints/{complaintId}/decision`
- **Access:** Admin only. Sets resolution code and updates audit history.

---

## 8. Subscriptions (Admin-managed mock entitlements)

### `GET /subscription-plans`
- **Access:** Public. Returns available plans (`Free`, `Standard`, `Premium`) and listing limits.

### `GET /seller/subscription`
- **Access:** Authenticated Seller. Returns current active plan and listing capacity.

### `POST /admin/sellers/{sellerId}/subscription`
- **Access:** Admin only.
- **Request:**
  ```json
  {
    "subscriptionPlanId": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    "durationMonths": 3
  }
  ```
- **Response:** `200 OK`.

---

## 9. Requires Team Approval

1. **Explicit Confirm-Delivery Endpoint Schema:** Confirmation that explicit transition actions (`/accept`, `/ship`, `/confirm-delivery`) are preferred over a generic `/transition` endpoint.
2. **Review Edit / Delete Capability:** Confirming that reviews cannot be edited by buyers after submission (to preserve metric integrity).
3. **Public Reviews Pagination Bound:** Maximum `pageSize` for public seller reviews (e.g., max 50).
