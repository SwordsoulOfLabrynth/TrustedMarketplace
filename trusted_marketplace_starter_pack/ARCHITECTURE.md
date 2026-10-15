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
9. **Subscriptions:** Platform QR payment submissions (KBZPay, WavePay), duplicate reference guard, admin payment verification queue, and dynamic listing quota elevation.
10. **Multilingual Search:** Pluggable `IEmbeddingProvider` abstraction coordinating upstream inference (`NvidiaEmbeddingProvider` for NVIDIA NIM) with zero-dependency in-process failover (`LocalConceptHashEmbeddingProvider` with 10 bilingual craft clusters + DJB2 n-gram projection). Serves hybrid cosine similarity + BM25-style lexical ranking with word boundary protection.

*Communication Rule:* Modules communicate in-process via C# service interfaces. Modules must not execute cross-boundary SQL mutations against entities owned by other modules.

---

## 4. Authentication & Client Topology

### Production Topology Baseline:
- **Frontend Client:** Next.js 15 (React 19) in `/frontend` with static prerendering, server actions, and standalone Node.js runtime.
- **Authentication:** ASP.NET Core Identity with PBKDF2 HMAC-SHA512 hashing, issuing 15-minute JWT Bearer access tokens held in memory, and single-use rotating 7-day refresh tokens set in `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
- **Reverse Proxy Architecture:** When deployed on a single host or VPS, a reverse proxy (Caddy / Nginx) routes `/api/*` to the ASP.NET Core container (`:8080`) and all other routes to Next.js (`:3000`), ensuring apex-domain cookie sharing without cross-origin third-party cookie blocking.

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

## 7. Containerization & Production Deployment

- **ASP.NET Core API Container:** Multi-stage `src/TrustedMarketplace.Api/Dockerfile` using `mcr.microsoft.com/dotnet/aspnet:10.0` running as non-root `app` user with native health check.
- **Next.js Frontend Container:** Multi-stage `frontend/Dockerfile` using `node:20-alpine` leveraging `output: "standalone"` running as non-root `nextjs` user.
- **Orchestration:** `docker-compose.prod.yml` defines the multi-container stack (`postgres`, `api`, `frontend`) with named volumes for database persistence (`postgres_data`), private evidence (`evidence_storage`), and public media (`media_storage`).
- **Secret Management:** Production secrets are injected exclusively through environment variables (`.env.production`).

---

## 8. Requires Team Approval

1. **Production Hosting Target Selection:** Decision on deploying to a single Linux VPS (Hetzner / DigitalOcean with Docker Compose or Coolify) vs managed cloud PaaS (Railway / Render).
2. **NVIDIA API Commercial Plan:** Deciding whether to subscribe to a paid NVIDIA NIM inference tier or rely on the local concept-hash projection engine.
3. **Domain Name & DNS:** Purchasing and pointing domain (e.g., `trustedmarketplace.mm`) to host IP address.
