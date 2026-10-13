# Trusted Marketplace (Phase 1 MVP)

> **Backend Web API** for the **Trusted Marketplace** platform — a trust-first e-commerce system built for the Myanmar market pilot.  
> Implemented in **C# 13** on **.NET 10** (`net10.0`) as a **Modular Monolith** with **ASP.NET Core**, **Entity Framework Core**, and **PostgreSQL**.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Beginner's Guide to the Tech Stack](#2-beginners-guide-to-the-tech-stack)
3. [Prerequisites & Environment Verification](#3-prerequisites--environment-verification)
4. [Project Structure & Architecture](#4-project-structure--architecture)
5. [Setup & Quickstart Guide](#5-setup--quickstart-guide)
6. [Database Setup & EF Core Migrations](#6-database-setup--ef-core-migrations)
7. [API Documentation (Implemented Endpoints)](#7-api-documentation-implemented-endpoints)
8. [Authentication Lifecycle & Token Rotation](#8-authentication-lifecycle--token-rotation)
9. [Authorization Policies & Role Model](#9-authorization-policies--role-model)
10. [Testing & Troubleshooting](#10-testing--troubleshooting)
11. [Configuration & Secrets Security](#11-configuration--secrets-security)
12. [Team Contribution & Architectural Rules](#12-team-contribution--architectural-rules)
13. [Roadmap Status & Next Tasks](#13-roadmap-status--next-tasks)

---

## 1. Project Overview

### What is Trusted Marketplace?
In Southeast Asian social-commerce and informal e-commerce markets, fraud, non-delivery, and account spoofing are widespread. Traditional platforms attempt to solve this using escrow (holding customer money), which creates high banking integration hurdles and regulatory compliance overhead.

**Trusted Marketplace** provides an alternative **non-custodial** marketplace model:
- **Zero Platform Custody**: The platform coordinates transactions and tracks deliveries but **never holds buyer funds or runs an in-app wallet**.
- **Verified Seller Identity**: Sellers submit National Registration Card (NRC) credentials and business proofs that admins inspect and verify. Documents are stored privately outside the web root.
- **Transaction-Linked Reviews**: Only verified buyers of successfully delivered orders can submit a review, and strictly at most one review per completed order.
- **Transparent Trust Metrics**: No black-box composite ratings. Profiles show clear counts: verified tenure, completed orders, verified review average, and resolved complaints.
- **Server-Enforced Order State Machine**: The seller cannot unilaterally mark an order as completed; delivery confirmation requires explicit buyer receipt.

### What is Currently Implemented vs. Planned
- **Completed (All Backend MVP Phases — Tasks T-01 through T-18):**
  - **T-01 to T-07 (Auth & Foundation):** .NET 10 Modular Monolith, PostgreSQL EF Core persistence, RFC 7807 ProblemDetails, Serilog structured logging, ASP.NET Core Identity, JWT + rotating refresh token cookies, account suspension enforcement (`RequireActiveUser`, `RequireAdmin`).
  - **T-08 & T-09 (Seller Verification & Evidence Storage):** Seller application workflow, private evidence storage with magic-byte validation, admin review with immutable audit trails.
  - **T-10 (Store Profiles & Re-Verification):** Public and seller store endpoints, automatic slug generation, re-verification trigger on store name modifications (`SEC-04`).
  - **T-11 & T-12 (Product Catalog & Search):** Product CRUD, multi-image support, category hierarchy, draft/published/archived lifecycle, multi-filter keyword catalog search with price bounds.
  - **T-17 (Subscriptions & Listing Limits):** Admin-managed mock subscriptions (Free, Standard, Premium) and real-time listing quota enforcement on product creation.
  - **T-13 (Non-Custodial Order State Machine):** Server-enforced order lifecycle (`Placed` &rarr; `Accepted` &rarr; `Shipped` &rarr; `Completed`), IDOR protection (`SEC-06`), and buyer-only delivery confirmation (`SEC-07`, `SEC-08`).
  - **T-14 (Transaction-Linked Reviews):** Verified reviews linked strictly to completed orders, database unique constraint enforcing 1 review per transaction (`SEC-09`, `SEC-10`, `SEC-11`).
  - **T-15 (Complaints & Dispute Resolution):** Order participant complaint filing, transition to `Disputed`, admin resolution decisions, and dispute settlement with audit logging.
  - **T-16 (Explainable Trust Metrics Read Model):** Public explainable trust profiles with verified badge, tenure, completed orders count, review count, average rating, and standard disclaimer.
  - **T-18 (End-to-End Suite & Security Verification):** 152 automated tests (84 Unit Tests, 68 Integration Tests) passing with 0 failures, zero package vulnerabilities, and full coverage of security rules `SEC-01` through `SEC-13`.
- **Deferred to Post-MVP (Phase 7):**
  - D-01: SMS OTP gateway integration.
  - D-02: Automated mobile wallet payment gateways (KBZPay, WavePay).
  - D-03: Granular product-level reviews.
  - D-04: Burmese semantic vector search (`pgvector`).
  - D-05: Trust-weighted search ranking algorithms.
  - D-06: Flutter mobile application frontend.

---

## 2. Beginner's Guide to the Tech Stack

If you are coming from JavaScript/TypeScript, Python, or Java and have never used C# or .NET before, here is a quick overview of how the pieces fit together:

| Technology | What It Is | Analogy in Other Ecosystems |
| :--- | :--- | :--- |
| **C#** | A strongly typed, compiled object-oriented programming language designed for type safety and performance. | TypeScript or Java |
| **.NET (v10)** | The cross-platform runtime, compiler, and standard library that executes C# applications on Windows, Linux, and macOS. | Node.js runtime or JVM |
| **ASP.NET Core** | The web application framework built into .NET for building REST APIs, controllers, and middleware. | Express / Fastify / Spring Boot / FastAPI |
| **NuGet** | The package manager for .NET libraries. Dependencies are specified in XML `.csproj` project files. | `npm` (Node.js) or `pip` (Python) |
| **Entity Framework Core (EF Core)** | An Object-Relational Mapper (ORM) that maps C# classes to database tables and translates LINQ queries into SQL. | Prisma (Node), Hibernate (Java), SQLAlchemy (Python) |
| **PostgreSQL** | The production-grade relational database storing our users, tokens, and audit events. | PostgreSQL |
| **JWT (JSON Web Token)** | A digitally signed token (HMAC-SHA256) sent by the frontend in the `Authorization: Bearer <token>` header to authenticate API requests. | JWT standard |
| **Dependency Injection (DI)** | A built-in container where you register services (like database contexts or token generators) so classes automatically receive them via their constructors. | Spring DI or NestJS Providers |

---

## 3. Prerequisites & Environment Verification

Before running the project, verify that the required tools are installed on your machine.

### Required Software
1. **.NET 10 SDK** (Version `10.0.401` or compatible `10.0.x`).
2. **PostgreSQL 16+** (Either via Docker Desktop or a locally installed PostgreSQL service).
3. **PowerShell** (Windows) or **Bash** (Linux/macOS).

### Verify Your Local Environment
Run these commands in your terminal:

```powershell
# 1. Check .NET SDK version (must output 10.0.xxx)
dotnet --version

# 2. Check installed .NET SDKs
dotnet --list-sdks

# 3. Check Docker (if using Docker for PostgreSQL)
docker --version
docker compose version

# 4. Check PostgreSQL client (if using local PostgreSQL service)
psql --version
```

> **Note:** If `dotnet --version` returns an error or a version lower than `10.0.100`, download and install the **.NET 10 SDK** from [dotnet.microsoft.com](https://dotnet.microsoft.com/download).

---

## 4. Project Structure & Architecture

The backend is structured as a **Modular Monolith** using Clean Architecture layer boundaries:

```text
TrustedMarketplace/
├── src/
│   ├── TrustedMarketplace.Domain/          # Core entities, enums, value objects (ZERO external packages)
│   │   ├── Common/                         # BaseEntity, AuditableEntity, DomainException
│   │   └── Identity/                       # AccountStatus (Active/Suspended/Closed), RoleConstants
│   │
│   ├── TrustedMarketplace.Application/     # Use cases, interfaces, DTOs (References Domain only)
│   │   ├── Common/                         # IAppDbContext, IAuthService, ITokenService, Exceptions
│   │   └── Identity/Dtos/                  # RegisterRequest, LoginRequest, AuthResponse, UserDto
│   │
│   ├── TrustedMarketplace.Infrastructure/  # EF Core, Identity, PostgreSQL, Security (References Application & Domain)
│   │   ├── Identity/                       # ApplicationUser, ApplicationRole, RefreshToken, AuthService, TokenService
│   │   ├── Persistence/                    # AppDbContext, Entity Configurations, Interceptors
│   │   │   └── Migrations/                 # EF Core SQL migrations
│   │   └── DependencyInjection.cs          # Service registrations for database, identity, and JWT
│   │
│   └── TrustedMarketplace.Api/             # Web API host, Controllers, HTTP Pipeline (References Application & Infrastructure)
│       ├── Controllers/                    # AuthController, AdminController, HealthController
│       ├── Authorization/                  # Policies (RequireActiveUser, RequireAdmin), Handlers, RFC 7807 error formatters
│       ├── Middleware/                     # GlobalExceptionHandler, CorrelationIdMiddleware
│       ├── appsettings.json                # Base configuration & production defaults
│       ├── appsettings.Development.json    # Local development overrides (e.g., email verification bypass)
│       └── Program.cs                      # Application startup, CORS, middleware pipeline
│
├── tests/
│   ├── TrustedMarketplace.UnitTests/       # Fast, in-memory unit tests (xUnit)
│   └── TrustedMarketplace.IntegrationTests/# End-to-end API tests with real database (WebApplicationFactory)
│
├── trusted_marketplace_starter_pack/       # Canonical specifications, PRD, API contract, decision log
├── docker-compose.yml                      # Local PostgreSQL container definition
├── dotnet-tools.json                       # Pins the local dotnet-ef CLI migration tool
└── TrustedMarketplace.slnx                 # Solution file
```

### Dependency Rules:
- **Domain** has **zero** package dependencies. It never references EF Core, ASP.NET Core, or other projects.
- **Application** references only **Domain**.
- **Infrastructure** implements interfaces defined in Application.
- **Api** configures dependency injection and routes HTTP requests.
- **Circular dependencies are strictly forbidden.**

---

## 5. Setup & Quickstart Guide

Follow these steps to clone, configure, build, and run the project:

### Step 1: Restore Local Tools and Packages
```powershell
# Restore the local EF Core tool pinned in dotnet-tools.json
dotnet tool restore

# Restore all NuGet packages for the solution
dotnet restore
```

### Step 2: Build the Solution
```powershell
dotnet build
```
You should see `Build succeeded. 0 Warning(s) 0 Error(s)`.

### Step 3: Start the Database & Apply Migrations
*(See [Section 6](#6-database-setup--ef-core-migrations) for full details)*
```powershell
# If using Docker:
docker compose up -d

# Apply database migrations
dotnet ef database update --project src/TrustedMarketplace.Infrastructure --startup-project src/TrustedMarketplace.Api
```

### Step 4: Run the API
```powershell
dotnet run --project src/TrustedMarketplace.Api
```

By default, the API starts listening on:
- **HTTPS:** `https://localhost:7058`
- **HTTP:** `http://localhost:5248`

### Step 5: Verify the Server is Running
Open a browser or run in PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:5248/api/v1/health" -Method Get
```
Expected response:
```json
{
  "status": "Healthy",
  "timestampUtc": "2026-10-12T00:30:00.0000000Z",
  "version": "0.1.0"
}
```

---

## 6. Database Setup & EF Core Migrations

### Option A: Running PostgreSQL via Docker (Recommended)
The repository includes a ready-to-use `docker-compose.yml` configured for local development:
```powershell
# Start the PostgreSQL container in the background
docker compose up -d

# Check container status
docker compose ps
```
Default local Docker database parameters:
- **Host:** `127.0.0.1`
- **Port:** `5432`
- **Database:** `trusted_marketplace_dev`
- **Username:** `postgres`
- **Password:** `postgres_dev_password`

### Option B: Running Local Native PostgreSQL
If you already run PostgreSQL natively on your machine, create the database:
```sql
CREATE DATABASE trusted_marketplace_dev;
```
If your local password differs, configure a secret override without changing tracked git files:
```powershell
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=127.0.0.1;Port=5432;Database=trusted_marketplace_dev;Username=postgres;Password=<your_local_password>" --project src/TrustedMarketplace.Api
```

### Applying Migrations to the Database
To create tables and schema in your PostgreSQL database:
```powershell
dotnet ef database update --project src/TrustedMarketplace.Infrastructure --startup-project src/TrustedMarketplace.Api
```

### Adding New Migrations (When Modifying Entities)
When you add or modify entities in `Infrastructure`:
```powershell
dotnet ef migrations add <DescriptiveMigrationName> --project src/TrustedMarketplace.Infrastructure --startup-project src/TrustedMarketplace.Api --output-dir Persistence/Migrations
```

### Verifying No Model Changes are Pending
To verify that your C# code and database migrations are in sync:
```powershell
dotnet ef migrations has-pending-model-changes --project src/TrustedMarketplace.Infrastructure --startup-project src/TrustedMarketplace.Api
```
*(Should return: `No changes have been made to the model since the last migration.`)*

---

## 7. API Documentation (Implemented Endpoints)

The backend implements exactly **seven (7)** endpoints across Health, Authentication, and Administration. All endpoints follow REST principles, accept and return JSON, and use the base path `/api/v1`.

*(Note: An internal test controller, `TestErrorsController` at `/api/v1/test-errors/*`, is used exclusively by automated integration tests for RFC 7807 error-pipeline verification; it is hidden from OpenAPI documentation and automatically returns 404 in non-Development environments).*


### 1. Health Check
- **Endpoint:** `GET /api/v1/health`
- **Access:** Public / Anonymous
- **Response:** `200 OK`
```json
{
  "status": "Healthy",
  "timestampUtc": "2026-10-12T00:00:00Z",
  "version": "0.1.0"
}
```

---

### 2. Register Account
- **Endpoint:** `POST /api/v1/auth/register`
- **Access:** Public / Anonymous
- **Description:** Creates a new buyer account. The server strictly assigns the `Buyer` role. Client attempts to supply `Admin` or `Seller` are ignored (`SEC-01`).
- **Request Body:**
```json
{
  "displayName": "Aung Ko",
  "email": "aungko@example.com",
  "password": "SecurePassword123!"
}
```
> **Password Rules:** Minimum 8 characters, at least 1 digit, at least 1 lowercase letter, at least 1 uppercase letter.
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
- **Error Responses:**
  - `400 Bad Request` (`VALIDATION_ERROR`): Missing fields, invalid email format, or weak password.
  - `409 Conflict` (`STATE_CONFLICT`): Email is already registered.

---

### 3. Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Access:** Public / Anonymous
- **Description:** Authenticates with email and password. Returns a short-lived access JWT in the JSON body and sets a cryptographically random refresh token in an `HttpOnly` cookie.
- **Request Body:**
```json
{
  "email": "aungko@example.com",
  "password": "SecurePassword123!"
}
```
- **Response:** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
- **Response Cookie:**
  `Set-Cookie: refreshToken=<token>; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Expires=...`
- **Error Responses:**
  - `401 Unauthorized` (`INVALID_CREDENTIALS`): Uniform error returned for both incorrect password and non-existent email to prevent user enumeration (`SEC-13`).
  - `403 Forbidden` (`ACCOUNT_SUSPENDED`): Account is suspended by administration.

---

### 4. Refresh Token (Token Rotation)
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Access:** Public / Anonymous (Requires `refreshToken` cookie)
- **Description:** Consumes the existing refresh token, issues a new JWT access token, and issues a newly rotated refresh token cookie.
- **Request Body:** None (reads cookie).
- **Response:** `200 OK` (Same format as Login response with updated token and refreshed cookie).
- **Error Responses:**
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or expired cookie.
  - `401 Unauthorized` (`TOKEN_REUSE_DETECTED`): If an attacker or client replays an already-used refresh token, the server immediately revokes all tokens in that family.

---

### 5. Logout
- **Endpoint:** `POST /api/v1/auth/logout`
- **Access:** Public or Authenticated (Reads `refreshToken` cookie)
- **Description:** Revokes the refresh token family on the server and clears the `refreshToken` cookie.
- **Response:** `204 No Content`

---

### 6. Current User Profile
- **Endpoint:** `GET /api/v1/auth/me`
- **Access:** Authenticated (`Authorization: Bearer <accessToken>`)
- **Policy:** `RequireActiveUser` (Blocks suspended or closed accounts even if they hold a valid JWT).
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
- **Error Responses:**
  - `401 Unauthorized`: Missing or invalid token.
  - `403 Forbidden` (`ACCOUNT_SUSPENDED`): Account suspended in real time (`SEC-03`).

---

### 7. Seller Applications & Verification Workflow (T-08, T-09)
- `POST /api/v1/seller-applications`: Authenticated active user submits application with proposed store name, business type, and contact phone.
- `GET /api/v1/seller-applications/my`: Retrieves caller's application status and submitted evidence list.
- `POST /api/v1/seller-applications/{id}/evidence`: Uploads private NRC/business license evidence (multipart form). Enforces magic-byte file signature validation (`SEC-12`).
- `GET /api/v1/admin/seller-applications`: Admin reviews paginated queue of pending/processed seller applications.
- `GET /api/v1/admin/seller-applications/{id}`: Admin inspects application details and evidence records.
- `POST /api/v1/admin/seller-applications/{id}/decision`: Admin approves or rejects application with mandatory audit reason. Automatically provisions a `Verified` store profile on approval.
- `GET /api/v1/admin/seller-applications/{id}/evidence/{evidenceId}`: Secure streamed download of private evidence files with strict admin access control (`SEC-12`).

---

### 8. Store Profiles & Reverification (T-10)
- `GET /api/v1/sellers/{sellerId}/store`: Public endpoint returning store profile, bio, contact phone, city/township, and verification status.
- `GET /api/v1/seller/store`: Authenticated seller retrieves their own store profile.
- `PUT /api/v1/seller/store`: Seller updates profile. If `storeName` is modified, status automatically reverts to `PendingReverification` to prevent brand spoofing (`SEC-04`).

---

### 9. Product Catalog & Search (T-11, T-12)
- `GET /api/v1/categories`: Public listing of available product categories.
- `GET /api/v1/products`: Public listing search with `keyword`, `categoryId`, `minPrice`, `maxPrice`, `page`, and `pageSize`. Hides draft and archived products.
- `GET /api/v1/products/{id}`: Public product details. Allows draft/archived views only by the listing owner.
- `POST /api/v1/seller/products`: Approved seller creates draft listing. Rejects unapproved sellers (`SEC-04`) and enforces subscription listing quotas (`T-17`).
- `GET /api/v1/seller/products`: Seller retrieves all own listings across Draft, Published, and Archived statuses.
- `PATCH /api/v1/seller/products/{id}`: Seller updates product title, description, price, condition, or category. Enforces resource ownership (`SEC-05`).
- `POST /api/v1/seller/products/{id}/publish`: Seller publishes a draft listing.
- `POST /api/v1/seller/products/{id}/archive`: Seller archives an active listing.

---

### 10. Subscription Plans & Entitlements (T-17)
- `GET /api/v1/subscription-plans`: Publicly returns available tiers (`Free`, `Standard`, `Premium`) and listing limits (10, 30, 100).
- `GET /api/v1/seller/subscription`: Authenticated seller inspects current active subscription, tier, expiration, and remaining listing capacity.
- `POST /api/v1/admin/sellers/{sellerId}/subscription`: Admin assigns subscription tier and validity period.

---

### 11. Non-Custodial Order State Machine (T-13)
- `POST /api/v1/orders`: Buyer places an order on a published product, capturing address and phone snapshot (`Placed`).
- `GET /api/v1/orders/{id}`: Retrieves order details and status timeline. IDOR protected: accessible only by buyer, seller, or admin (`SEC-06`).
- `GET /api/v1/buyer/orders`: Authenticated buyer lists own placed orders.
- `GET /api/v1/seller/orders`: Authenticated seller lists incoming orders.
- `POST /api/v1/orders/{id}/accept`: Seller transitions order from `Placed` &rarr; `Accepted`.
- `POST /api/v1/orders/{id}/ship`: Seller dispatches order with optional courier waybill tracking reference (`Accepted` &rarr; `Shipped`).
- `POST /api/v1/orders/{id}/confirm-delivery`: **Buyer of the order only.** Transitions `Shipped` &rarr; `Completed`. Enforces `SEC-07` and `SEC-08`.
- `POST /api/v1/orders/{id}/cancel`: Cancellation with reason (Buyer if `Placed`, Seller before `Shipped`).
- `POST /api/v1/admin/orders/{id}/resolve-dispute`: Admin resolves disputed order to `Completed` or `Cancelled` with mandatory audit trail.

---

### 12. Reviews & Complaints (T-14, T-15)
- `POST /api/v1/orders/{orderId}/reviews`: Buyer submits rating (1-5) and comment on a `Completed` order. Enforces `SEC-09` (completed only), `SEC-10` (max 1 review per order), and `SEC-11` (buyer only).
- `GET /api/v1/sellers/{sellerId}/reviews`: Public paginated reviews for a seller.
- `POST /api/v1/orders/{orderId}/complaints`: Buyer or seller files complaint, transitioning order status to `Disputed`.
- `GET /api/v1/complaints/{id}`: Participant or admin retrieves complaint details.
- `GET /api/v1/admin/complaints`: Admin lists all complaints.
- `POST /api/v1/admin/complaints/{id}/decision`: Admin records resolution code (`RefundAgreed`, `GoodsDeliveredConfirmed`, `WarningIssued`, `Unfounded`) and summary with audit trail.

---

### 13. Explainable Trust Metrics Read Model (T-16)
- `GET /api/v1/sellers/{sellerId}/trust-profile`: Public explainable trust profile:
  - `verificationStatus`: "Verified" or "PendingReverification"
  - `verifiedSinceUtc`: Verification timestamp
  - `completedOrdersCount`: Verified database count of completed orders
  - `reviewCount`: Verified count of published reviews
  - `averageRating`: Decimal rating average (rounded to 1 decimal place)
  - `resolvedComplaintsCount`: Count of resolved complaints
  - `disclaimer`: Mandatory consumer protection disclaimer.

---

### Standard Error Response Format (RFC 7807)
All errors are returned with `Content-Type: application/problem+json`:
```json
{
  "type": "about:blank",
  "title": "Invalid Credentials",
  "status": 401,
  "detail": "Invalid email or password.",
  "instance": "/api/v1/auth/login",
  "code": "INVALID_CREDENTIALS",
  "traceId": "0HN1234567890",
  "timestampUtc": "2026-10-12T00:30:00.0000000Z"
}
```

---

## 8. Authentication Lifecycle & Token Rotation

```text
 Client (Browser / App)                             Trusted Marketplace API
        │                                                     │
        │ 1. POST /auth/register                              │
        ├────────────────────────────────────────────────────>│ -> Creates User (Role=Buyer, Status=Active)
        │<────────────────────────────────────────────────────┤    Returns 201 Created
        │                                                     │
        │ 2. POST /auth/login { email, password }             │
        ├────────────────────────────────────────────────────>│ -> Validates password hash
        │<────────────────────────────────────────────────────┤    Issues JWT (body) + Refresh Token (HttpOnly Cookie)
        │                                                     │
        │ 3. GET /auth/me (Header: Bearer <JWT>)              │
        ├────────────────────────────────────────────────────>│ -> Live DB Check: AccountStatus == Active?
        │<────────────────────────────────────────────────────┤    Returns 200 OK User Profile
        │                                                     │
        │ 4. (After 15 mins) POST /auth/refresh               │
        │    (Cookie: refreshToken=T1)                        │
        ├────────────────────────────────────────────────────>│ -> Hashes T1 with SHA-256
        │                                                     │ -> Marks T1 used, creates T2 (Same FamilyId)
        │<────────────────────────────────────────────────────┤    Returns fresh JWT + Cookie: refreshToken=T2
        │                                                     │
        │ * ATTACKER REPLAYS T1:                              │
        │   POST /auth/refresh (Cookie: refreshToken=T1)      │
        ├────────────────────────────────────────────────────>│ -> T1 is already consumed!
        │                                                     │ -> Revokes ALL tokens in FamilyId!
        │<────────────────────────────────────────────────────┤    Returns 401 TOKEN_REUSE_DETECTED
        │                                                     │
        │ 5. POST /auth/logout                                │
        ├────────────────────────────────────────────────────>│ -> Revokes token family & clears cookie
        │<────────────────────────────────────────────────────┤    Returns 204 No Content
```

### Key Security Invariants:
1. **Access Tokens in Memory:** JWT access tokens expire in **15 minutes** and are kept in frontend memory (never written to `localStorage` or `sessionStorage` where XSS can extract them).
2. **Refresh Tokens in HttpOnly Cookies:** Stored in cookies with `HttpOnly = true`, `Path = /api/v1/auth`, preventing JavaScript access.
3. **Server-Side Token Hashing:** The database **never stores plaintext refresh tokens**. It stores cryptographically secure **SHA-256 hashes** (`refresh_tokens.token_hash`).
4. **Family Tracking & Reuse Detection:** Tokens belong to a `TokenFamily` GUID. Replay of an old token triggers instant cascade revocation of all tokens in that family.

---

## 9. Authorization Policies & Role Model

### The "Seller is NOT an Identity Role" Invariant
In our architecture, the Identity roles are strictly:
- `Buyer`: Standard registered user.
- `Admin`: System administrator.

> **CRITICAL RULE:** There is **NO `Seller` role** in ASP.NET Core Identity.
> 
> A user becomes a seller through an operational capability:
> 1. A `Buyer` submits a `SellerApplication` (T-08).
> 2. An `Admin` verifies their NRC documents and approves the application (T-09).
> 3. An approved seller manages a `SellerProfile` (T-10).
> 
> Permissions to create products or manage store profiles are validated by checking whether the user owns an **approved, active store**, NOT by role membership.

### Implemented Policies
1. **`RequireActiveUser`:**
   - Handled by [`ActiveUserAuthorizationHandler`](file:///D:/Project/TrustedMarketplace/src/TrustedMarketplace.Api/Authorization/Handlers/ActiveUserAuthorizationHandler.cs).
   - Queries `AppDbContext.Users` in real time.
   - If an account is marked `AccountStatus.Suspended` or `AccountStatus.Closed`, the request is immediately rejected with `403 Forbidden` (`ACCOUNT_SUSPENDED` or `ACCOUNT_CLOSED`), **even if the user holds an unexpired JWT**.
2. **`RequireAdmin`:**
   - Enforces `RoleConstants.Admin` membership plus active account status.
   - Rejects non-admin users with RFC 7807 `403 Forbidden` (`INSUFFICIENT_PERMISSIONS`).
3. **`ResourceOwnerRequirement`:**
   - Implemented in [`ResourceOwnerAuthorizationHandler`](file:///D:/Project/TrustedMarketplace/src/TrustedMarketplace.Api/Authorization/Handlers/ResourceOwnerAuthorizationHandler.cs).
   - Verifies that the authenticated user matches `IResourceOwner.OwnerUserId` or possesses the `Admin` role.

---

## 10. Testing & Troubleshooting

### Running the Test Suite
```powershell
# Run all tests across the entire solution
dotnet test

# Run only unit tests
dotnet test tests/TrustedMarketplace.UnitTests

# Run only integration tests (requires PostgreSQL running)
dotnet test tests/TrustedMarketplace.IntegrationTests
```

### Checking for Known Package Vulnerabilities
```powershell
dotnet list package --vulnerable
```

### Common Setup Issues & Solutions

| Error Message / Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `Cannot connect to 127.0.0.1:5432` | PostgreSQL container or service is not running. | Run `docker compose up -d` or start your local PostgreSQL service. |
| `Password authentication failed for user "postgres"` | Database password does not match `appsettings.json`. | Check `docker-compose.yml` password (`postgres_dev_password`) or configure via `dotnet user-secrets`. |
| `No executable found matching command "dotnet-ef"` | The local .NET tool manifest has not been restored. | Run `dotnet tool restore`. |
| `401 Unauthorized` on `/api/v1/auth/refresh` | The browser or test client did not include the `refreshToken` cookie. | In frontend code (e.g. `fetch` or `axios`), ensure `credentials: 'include'` / `withCredentials: true` is enabled. |
| `403 Forbidden` (`ACCOUNT_SUSPENDED`) | The account was marked `Suspended` in the database. | The account cannot access protected endpoints until an admin sets `account_status = 0` (`Active`). |
| Port conflict on `5432` | Another PostgreSQL instance is already running on port 5432. | Stop the conflicting local instance or change the host port in `docker-compose.yml` (e.g., `"5433:5432"`). |

---

## 11. Configuration & Secrets Security

### Configuration Hierarchy in ASP.NET Core
Settings are loaded in this exact order (later sources override earlier ones):
1. `src/TrustedMarketplace.Api/appsettings.json` (Base configuration, production defaults).
2. `src/TrustedMarketplace.Api/appsettings.Development.json` (Applied only when `ASPNETCORE_ENVIRONMENT = Development`).
3. `src/TrustedMarketplace.Api/appsettings.Local.json` (Optional machine-specific file, ignored by Git).
4. Environment variables (e.g., `ConnectionStrings__DefaultConnection`).
5. .NET User Secrets (Development only).

### Email Confirmation in Development vs. Production
- **In Development:** `appsettings.Development.json` sets `"RequireConfirmedEmail": false`, allowing instant login upon registration for rapid local testing.
- **In Production:** `appsettings.json` sets `"RequireConfirmedEmail": true`. ASP.NET Core only loads `appsettings.Development.json` when `ASPNETCORE_ENVIRONMENT` is explicitly set to `Development`. The bypass **cannot accidentally apply to production**.

### JWT Signing Key Validation in Development vs. Production
- **In Development:** If `Jwt:Key` is not configured, the application falls back to `DependencyInjection.DevelopmentFallbackSecret` for zero-friction local developer onboarding.
- **In Staging & Production:** Startup validation strictly enforces that `Jwt:Key` must be present, at least 32 characters (256 bits), and **cannot be the development placeholder**. Attempting to boot in a non-Development environment with the placeholder key will fail fast on startup with `InvalidOperationException`.
- **RequireHttpsMetadata:** Configured as `!isDevelopment`. Self-issued symmetric JWTs do not use an external authority discovery document, but if an external OpenID Connect authority is ever configured in staging/production, HTTPS metadata retrieval is strictly required.

### Secrets Rules (Never Commit Real Secrets)
- Never commit live database passwords, real JWT signing keys, or cloud storage keys to Git.
- `.gitignore` is pre-configured to ignore:
  - `storage/`, `uploads/`, `private_evidence/`
  - `.env`, `secrets.json`, `appsettings.Local.json`, `*.local.json`
  - `bin/`, `obj/`, `logs/`, `.vs/`, `.idea/`, `.vscode/`
- For production deployments, inject credentials using **Environment Variables**:
  - `ConnectionStrings__DefaultConnection`
  - `Jwt__Key` (must be at least 32 characters)

---

## 12. Team Contribution & Architectural Rules

Before implementing any task, teammates must follow this workflow:

1. **Read the Specifications First:**
   - [`trusted_marketplace_starter_pack/DECISIONS.md`](file:///D:/Project/TrustedMarketplace/trusted_marketplace_starter_pack/DECISIONS.md) — The binding architectural decisions.
   - [`trusted_marketplace_starter_pack/TASK_PLAN.md`](file:///D:/Project/TrustedMarketplace/trusted_marketplace_starter_pack/TASK_PLAN.md) — Find your task ID and exact acceptance criteria.
   - [`trusted_marketplace_starter_pack/AA_SPEC.md`](file:///D:/Project/TrustedMarketplace/trusted_marketplace_starter_pack/AA_SPEC.md) — Check applicable security test IDs (`SEC-01` through `SEC-13`).
   - [`trusted_marketplace_starter_pack/API_CONTRACT.md`](file:///D:/Project/TrustedMarketplace/trusted_marketplace_starter_pack/API_CONTRACT.md) — Match exact route naming, HTTP verbs, and DTO schemas.
2. **Follow Layer Boundaries:**
   - Never add database references or NuGet packages to `TrustedMarketplace.Domain`.
   - Never put business logic in API Controllers; delegate to Application services.
   - Return RFC 7807 `ProblemDetails` for errors.
3. **Verify Locally Before Submitting:**
   ```powershell
   dotnet build
   dotnet test
   dotnet ef migrations has-pending-model-changes --project src/TrustedMarketplace.Infrastructure --startup-project src/TrustedMarketplace.Api
   dotnet list package --vulnerable
   ```
4. **Git Etiquette:**
   - Always run `git status` before committing to ensure no unintended files or secrets are staged.
   - Never use `git push --force` on shared branches.

---

## 13. Roadmap Status & Verification Summary

| Phase | Task ID | Name | Status |
| :---: | :---: | :--- | :---: |
| **0** | **T-01** | Approve Project Decisions and Specifications | **Done** |
| **1** | **T-02** | Solution Scaffold & Modular Monolith Setup | **Done** |
| **1** | **T-03** | Persistence & Initial EF Core Migrations | **Done** |
| **1** | **T-04** | Global Error Handling (RFC 7807) & Structured Logging | **Done** |
| **2** | **T-05** | Account Model & ASP.NET Core Identity Foundation | **Done** |
| **2** | **T-06** | Registration & Login API (JWT + Rotating Refresh Tokens) | **Done** |
| **2** | **T-07** | Authorization Policies & Account Status Handlers | **Done** |
| **3** | **T-08** | Seller Applications & Secure NRC Evidence Storage | **Done** |
| **3** | **T-09** | Admin Verification Workflow & Audit Trail | **Done** |
| **3** | **T-10** | Store Profiles & Re-Verification Trigger | **Done** |
| **4** | **T-11** | Categories & Product Catalog CRUD | **Done** |
| **4** | **T-12** | Public Catalog Browsing & Search | **Done** |
| **5** | **T-13** | Non-Custodial Order State Machine | **Done** |
| **5** | **T-14** | Transaction-Linked Reviews | **Done** |
| **5** | **T-15** | Complaints & Admin Dispute Resolution | **Done** |
| **5** | **T-16** | Explainable Trust Metrics Read Model | **Done** |
| **6** | **T-17** | Admin-Managed Mock Subscriptions | **Done** |
| **6** | **T-18** | End-to-End Test Suite & Demo Verification | **Done** |

**Current Backend Status:** **100% Complete (152/152 Tests Passing, 0 Vulnerabilities, Model-Migration Parity Verified)**. Ready for team frontend integration and staging demo.
