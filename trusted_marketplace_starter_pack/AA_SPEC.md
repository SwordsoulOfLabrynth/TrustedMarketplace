# Authentication & Authorization Specification

**Module:** Identity and Access (A&A)  
**Priority:** P0  
**Version:** 0.3  
**Status:** Aligned with `DECISIONS.md`  

---

## 1. Objective

Provide secure account registration, authentication, and server-side authorization enforcement. Ensure strict separation between account credentials, seller verification, public store profile presence, subscription status, and account suspension.

---

## 2. Core concepts & Invariants

1. **Authentication:** Proves user identity via Email + Password.
2. **Roles:** Broad system classifications (`Buyer`, `Admin`).
3. **Seller Verification Status:** Whether a seller's identity documents have been approved by an administrator (`Pending`, `Approved`, `Rejected`, `MoreInformationRequired`).
4. **Store Profile Status:** Whether public store profile is `Verified` or `PendingReverification`.
5. **Subscription Status:** Whether paid listing entitlements are active (`Active`, `Expired`).
6. **Account Status:** Overall user standing (`Active`, `Suspended`, `Closed`).

---

## 3. Strict authorization rules

| Rule ID | Subject | Rule Description | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **AR-01** | Public Registration | Registration endpoint assigns only the `Buyer` role. Client cannot supply or escalate to `Admin`. | Backend hardcodes `Role = Buyer` on entity creation. |
| **AR-02** | Account Status Override | A user with `AccountStatus == Suspended` or `Closed` is blocked from all state-mutating actions. | Global authorization requirement (`ActiveAccountRequirement`). |
| **AR-03** | Seller Eligibility | Only users with `AccountStatus == Active` and a verified `SellerProfile` can publish listings. | Policy `RequireApprovedSeller` on `/seller/products/*`. |
| **AR-04** | Resource Ownership | Sellers can edit/archive only their own listings. Buyers/sellers can access only their own orders. | Resource-based authorization handler (`ResourceOwnerRequirement<T>`). |
| **AR-05** | Order State Machine | Seller cannot unilaterally mark an order `Completed`. Only the assigned `BuyerUserId` can confirm delivery. | Invariant validation in `OrderService.ConfirmDeliveryAsync`. |
| **AR-06** | Review Eligibility | Only the verified buyer of an order in `Completed` status can submit a review. Max 1 review per order. | Business check in `ReviewService` + DB Unique constraint on `(OrderId, ReviewerUserId)`. |
| **AR-07** | Evidence Confidentiality | Verification evidence files are strictly inaccessible to public users and other sellers. | Admin-only policy on evidence download endpoint + private storage path outside web root. |
| **AR-08** | Audit Trail | Admin decisions (approving sellers, resolving disputes, changing user status) must be audited. | Automatic creation of append-only `AuditEvents` row on action execution. |

---

## 4. Security acceptance criteria and negative test suite

The authorization module is considered complete only when all the following automated tests pass:

| Test ID | Test Category | Scenario / Assertion | Expected HTTP Status / Result |
| :--- | :--- | :--- | :--- |
| **SEC-01** | Privilege Escalation | Request `POST /auth/register` with payload `{ "role": "Admin" }`. | `201 Created`, but user is created with `Buyer` role only. |
| **SEC-02** | Admin Endpoint Protection | Authenticated Buyer requests `GET /admin/seller-applications`. | `403 Forbidden`. |
| **SEC-03** | Suspended Account Lockout | User with `AccountStatus = Suspended` attempts to place an order or publish a product. | `403 Forbidden` with RFC 7807 problem code `ACCOUNT_SUSPENDED`. |
| **SEC-04** | Unapproved Seller Block | Authenticated user with `Pending` application attempts `POST /seller/products`. | `403 Forbidden` with code `SELLER_NOT_APPROVED`. |
| **SEC-05** | Product IDOR Protection | Seller B attempts `PATCH /seller/products/{id}` on a product owned by Seller A. | `403 Forbidden` or `404 Not Found`. |
| **SEC-06** | Order IDOR Protection | User C attempts `GET /orders/{id}` on an order between Buyer A and Seller B. | `403 Forbidden` or `404 Not Found`. |
| **SEC-07** | Order State Violation | Seller attempts `POST /orders/{id}/confirm-delivery`. | `403 Forbidden` (only Buyer can confirm delivery). |
| **SEC-08** | Invalid Order Transition | Buyer attempts to confirm delivery on an order that is still in `Placed` or `Accepted` status. | `409 Conflict` (order must be `Shipped` before delivery confirmation). |
| **SEC-09** | Premature Review Block | Buyer attempts `POST /orders/{id}/reviews` while order status is `Shipped`. | `400 Bad Request` or `409 Conflict` (order not completed). |
| **SEC-10** | Duplicate Review Block | Buyer attempts a second review submission for the same completed order. | `409 Conflict` (unique constraint violation handled cleanly). |
| **SEC-11** | Non-Buyer Review Block | Seller or unrelated user attempts `POST /orders/{id}/reviews` on a completed order. | `403 Forbidden`. |
| **SEC-12** | Private Evidence Leakage | Unauthenticated visitor or Buyer requests `GET /admin/seller-applications/{id}/evidence/{evidenceId}`. | `401 Unauthorized` / `403 Forbidden`. Evidence binary is not exposed. |
| **SEC-13** | Credential Enumeration | Login with non-existent email vs. wrong password. | Uniform `401 Unauthorized` ("Invalid email or password"). |

---

## 5. Token & Session Lifecycle

- **Access Token:** JWT signed with HMAC-SHA256 (or RSA). Expiration: 15 minutes. Holds `sub` (User ID), `email`, and `roles` claims.
- **Refresh Token:** Cryptographically random 64-byte string stored hashed in database. Transmitted exclusively via `HttpOnly`, `Secure`, `SameSite=Strict` cookie. Expiration: 7 days.
- **Revocation:** `POST /auth/logout` revokes the refresh token and clears the cookie.
- **Rotation:** Each invocation of `/auth/refresh-token` issues a new access token and rotates the refresh token. Old refresh token reuse triggers complete family revocation.

---

## 6. Requires Team Approval

1. **Account Lockout Threshold:** Confirming standard threshold (e.g. 5 failed password attempts locks account for 15 minutes).
2. **Access Token Lifespan:** Confirming 15-minute access token lifespan.
3. **Session Revocation on Password Change:** Whether resetting password automatically invalidates all existing refresh tokens.
