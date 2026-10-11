# Trusted Marketplace --- Master PRD

**Version:** 0.3  
**Stage:** DEEP Finalist  
**Status:** Aligned with `DECISIONS.md` (Baseline for Implementation)  
**Market:** Myanmar  
**Product:** Trust-focused online marketplace  

---

## 1. Product vision

Help buyers discover products from sellers whose identity and marketplace history can be evaluated, while helping legitimate sellers build a credible, evidence-based reputation.

The platform reduces uncertainty; **it does not guarantee that every seller, product, or transaction is safe.**

---

## 2. Problem hypothesis

Buyers in Myanmar find it difficult to distinguish genuine social commerce sellers from fraudulent ones. Legitimate sellers struggle to demonstrate credibility without costly advertising. These hypotheses are being validated through user interviews and pilot testing.

---

## 3. Target users

- **Visitor:** Browse public listings, public store profiles, and seller trust indicators.
- **Buyer:** Manage a buyer account, place non-custodial orders, confirm delivery, submit transaction reviews, and file complaints.
- **Seller:** Apply for seller verification, manage public store profile, publish and manage listings, and fulfill orders.
- **Administrator:** Verify seller identity documents, moderate listings, investigate complaints, resolve delivery disputes, manage subscription tiers, and audit platform activity.

---

## 4. Product goals

1. Make seller verification status clear, auditable, and transparently separated from paid subscriptions.
2. Show explainable, evidence-backed trust indicators (completed orders, verified review scores, resolved complaints).
3. Support product discovery and non-custodial marketplace transactions.
4. Enforce server-side order lifecycle rules where buyer confirmation is required for order completion.
5. Provide structured complaint investigation and admin-adjudicated dispute resolution.
6. Test seller willingness to pay for listing capacity via admin-managed subscription tiers without real payment custody.
7. Demonstrate a working, secure, and reproducible web application within competition constraints.

---

## 5. Non-goals for the initial release (MVP)

- **No Escrow or Custody of Funds:** The platform will not hold, route, or custody buyer or seller funds. No digital wallets.
- **No Claims of Absolute Safety:** Verification certifies submitted documentation at a point in time; it does not guarantee product authenticity or delivery safety.
- **No Unauthorised Scraping:** No automated scraping of Facebook, TikTok, or external platforms.
- **No Opaque Trust Scores:** No single algorithmic credit score or opaque formula.
- **No SMS Gateway Integration:** No phone SMS OTP in Phase 1; email/password authentication is used for the pilot.
- **No Real Payment Gateways:** No payment provider checkouts (KBZPay/WavePay/Stripe) or webhooks in Phase 1.
- **No Automatic Completion Timeouts:** Orders never force-complete automatically on a timer.
- **No Product-Level Reviews:** Reviews evaluate order transaction experience only.
- **No Native Mobile Apps:** Focus exclusively on responsive web.
- **No Microservices or Premature Vector Search:** Modular monolith architecture with standard relational search.

---

## 6. Product principles

1. Verification is not a guarantee of product quality or transaction safety.
2. Subscription status never buys or increases trust or verification.
3. Trust indicators must be explainable and based strictly on recorded evidence.
4. Private verification evidence is never public and accessible only to authorized administrators with audit logging.
5. Complaints are allegations until investigated and resolved by an administrator.
6. All business rules and authorization policies are enforced server-side.
7. Public claims must match implemented functionality.

---

## 7. Release scope breakdown

### P0 --- Core Release (MVP)

- **Authentication & Identity:**
  - Registration, login, logout, and current-user profile using Email + Password via ASP.NET Core Identity.
  - Role enforcement: Visitor, Buyer, Seller, Admin.
  - Account status lifecycle: `Active`, `Suspended`, `Closed`.
- **Seller Verification & Store Presence:**
  - Seller application submission with private NRC/business document uploads.
  - Secure, private storage for verification documents with admin audit logging.
  - Admin review workflow: `Pending`, `MoreInformationRequired`, `Approved`, `Rejected`.
  - Dedicated `SellerProfile` (Store) entity for approved sellers (`StoreName`, `Bio`, `CityOrTownship`, `ContactPhone`).
  - Store-name change re-verification rule: changing `StoreName` triggers `PendingReverification`.
- **Catalog & Discovery:**
  - Category browsing and management.
  - Seller product CRUD (Draft, Published, Archived) with ownership checks and listing limits.
  - Public product browsing with keyword search, category filtering, price range, and pagination.
- **Non-Custodial Orders:**
  - Buyer order creation with delivery contact and address snapshotting.
  - Server-enforced state transitions: `Placed` &rarr; `Accepted` &rarr; `Shipped` &rarr; `Completed` (or `Cancelled`).
  - Strict rule: Seller cannot unilaterally complete an order; **Buyer confirmation is required for completion**.
  - Admin-reviewed dispute resolution for exceptional delivery completion disputes.
- **Reviews & Complaints:**
  - One transaction-experience review per completed order (`OrderId` + `ReviewerUserId` unique).
  - Complaint submission linked to orders with evidence attachment.
  - Administrative complaint investigation and resolution tracking.
- **Trust Profile:**
  - Public explainable metrics: Verification badge, tenure, completed order count, review count & average rating, resolved complaint count.
  - Mandatory disclaimer on all trust profile views.
- **Subscriptions (Mock):**
  - Admin-managed subscription plans and seller tier assignments (Free, Standard, Premium).
  - Server-side enforcement of listing capacity limits.
- **Quality & Security:**
  - Automated unit and integration tests covering positive and negative authorization cases.
  - Structured logging without credential or PII leaks.
  - Complete OpenAPI/Swagger documentation.

### P1 --- Deferred Features (Post-MVP)

- Myanmar mobile phone number registration with SMS OTP (SMSPoh / telecom gateway).
- Product-level granular reviews and ratings.
- Automated payment provider integration (KBZPay, WavePay) for subscription billing.
- Notifications (in-app and email/SMS alerts).
- Burmese/English semantic vector search (pgvector).
- Trust-weighted search ranking algorithms.

### P2 --- Long-Term Vision

- Native mobile applications (Flutter/Dart).
- Authorized cross-platform catalog syncing.
- Advanced fraud-risk detection and seller analytics.

---

## 8. Functional requirements

### FR-01 Authentication
Users register and authenticate using Email and Password. Passwords hashed using ASP.NET Core Identity. Public registration assigns the `Buyer` role only. Account enumeration is mitigated with uniform error messages.

### FR-02 Authorization
Permissions are enforced server-side on every protected endpoint. Suspended accounts are blocked from mutating state. Resource ownership is verified for products, orders, and store profiles. Admin routes require explicit administrator credentials.

### FR-03 Seller onboarding & Verification
Authenticated buyers can submit a seller application with private evidence files. Admins can inspect documents, request information, approve, or reject. All admin inspections are logged in `AuditEvents`.

### FR-04 Public Store Profile
Approved sellers manage a distinct public `SellerProfile` (`StoreName`, `Bio`, `ContactPhone`, `CityOrTownship`, `LogoStorageKey`). Editing `StoreName` flags the store as `PendingReverification`.

### FR-05 Product catalog
Approved sellers can create, edit, publish, and archive listings up to their subscription tier listing limit. Listings snapshot condition, price in MMK, category, and images.

### FR-06 Discovery
Visitors and buyers can browse published listings with keyword search, category filtering, and bounded pagination. Search results do not imply product guarantees.

### FR-07 Orders (Non-Custodial)
Buyers place orders capturing a snapshot of product details and delivery instructions. State machine transitions are server-validated. Sellers dispatch orders (`Shipped`). Only buyers can confirm receipt (`Completed`). No automated completion timeouts.

### FR-08 Reviews
Only the verified buyer of an order in `Completed` status can submit a review. Exactly one review allowed per order. Evaluates transaction experience with the seller.

### FR-09 Complaints & Dispute Adjudication
Order participants can submit complaints with evidence. Admins investigate, record findings, and can resolve delivery disputes where courier delivery proof is confirmed.

### FR-10 Trust profile
Public endpoint exposes explainable counts: verification date, completed orders, review aggregate, and resolved complaints. Every view includes a transparency disclaimer.

### FR-11 Subscription status
Plans and entitlements are defined. Sellers are assigned subscription tiers administratively. Tier limits (e.g. active listing capacity) are enforced server-side.

---

## 9. Requires Team Approval

The following items are unresolved and require human/team sign-off:

1. **Frontend Deployment Topology:** Decision between detached SPA (requiring JWT Access + Refresh Token cookies) vs. unified reverse proxy (requiring standard HttpOnly Cookies).
2. **Evidence Retention & Purge Timeline:** Proposal to delete rejected evidence after 30 days and closed-account evidence after 90 days.
3. **Target Staging Host for .NET 10:** Verification of container/runtime support on the team's chosen hosting provider.
4. **Email Confirmation in Local Pilot:** Confirmation whether `RequireConfirmedEmail` should be bypassed for local demos.
5. **Subscription Tier Listing Quotas:** Confirmation of listing limits (Free: 10, Standard: 30, Premium: 100).
