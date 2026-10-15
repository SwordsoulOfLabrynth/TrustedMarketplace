# Task Plan --- Trusted Marketplace

**Version:** 0.3  
**Status:** Aligned with `DECISIONS.md`  

---

## Phase 0 --- Approvals & Baselines

### T-01: Approve Project Decisions and Specs
- **Depends on:** None
- **Deliverable:** Approved `DECISIONS.md` and companion specifications.
- **Acceptance Criteria:** Team formally signs off on .NET 10, email/password registration, non-custodial orders, buyer confirmation rule, and mock subscriptions.

---

## Phase 1 --- Foundation & Tooling

### T-02: Solution Scaffold & Architecture Structure
- **Depends on:** T-01
- **Deliverable:** Clean buildable .NET 10 modular monolith solution (`TrustedMarketplace.Domain`, `Application`, `Infrastructure`, `Api`, `UnitTests`, `IntegrationTests`).
- **Acceptance Criteria:** `dotnet build` succeeds on clean checkout; README documents exact build commands.

### T-03: Persistence & EF Core Migrations
- **Depends on:** T-02
- **Deliverable:** PostgreSQL DbContext, entity configurations, initial migrations.
- **Acceptance Criteria:** `dotnet ef database update` executes cleanly against local PostgreSQL; audit interceptor populates UTC timestamps.

### T-04: Cross-Cutting Middleware & Error Handling
- **Depends on:** T-02
- **Deliverable:** RFC 7807 `ProblemDetails` global exception handling, correlation ID middleware, Serilog structured logging.
- **Acceptance Criteria:** Unhandled exceptions return structured JSON with correlation ID; no stack traces or secrets leak in responses.

---

## Phase 2 --- Authentication & Access Control (A&A)

### T-05: Account Model & ASP.NET Core Identity
- **Depends on:** T-03
- **Acceptance Criteria:** `ApplicationUser` inherits from `IdentityUser<Guid>`; manages `DisplayName`, `Email`, and `AccountStatus` (`Active`, `Suspended`, `Closed`).

### T-06: Registration & Login API
- **Depends on:** T-05, T-04
- **Acceptance Criteria:**
  - `POST /auth/register` creates account with `Buyer` role only (passes `SEC-01`).
  - `POST /auth/login` returns access token and sets refresh cookie; uniform error on failure (`SEC-13`).
  - `POST /auth/logout` revokes session.
  - `GET /auth/me` returns safe current-user profile.

### T-07: Authorization Policies & Account Status
- **Depends on:** T-06
- **Acceptance Criteria:**
  - `RequireActiveUser` blocks `Suspended` accounts (`SEC-03`).
  - `RequireAdmin` rejects non-admin users with 403 (`SEC-02`).
  - Automated integration tests verify negative access cases.

---

## Phase 3 --- Seller Verification & Store Profiles

### T-08: Seller Applications & Secure Evidence Storage
- **Depends on:** T-07
- **Acceptance Criteria:**
  - `POST /seller-applications` submits application.
  - `POST /seller-applications/me/evidence` saves uploaded NRC to private directory outside web root.
  - Magic byte validation rejects SVGs and non-image files; files cannot be accessed anonymously (`SEC-12`).

### T-09: Admin Verification Workflow & Audit
- **Depends on:** T-08
- **Acceptance Criteria:**
  - Admin can list and view applications.
  - `GET /admin/seller-applications/{id}/evidence/{evidenceId}` allows admin download and writes to `AuditEvents`.
  - Admin decision (`Approved`, `Rejected`) updates status and logs history.

### T-10: Store Profiles & Re-Verification Trigger
- **Depends on:** T-09
- **Acceptance Criteria:**
  - Approved seller can manage `SellerProfile` (`StoreName`, `Bio`, `ContactPhone`, `CityOrTownship`).
  - Updating `StoreName` automatically sets store `VerificationStatus` to `PendingReverification`.
  - Public endpoint `GET /sellers/{id}/store` displays store data.

---

## Phase 4 --- Product Catalog

### T-11: Categories & Product CRUD
- **Depends on:** T-10
- **Acceptance Criteria:**
  - Unapproved or suspended sellers are rejected when publishing products (`SEC-04`).
  - Approved seller can create, edit, publish, and archive own products.
  - Editing another seller's product returns 403/404 (`SEC-05`).
  - Subscription listing quota is enforced server-side.

### T-12: Public Catalog Browsing & Search
- **Depends on:** T-11
- **Acceptance Criteria:**
  - `GET /products` returns published listings with keyword search, category filter, price bounds, and pagination.
  - Draft and archived listings are hidden from public discovery.

---

## Phase 5 --- Orders, Reviews, Complaints & Trust

### T-13: Non-Custodial Order State Machine
- **Depends on:** T-11
- **Acceptance Criteria:**
  - Buyer places order (`POST /orders`) capturing delivery address and phone snapshot.
  - Transitions validated: `Placed` &rarr; `Accepted` &rarr; `Shipped`.
  - **Buyer Confirmation:** Only buyer can call `POST /orders/{id}/confirm-delivery` to transition to `Completed` (`SEC-07`, `SEC-08`).
  - Order IDOR protection verified (`SEC-06`).

### T-14: Transaction-Linked Reviews
- **Depends on:** T-13
- **Acceptance Criteria:**
  - Only buyer of `Completed` order can submit review (`POST /orders/{id}/reviews`) (`SEC-09`, `SEC-11`).
  - Unique constraint enforces max 1 review per order (`SEC-10`).
  - `GET /sellers/{id}/reviews` lists reviews for a seller.

### T-15: Complaints & Admin Dispute Resolution
- **Depends on:** T-13
- **Acceptance Criteria:**
  - Participant can file complaint (`POST /orders/{id}/complaints`) setting order status to `Disputed`.
  - Admin can review courier proof and resolve dispute (`POST /admin/orders/{id}/resolve-dispute`) marking order completed or cancelled with audit log.

### T-16: Explainable Trust Metrics Read Model
- **Depends on:** T-14, T-15
- **Acceptance Criteria:**
  - `GET /sellers/{id}/trust-profile` returns verified badge, tenure, completed order count, review count, average rating, resolved complaints count, and mandatory disclaimer.
  - Verified completed orders count matches database reality.

---

## Phase 6 --- Subscriptions & Polish

### T-17: Admin-Managed Mock Subscriptions
- **Depends on:** T-10
- **Acceptance Criteria:**
  - `GET /subscription-plans` returns tiers (Free, Standard, Premium) and listing limits.
  - `POST /admin/sellers/{id}/subscription` assigns tier.
  - Product creation rejects listings exceeding active subscription limit.

### T-18: End-to-End Test Suite & Demo Verification
- **Depends on:** T-01 through T-17
- **Acceptance Criteria:**
  - Automated integration test runs complete happy path: Register &rarr; Apply &rarr; Admin Approve &rarr; Publish Product &rarr; Place Order &rarr; Ship &rarr; Confirm Delivery &rarr; Review &rarr; Verify Trust Profile.
  - All security tests (`SEC-01` to `SEC-13`) pass.

---

## Phase 7 --- Advanced Capabilities & Completed Extensions

- **D-01 (T-SMS):** Phone number registration and SMS OTP gateway integration. *(Deferred)*
- **D-02 (T-34):** Payment provider integration (KBZPay, WavePay) for platform subscription billing. *(Completed in Phases 2-4: QR-based submission, duplicate conflict guard, admin verification queue, dynamic quota elevation).*
- **D-03 (T-PROD-REV):** Granular product-level ratings and reviews. *(Deferred)*
- **D-04 (T-35 / T-36):** Burmese/English semantic vector search with pgvector. *(Completed in Phase 5: PostgreSQL pgvector integration, 384-dimensional multilingual embeddings, NFC Unicode normalization, Burmese syllable segmentation, craft concept clusters, hybrid lexical/semantic ranking, automatic indexing, 100% test pass rate).*
- **D-05 (T-RANK):** Trust-weighted search ranking algorithms. *(Deferred)*
- **D-06 (T-APP):** Flutter mobile application development. *(Deferred)*

---

## 8. Requires Team Approval

1. **Frontend Repository Location:** Confirmation whether frontend will live in a subfolder (`/frontend`) or a separate repository.
2. **Staging Environment Access:** Credentials and hosting target for deploying the Docker container.
3. **Seed Data Selection:** Defining sample Myanmar categories and mock seller profiles for the demo.
