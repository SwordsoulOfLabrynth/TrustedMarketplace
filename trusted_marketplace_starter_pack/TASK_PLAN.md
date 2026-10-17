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

## Phase 6 --- Subscriptions, Polish & Full Acceptance Audit

### T-17: Subscription Quota & Payment Verification Engine
- **Depends on:** T-10, Phase 2–4 Subscriptions
- **Status:** **COMPLETED & VERIFIED**
- **Acceptance Criteria:**
  - `GET /subscription-plans` returns canonical tiers (Free: 10 listings / 0 MMK, Standard: 30 listings / 15,000 MMK, Premium: 100 listings / 30,000 MMK).
  - Seller submits payment reference via `POST /seller/subscription/subscribe` (KBZPay/WavePay); status set to `PendingVerification`.
  - Non-custodial integrity: Quota remains at Free tier (10 listings) while pending verification.
  - Concurrency & duplicate reference protection enforced with 409 Conflict.
  - Admin verifies/approves payment via `POST /admin/subscriptions/{id}/verify`, atomically elevating listing capacity.
  - Expired subscriptions automatically revert to Free tier.

### T-18: End-to-End Test Suite & Comprehensive Product Acceptance
- **Depends on:** T-01 through T-17
- **Status:** **COMPLETED & VERIFIED (100% Pass Rate)**
- **Audit Deliverable:** [`phase6-acceptance-report.md`](file:///C:/Users/Kyaw%20Zay%20Ya%20Hein/.gemini/antigravity/brain/d5165e98-300f-4220-9ef7-96cb3678cc2b/phase6-acceptance-report.md)
- **Acceptance Criteria:**
  - Automated integration & user journey suite (`frontend/scripts/test-phase6-e2e-journeys.mjs`): **91 / 91 assertions passed**.
  - All 12 core product journeys verified end-to-end:
    1. Buyer Auth & HttpOnly refresh token single-use rotation.
    2. Seller Onboarding & Magic-byte evidence upload (`SEC-12`).
    3. Admin review, approval, and store profile initialization.
    4. Store profile edit & `SEC-04` re-verification guard (`PendingReverification` blocks publishing).
    5. Subscription upgrade & payment verification lifecycle.
    6. Product lifecycle, image upload, and search discovery.
    7. Non-custodial order state machine (`Placed` &rarr; `Accepted` &rarr; `Shipped` &rarr; `Completed`).
    8. Transaction-linked review gating (`SEC-09`, `SEC-10`, `SEC-11`).
    9. Order dispute filing & admin adjudication workflow.
    10. Explainable trust profile & metric calculation (`T-16`).
    11. Multi-tenant isolation & IDOR protection (`SEC-05`, `SEC-06`).
    12. Edge cases, validations, and empty search states.
  - Backend automated tests: **192 / 192 passed** (109 unit tests, 83 integration tests).
  - Frontend Jest suite: **11 / 11 test suites passed** (45 tests).
  - Clean build verification: `dotnet build` (Debug & Release) 0 errors/warnings; Next.js 14-route production build 0 errors.

---

## Phase 7 --- Acceptance Remediation & Store Re-verification
- **T-01:** Admin Store Re-verification Workflow & State Machine (`PendingReverification`, `ReverificationRejected`, SEC-04 publishing lock, Admin 4th tab). *(Completed & Verified)*
- **T-02:** Payment QR Safety, Sandbox Watermarking & Evaluation Banners. *(Completed & Verified)*
- **T-03:** Semantic Search Concept Hash Benchmark & Empirical Evaluation. *(Completed & Verified)*
- **T-04:** Full Regression Suite (200 backend tests, 109 E2E assertions). *(Completed & Verified)*

---

## Phase 8 --- Semantic Search Upgrade, Final Acceptance & Deployment Readiness

### T-01: NVIDIA API Inspection & Endpoint Access Audit
- **Status:** **COMPLETED & AUDITED**
- **Findings:** Verified endpoint `https://integrate.api.nvidia.com/v1`. `baai/bge-m3` reached end-of-life on 2026-08-25 (HTTP 410 Gone). Other candidate models (`snowflake/arctic-embed-l`, `nvidia/llama-3.2-nv-embedqa-1b-v1`) return HTTP 403 Forbidden due to trial inference entitlement expiration. All secret keys protected with zero leakage.

### T-02: Multilingual Model Benchmark & Lexical Boundary Optimization
- **Status:** **COMPLETED & VERIFIED (92.3% Pass Rate, 0% False Positives)**
- **Findings:** Benchmarked against 26 fixed evaluation queries. Identified substring collisions ("basket" matching "basketball", numeric timestamps matching "16"); optimized English/Latin token matching to whole-word boundaries while preserving unsegmented Burmese syllabic matching. Achieved 0/4 false positives on out-of-catalog modern goods and 100% Top-1 Recall on craft queries.

### T-03: Resilient Embedding Provider Abstraction
- **Status:** **COMPLETED & VERIFIED**
- **Deliverables:** `IEmbeddingProvider`, `NvidiaEmbeddingProvider` with automatic sanitized failover, `LocalConceptHashEmbeddingProvider`, passage vs query input types, and `POST /api/v1/admin/catalog/reindex-embeddings` with `search-status` dashboard.

### T-04: Final End-to-End Acceptance & Full Regression
- **Status:** **COMPLETED & ACCEPTED (100% Pass Rate)**
- **Deliverables:** 204 backend tests (117 Unit + 87 Integration), 102 frontend Jest assertions, 109 automated Playwright/Node E2E user journey assertions, clean Next.js 14-route production build, and zero ESLint warnings.

### T-05: Deployment Architecture & Container Readiness
- **Status:** **COMPLETED & DELIVERED**
- **Deliverables:** Multi-stage `src/TrustedMarketplace.Api/Dockerfile`, standalone `frontend/Dockerfile`, `docker-compose.prod.yml`, `.env.production.example`, and student-budget cloud hosting blueprint (Coolify / Hetzner VPS vs Railway/Vercel).

---

## 8. Requires Team Approval

1. **Production Deployment Execution:** Decision on staging/production host selection (VPS with Docker Compose vs Managed PaaS).
2. **NVIDIA API Commercial Account:** Upgrading to paid NVIDIA API tier if remote neural embeddings are desired over local in-process concept-hash projection.
3. **Git Remote Push:** Authorization to commit and push changes to origin/main.
