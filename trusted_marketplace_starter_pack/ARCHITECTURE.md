# Trusted Marketplace --- Technical Architecture

**Version:** 0.3  
**Status:** Aligned with `DECISIONS.md`  
**Target:** C# / ASP.NET Core on .NET 10  

---

## 1. Technical stack baseline

- **Runtime & Language:** C# 13 on **.NET 10** (`net10.0`), utilizing installed SDK `10.0.401`.
- **Backend Framework:** ASP.NET Core Web API.
- **ORM & Database:** Entity Framework Core with **PostgreSQL**.
- **Identity & Membership:** ASP.NET Core Identity with EF Core stores.
- **API Documentation:** OpenAPI / Swagger (`Swashbuckle` or Microsoft OpenAPI).
- **Testing:** xUnit, FluentAssertions, Moq, and ASP.NET Core `WebApplicationFactory` with integration tests.
- **File Storage:** Abstracted `IFileStorageService` (Local disk storage outside web root for development; S3-compatible private bucket for staging/production).
- **Logging:** Structured Serilog logging writing JSON without sensitive tokens, passwords, or PII.

---

## 2. Architecture style: Modular Monolith

A single deployable backend organized into strict domain modules and architectural layers. Avoids premature microservice or distributed message broker complexity while enforcing rigorous internal boundaries.

### Solution Layout:

```text
TrustedMarketplace/
├── src/
│   ├── TrustedMarketplace.Domain/              # Zero-dependency domain model
│   │   ├── Common/ (BaseEntity, IAggregateRoot, Result)
│   │   ├── Identity/ (User, AccountStatus, RoleConstants)
│   │   ├── Verification/ (SellerApplication, VerificationEvidence, VerificationStatus)
│   │   ├── Stores/ (SellerProfile, StoreVerificationStatus)
│   │   ├── Catalog/ (Product, Category, ProductImage, ProductStatus)
│   │   ├── Orders/ (Order, OrderItem, OrderStatus, OrderStatusHistory)
│   │   ├── Reviews/ (Review, ModerationStatus)
│   │   ├── Complaints/ (Complaint, ComplaintEvidence, ComplaintStatus)
│   │   ├── Trust/ (SellerTrustSnapshot, TrustRuleDefinitions)
│   │   └── Subscriptions/ (SubscriptionPlan, SellerSubscription)
│   │
│   ├── TrustedMarketplace.Application/          # Use cases, interfaces, DTOs
│   │   ├── Common/ (Interfaces, Exceptions, Pagination)
│   │   ├── Identity/ (IAuthService, DTOs, CurrentUserContext)
│   │   ├── Verification/ (IVerificationService, DTOs)
│   │   ├── Stores/ (IStoreService, DTOs)
│   │   ├── Catalog/ (IProductService, ICategoryService, DTOs)
│   │   ├── Orders/ (IOrderService, DTOs)
│   │   ├── Reviews/ (IReviewService, DTOs)
│   │   ├── Complaints/ (IComplaintService, DTOs)
│   │   ├── Trust/ (ITrustCalculator, DTOs)
│   │   └── Subscriptions/ (ISubscriptionService, DTOs)
│   │
│   ├── TrustedMarketplace.Infrastructure/       # EF Core, Storage, Identity
│   │   ├── Persistence/
│   │   │   ├── AppDbContext.cs
│   │   │   ├── Configurations/ (Fluent API per module)
│   │   │   └── Migrations/
│   │   ├── Identity/ (ApplicationUser, PasswordHasher, TokenService)
│   │   ├── Storage/ (LocalFileStorageService / S3PrivateStorageService)
│   │   ├── Auditing/ (AuditTrailInterceptor, AuditLogger)
│   │   └── Clock/ (SystemClock : IClock)
│   │
│   └── TrustedMarketplace.Api/                  # Host, routing, and HTTP pipeline
│       ├── Controllers/ (Auth, SellerApplications, Stores, Products, Orders, Reviews, Complaints, Admin)
│       ├── Middleware/ (ExceptionHandlingMiddleware, CorrelationIdMiddleware)
│       ├── Authorization/ (Policies, Handlers, Requirements)
│       └── Program.cs
│
└── tests/
    ├── TrustedMarketplace.UnitTests/
    └── TrustedMarketplace.IntegrationTests/
```

---

## 3. Module boundaries & interaction rules

1. **Identity & Access:** Account lifecycle, credentials, roles, token/session management.
2. **Seller Verification:** Applications, private evidence management, admin review, and decision history.
3. **Stores (Seller Profiles):** Public store data (`StoreName`, `Bio`, `CityOrTownship`, `ContactPhone`), store-name change re-verification tracking.
4. **Catalog:** Product listings, categories, image attachments, subscription-based listing quota checks.
5. **Orders:** Non-custodial state machine (`Placed` &rarr; `Accepted` &rarr; `Shipped` &rarr; `Completed`/`Cancelled`), delivery snapshots, and admin dispute handling.
6. **Reviews:** Transaction-linked order reviews, ratings, and moderation.
7. **Complaints:** Allegation submission, evidence handling, admin investigation, and dispute resolution.
8. **Trust:** Read-model calculation exposing explainable counts and review averages with mandatory disclaimers.
9. **Subscriptions:** Admin-managed subscription plans and tier assignments (mock entitlements).

*Communication Rule:* Modules communicate in-process via C# service interfaces. Modules must not execute cross-boundary SQL mutations against entities owned by other modules.

---

## 4. Authentication & Client Topology Analysis

### Workspace Inspection Finding:
Inspection of the current workspace confirms that **no frontend repository, build script, or deployment manifest currently exists** in `D:\Project\TrustedMarketplace`.

### Authentication Strategy Trade-offs:
1. **Option A: JWT Bearer Access Token in Memory + HttpOnly Refresh Token Cookie (Recommended Baseline)**
   - *Topology:* Detached Single Page Application (e.g. Next.js / Vite on Vercel/Netlify or `localhost:3000`) communicating with ASP.NET Core API (`localhost:5000` or `api.domain.com`).
   - *Rationale:* Decoupled SPAs encounter strict browser cross-site cookie restrictions unless complex same-parent apex domain setups are configured. In-memory access tokens protect against local-storage XSS theft, while HttpOnly refresh cookies enable secure session extension.
2. **Option B: ASP.NET Core Same-Origin Cookies + CSRF Protection**
   - *Topology:* Server-rendered web application or frontend deployed behind a unified reverse proxy / BFF (e.g. Nginx or Next.js server proxying `/api/*`).
   - *Rationale:* Native, zero-token client management. Requires anti-forgery headers on state-changing requests.

*Working Assumption:* Implement ASP.NET Core Identity with JWT Access Tokens + HttpOnly Refresh Token cookies as the default to support decoupled clients, subject to final team sign-off once the frontend architecture is established.

---

## 5. Non-custodial order architecture

- The platform does not integrate an escrow account, intermediate bank ledger, or digital wallet.
- Payment is executed off-platform directly between buyer and seller (e.g. Cash on Delivery or peer-to-peer mobile wallet transfer).
- The backend validates all order state transitions:
  - `Buyer` places order (`Placed`).
  - `Seller` confirms availability (`Accepted`).
  - `Seller` ships goods with courier note (`Shipped`).
  - `Buyer` confirms receipt of delivery (`Completed`).
  - Exceptional Case: If a buyer does not confirm receipt after courier delivery, the seller may file a dispute. An `Admin` reviews courier waybills and can invoke an audited dispute resolution endpoint to mark the order `Completed`.

---

## 6. Data protection & Evidence storage

- Private verification evidence is never stored in `wwwroot` or public storage buckets.
- File uploads are validated by size (max 5MB), extension, and magic byte file signatures (JPEG, PNG, WebP only; no executable files or SVGs).
- Private evidence is retrieved only via an authorized Admin endpoint (`GET /api/v1/admin/seller-applications/{id}/evidence/{evidenceId}`).
- Every access to verification evidence records an immutable row in `AuditEvents`.
- Uploaded product photos are public and served via separate, unprivileged static file storage.

---

## 7. Requires Team Approval

The following architectural decisions are unresolved and require team sign-off:

1. **Frontend Client Topology:** Confirmation whether the frontend will be a decoupled SPA (confirming Option A: JWT + Refresh Cookie) or a reverse-proxied app (confirming Option B: Cookies).
2. **Evidence Retention & Purging Schedule:** Proposal to delete rejected application files after 30 days and closed account files after 90 days.
3. **Staging / Production Host Compatibility:** Verification that the target hosting platform supports Docker containers with the .NET 10 runtime (`mcr.microsoft.com/dotnet/aspnet:10.0`).
4. **Email Confirmation in Development:** Whether to bypass email verification links for the student demo.
