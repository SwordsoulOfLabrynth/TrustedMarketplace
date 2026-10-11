# Trusted Marketplace --- Project Starter Pack

This documentation pack provides the canonical specifications and architectural roadmap for the **Trusted Marketplace** pilot project (DEEP Finalist).

---

## 1. Documentation Index

1. **`DECISIONS.md`** --- **Canonical Single Source of Truth** for architectural, domain, and scope decisions.
2. **`MASTER_PRD.md`** --- Product vision, non-goals, functional requirements, and MVP scope.
3. **`ARCHITECTURE.md`** --- Modular monolith technical architecture, .NET 10 stack, and storage models.
4. **`DATABASE_DESIGN.md`** --- PostgreSQL logical data model, entities, snapshots, and relationships.
5. **`API_CONTRACT.md`** --- REST API specifications, DTO schemas, and status codes.
6. **`AA_SPEC.md`** --- Authentication, authorization policies, session lifecycle, and security tests.
7. **`TASK_PLAN.md`** --- Linear task breakdown with explicit dependencies and acceptance criteria.
8. **`AI_PROMPTS.md`** --- Prompt sequences for pair programming with an autonomous coding agent.
9. **`TEAM_WORKFLOW.md`** --- Git branching, PR review checklist, and definition of done.

---

## 2. Core Project Principles for Phase 1 MVP

- **Non-Custodial:** No escrow, digital wallet, or holding of customer funds.
- **Explainable Trust:** No single opaque composite score. Transparent counts (completed orders, verified reviews, resolved complaints) with clear disclaimers.
- **Buyer Delivery Confirmation:** Order completion requires explicit buyer confirmation (`POST /orders/{id}/confirm-delivery`). Sellers cannot complete orders unilaterally.
- **Separation of Concerns:** Account identity (`Users`), seller verification (`SellerApplications`), public store profiles (`SellerProfiles`), and mock subscriptions (`SellerSubscriptions`) are maintained in separate entities.
- **Private Evidence Protection:** Identity documents (NRC cards) are stored outside the web root with access restricted strictly to authorized administrators with audit logging.
- **Mock Subscriptions:** No live payment gateway integration; subscriptions are administered via mock tier quotas.

---

## 3. Recommended Workflow

1. **Review Sign-Off:** Review the "Requires Team Approval" section below.
2. **Foundation Setup:** Proceed to Prompt 2 in `AI_PROMPTS.md` to establish the .NET 10 solution scaffold (`T-02`, `T-03`, `T-04`).
3. **Incremental Implementation:** Execute tasks strictly according to the dependencies in `TASK_PLAN.md`. Run automated unit and integration tests at each step.

---

## 4. Requires Team Approval

The following items are unresolved and require team sign-off:

1. **Frontend Client Topology:** Confirmation of whether the frontend will be a decoupled SPA (confirming JWT Access + Refresh Cookies) or deployed behind a unified reverse proxy/BFF (confirming Same-Site Cookies).
2. **Evidence Retention & Purge Timeline:** Formal approval of the proposed document retention policy (30 days for rejected applications, 90 days post-closure for approved accounts).
3. **Target Staging Host for .NET 10:** Verification of container/runtime support on the team's chosen hosting provider.
4. **Email Confirmation in Development/Demo:** Confirmation whether email verification links should be bypassed for local demos (`RequireConfirmedEmail = false`).
5. **Subscription Tier Listing Limits:** Confirmation of listing tier quotas (Free: 10, Standard: 30, Premium: 100).
