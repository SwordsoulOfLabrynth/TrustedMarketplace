# Architecture & Product Decisions (Phase 1 MVP)

**Document:** `DECISIONS.md`  
**Status:** Canonical Baseline — Requires Team Sign-Off on Highlighted Items  
**Context:** Trusted Marketplace (Myanmar Pilot / DEEP Finalist)  

---

## 1. Executive Summary

This document serves as the binding single source of truth for architectural, domain, identity, transaction, and scope decisions for the Trusted Marketplace Phase 1 MVP. All companion documents (`MASTER_PRD.md`, `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`, `AA_SPEC.md`, `TASK_PLAN.md`, and `README.md`) must conform strictly to the decisions recorded here.

---

## 2. Decision Log

### Decision 1: Backend Platform & Runtime Version
- **Decision:** Use C# with ASP.NET Core Web API on **.NET 10** (`net10.0`).
- **Rationale:** The development workstation environment is currently equipped with .NET SDK `10.0.401`. Utilizing modern C# 13/.NET features provides optimal performance, built-in OpenAPI/scalar support, native RFC 7807 problem details, and improved EF Core tooling.
- **Verification Rule:** Before deploying to staging/production, the team must verify that the target deployment environment (e.g., Docker container base image `mcr.microsoft.com/dotnet/aspnet:10.0` or host PaaS) natively supports .NET 10. If the host platform only supports .NET 8 LTS, rolling back target framework to `net8.0` can be done with minimal code changes.
- **Trade-offs:** .NET 10 is the newest release cycle; standard PaaS buildpacks (like older Render/Heroku stacks) may lag behind containerized deployments.

---

### Decision 2: Registration & Primary User Identifier
- **Decision:** Use **Email + Password** as the sole login identifier for Phase 1. Defer phone number SMS OTP verification to Phase 2.
- **Rationale:** 
  1. SMS OTP integration in Myanmar requires commercial aggregators (SMSPoh, Viber Business) and incurs per-SMS gateway costs and telco routing issues across MPT, ATOM, Ooredoo, and Mytel.
  2. ASP.NET Core Identity provides robust, battle-tested support for email-based registration, password hashing (PBKDF2 with HMAC-SHA512), and lockout controls without external telecom dependencies.
- **Trade-offs:** Myanmar consumers and social media merchants predominantly utilize mobile numbers. Early pilot participants must have valid email addresses.

---

### Decision 3: Identity, Seller Verification, and Store Profile Separation
- **Decision:** Strictly decouple Account Identity (`Users`), Seller Application/Verification (`SellerApplications`), Public Store Presence (`SellerProfiles`), and Paid Status (`SellerSubscriptions`).
- **Entity Boundaries:**
  - `Users`: Central authentication entity managed by ASP.NET Core Identity. Holds credentials, personal `DisplayName`, `Email`, and `AccountStatus` (`Active`, `Suspended`, `Closed`).
  - `SellerApplications`: Records verification lifecycle (`Pending`, `Approved`, `Rejected`, `MoreInformationRequired`). Links to private verification evidence.
  - `SellerProfiles`: Dedicated 1-to-1 entity for users with `Approved` seller applications. Contains public-facing store data: `StoreName`, `Slug`, `Bio`, `ContactPhone`, `CityOrTownship`, `LogoStorageKey`, and `VerificationStatus` (`Verified`, `PendingReverification`).
  - `SellerSubscriptions`: Independent subscription entitlements. Does not confer verification status or trust metrics.
- **Store-Name Change Re-Verification Policy:**
  - If an approved seller updates their `Bio`, `ContactPhone`, or `LogoStorageKey`, the change takes effect immediately.
  - If a seller modifies their `StoreName`, the store's `VerificationStatus` transitions to `PendingReverification`. The store retains its current listings, but a public flag indicates a name change is under administrative review to prevent brand spoofing.

---

### Decision 4: Authentication Flow & Client Topology Strategy
- **Inspection Finding:** Inspection of the current workspace confirms that **no frontend client application or deployment configuration currently exists** in the repository.
- **Decision & Recommendation:**
  - **Option A (If Decoupled SPA / Mobile in Phase 2):** Standardize on **ASP.NET Core Identity with JWT Bearer Access Tokens in memory + HttpOnly, Secure, SameSite=Strict Refresh Token Cookies**. This avoids cross-origin cookie sharing bugs when the frontend (e.g. Next.js on Vercel/localhost:3000) and backend (localhost:5000) run on separate domains.
  - **Option B (If Unified Reverse Proxy / BFF):** Standardize on **ASP.NET Core HttpOnly, Secure, SameSite=Lax Cookies** with Anti-Forgery (CSRF) validation.
  - *Interim Assumption*: The backend will implement standard JWT token issuance with Refresh Tokens as the baseline to remain client-agnostic until the frontend topology is committed.

---

### Decision 5: Non-Custodial Order State Machine & Dispute Handling
- **Decision:** 
  1. **Strictly Non-Custodial:** The platform operates as a transaction coordinator. No escrow, in-app wallet, or custody of buyer funds.
  2. **Server-Enforced Lifecycle:**
     - `Placed`: Buyer submits order with shipping snapshot.
     - `Accepted`: Seller confirms item availability.
     - `Shipped`: Seller dispatches goods with courier note.
     - `Completed`: **Buyer confirms receipt of goods.**
     - `Cancelled`: Buyer cancels before seller accepts, or seller cancels with reason.
     - `Disputed`: Buyer or Seller files a complaint on a shipped order.
  3. **Strict Invariant:** The Seller **cannot** unilaterally mark an order as `Completed`.
  4. **No Automatic Completion Timeouts:** Orders will never auto-complete on a background timer in the MVP.
  5. **Dispute Resolution Process:** If a buyer fails to confirm delivery after courier delivery, the seller may file a dispute (`POST /orders/{id}/complaints`). An Admin reviews courier waybill proof and may execute an audited dispute resolution (`POST /admin/orders/{id}/resolve-dispute`) to mark the order `Completed`.

---

### Decision 6: Review Scope & Eligibility Rules
- **Decision:** 
  1. Reviews are strictly **Order-Level (Transaction Experience)**: one review per completed order.
  2. Product-level reviews are deferred to Phase 2.
  3. Eligibility: Caller must be `BuyerUserId` of an order in `Completed` status.
  4. Uniqueness: Database-level unique constraint on `(OrderId, ReviewerUserId)` ensures exactly one review per transaction.
- **Rationale:** Focuses on seller fulfillment credibility rather than manufacturer product defects, keeping implementation lightweight and high-signal.

---

### Decision 7: Subscriptions Model for MVP
- **Decision:** 
  - Subscriptions in Phase 1 are **Admin-managed / Mock entitlements only**.
  - No real payment gateway integration (KBZPay, WavePay, Stripe), no checkout redirects, and no webhook processors.
  - Admins assign or update a seller's plan (`Free`, `Standard`, `Premium`) via an administrative endpoint (`POST /admin/sellers/{id}/subscription`).
  - Paid status grants higher listing limits (e.g., Free = 10 products, Premium = 100 products), but **never** confers verification badges, search boosting, or trust points.

---

### Decision 8: Transparent Trust Indicators & Metrics
- **Decision:** 
  - The platform will **not** calculate or display a single composite or opaque trust score.
  - Public trust indicators (`GET /api/v1/sellers/{id}/trust-profile`) consist solely of transparent, explainable counts:
    1. **Verification Status**: `Verified` with `VerifiedSinceUtc`.
    2. **Completed Orders Count**: Total orders with status `Completed`.
    3. **Verified Review Count & Average Rating**: Review count and arithmetic mean (1.0 to 5.0).
    4. **Resolved Complaint Count**: Upheld complaints resolved by admins.
    5. **Account Age / Tenure**: Store creation date.
  - **Disclaimer Rule:** Every trust profile response and UI component must carry the disclaimer: *"Verification confirms identity documentation at approval; it is not a guarantee of transaction safety or product quality."*

---

### Decision 9: Private Verification Evidence Storage & Retention Policy
- **Decision:** 
  - All seller identity documents (NRC cards, licenses) are stored in an isolated directory outside the public web root.
  - Never generate public static URLs for private evidence.
  - Admin inspection requires an authenticated endpoint (`GET /api/v1/admin/seller-applications/{id}/evidence/{evidenceId}`) and writes an immutable record to `AuditEvents`.
- **Proposed Evidence Retention Policy:**
  - *Rejected Applications:* Delete physical evidence files 30 days after final rejection notice.
  - *Approved Sellers:* Retain evidence during active seller tenure. Upon voluntary account closure or permanent suspension, retain evidence for 90 days for fraud review, then delete physical files while retaining SHA-256 hashes and decision audit records indefinitely.
  - *Notice:* Marked as requiring team and compliance approval.

---

### Decision 10: Implementation Scope Guardrails
- **Decision:** Bounded strictly to the core student-viable workflow:
  - Account Registration & Login (Email/Password)
  - Seller Application, Private NRC Upload, Admin Approval
  - Store Profile CRUD & Listing Management (Approved Sellers)
  - Public Catalog Browsing, Keyword Search, Pagination
  - Non-Custodial Order Placement & Server-Enforced Lifecycle (Buyer Confirmation Required)
  - Order Transaction Review Submission
  - Complaint Submission & Admin Dispute Resolution
  - Explainable Seller Trust Profile
  - Admin-Assigned Subscriptions (Mock)
  - Audit Logging of Sensitive Actions

---

## 3. Requires Team Approval

The following specific questions and proposals are unresolved and require explicit team sign-off:

1. **Frontend Client Topology Sign-Off:**
   - *Status:* Unresolved (no frontend code in workspace).
   - *Question:* Will the frontend be a decoupled SPA (Vite/React on separate port/domain requiring JWT Access + Refresh Cookies) or deployed behind a unified reverse proxy/BFF (allowing pure HttpOnly Cookies)?
2. **Evidence Retention & Purge Policy:**
   - *Status:* Proposal submitted (30 days for rejected, 90 days post-closure for approved).
   - *Question:* Does the team approve this specific evidence retention and purging timeline?
3. **Target Production Hosting for .NET 10:**
   - *Status:* Workstation verified (`net10.0`), production host unverified.
   - *Question:* Where will staging and production be hosted, and does the host support Docker containers running .NET 10?
4. **Email Confirmation in Development/Demo:**
   - *Status:* Proposed bypass for pilot (`RequireConfirmedEmail = false`).
   - *Question:* Should registration require clicking an email verification link during the student demo, or should accounts be active upon registration?
5. **Subscription Tier Listing Limits:**
   - *Status:* Proposed (Free = 10 listings, Standard = 30 listings, Premium = 100 listings).
   - *Question:* Does the team agree with these initial listing tier limits?
