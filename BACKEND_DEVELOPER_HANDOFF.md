# TrustedMarketplace — Backend Developer Handoff Guide

> **Target Audience**: Backend Engineers / C# .NET Developers  
> **Repository**: `D:\Project\TrustedMarketplace`  
> **Platform & Runtime**: .NET 10 (C# 13) | ASP.NET Core Web API  
> **Persistence**: PostgreSQL 16 (`pgvector` + `pg_trgm`) | Entity Framework Core 10  
> **API Docs**: Swagger UI (`/swagger`) | Scalar Reference (`/scalar/v1`) | OpenAPI Spec (`/openapi/v1.json`)  
> **Default Local Port**: `http://localhost:5248` (HTTPS optional on `7181`)

---

## 1. Quick Start & Local Runbook

### Prerequisites
1. **.NET 10 SDK** (`dotnet --version` >= 10.0.100)
2. **PostgreSQL 16** with `pgvector` and `pg_trgm` extensions enabled.
3. EF Core CLI tools: `dotnet tool install --global dotnet-ef` (if not already installed).

### Configuration (`appsettings.Development.json`)
The application is pre-configured for local development. Default connection string:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=trusted_marketplace_dev;Username=postgres;Password=postgres"
  },
  "Jwt": {
    "Key": "PLACEHOLDER_DEV_SECRET_KEY_MIN_32_CHARS_DO_NOT_USE_IN_PROD",
    "Issuer": "TrustedMarketplace",
    "Audience": "TrustedMarketplaceClient",
    "AccessTokenExpirationMinutes": 15,
    "RefreshTokenExpirationDays": 7
  },
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:5173"
    ]
  }
}
```

### Essential CLI Commands

```powershell
# 1. Restore NuGet dependencies
dotnet restore

# 2. Apply EF Core database migrations
dotnet ef database update --project src/TrustedMarketplace.Infrastructure --startup-project src/TrustedMarketplace.Api

# 3. Run the Web API backend
dotnet run --project src/TrustedMarketplace.Api

# 4. Run full test suite (204 tests: 117 Unit + 87 Integration)
dotnet test
```

### Pre-Seeded Development Accounts
When running in `Development` mode, `DemoDataSeeder.cs` automatically seeds three pre-configured accounts:

| Role | Email | Password | Pre-configured State |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@trustedmarketplace.local` | `AdminDemo123!` | System Administrator, Full Audit/Verification Rights |
| **Seller** | `artisan.seller@trustedmarketplace.local` | `SellerDemo123!` | Approved Store (`Bagan Heritage Crafts`), Standard Tier |
| **Buyer** | `buyer@trustedmarketplace.local` | `BuyerDemo123!` | Active Buyer account |

---

## 2. Architecture & Project Layout

The codebase follows the **Clean Architecture / Modular Monolith** pattern:

```
D:\Project\TrustedMarketplace\
├── src\
│   ├── TrustedMarketplace.Domain\         # Pure domain entities, value objects, domain enums (Zero dependencies)
│   ├── TrustedMarketplace.Application\    # Service interfaces, DTOs, CQRS contracts, business exceptions
│   ├── TrustedMarketplace.Infrastructure\ # EF Core AppDbContext, ASP.NET Identity, Serilog, PostgreSQL, Search
│   └── TrustedMarketplace.Api\            # Controllers, Middlewares, Auth policies, ProblemDetails, OpenAPI
└── tests\
    ├── TrustedMarketplace.UnitTests\        # Isolated domain logic and service unit tests (117 tests)
    └── TrustedMarketplace.IntegrationTests\ # WebApplicationFactory & in-memory/Postgres tests (87 tests)
```

### Key Dependencies & NuGets
- `Microsoft.AspNetCore.Identity.EntityFrameworkCore` (10.0)
- `Microsoft.AspNetCore.Authentication.JwtBearer` (10.0)
- `Npgsql.EntityFrameworkCore.PostgreSQL` (9.0 / 10.0 preview)
- `Pgvector.EntityFrameworkCore`
- `Serilog.AspNetCore` (Structured JSON logging)
- `Scalar.AspNetCore` + `Microsoft.AspNetCore.OpenApi` (OpenAPI v3 generation)

---

## 3. Authentication & Security Architecture

### Architectural Overview: Dual-Token Pattern
To balance low latency with robust security:
1. **Access Token (JWT)**:
   - Lifespan: **15 minutes** (`Jwt:AccessTokenExpirationMinutes: 15`).
   - Delivered in response body: `{ "accessToken": "...", "expiresInSeconds": 900, "user": { ... } }`.
   - Handled **in-memory only** on the client (never saved in `localStorage`).
   - Transmitted via `Authorization: Bearer <accessToken>` header.
2. **Refresh Token**:
   - Lifespan: **7 days** (`Jwt:RefreshTokenExpirationDays: 7`).
   - Delivered via **`HttpOnly`**, **`SameSite=Lax`**, **`Secure`** (in production) cookie named `refreshToken`.
   - Inaccessible to client-side JavaScript (mitigating XSS theft).
   - Stored in PostgreSQL table `RefreshTokens` as a cryptographic SHA-256 hash (`TokenHash`).
3. **Token Rotation & Token-Family Theft Detection**:
   - Every call to `POST /api/v1/auth/refresh` immediately revokes the presenting refresh token and issues a brand-new token pair.
   - If an already-revoked refresh token is ever presented again (indicating that an attacker captured an in-flight token), the system triggers **theft detection**: every active token in that `TokenFamily` is revoked immediately, forcing re-authentication across all sessions.

---

### How to Implement Authentication in ASP.NET Core (Code Reference)

#### 1. Identity & Token Service Registration (`DependencyInjection.cs`)
```csharp
// Register ASP.NET Core Identity Core
services.AddIdentityCore<ApplicationUser>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequiredLength = 8;
    options.User.RequireUniqueEmail = true;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
})
.AddRoles<ApplicationRole>()
.AddEntityFrameworkStores<AppDbContext>();

// Register JWT Bearer
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = true,
            ValidIssuer = configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = configuration["Jwt:Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
```

#### 2. Generating Access Token Claims (`TokenService.cs`)
```csharp
var claims = new List<Claim>
{
    new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
    new(ClaimTypes.NameIdentifier, user.Id.ToString()),
    new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
    new(ClaimTypes.Email, user.Email ?? string.Empty),
    new(ClaimTypes.Name, user.DisplayName),
    new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
};

foreach (var role in roles)
{
    claims.Add(new Claim(ClaimTypes.Role, role));
}

var tokenDescriptor = new SecurityTokenDescriptor
{
    Subject = new ClaimsIdentity(claims),
    Expires = DateTime.UtcNow.AddMinutes(expirationMinutes),
    Issuer = issuer,
    Audience = audience,
    SigningCredentials = new SigningCredentials(
        new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        SecurityAlgorithms.HmacSha256)
};

var tokenHandler = new JwtSecurityTokenHandler();
return tokenHandler.WriteToken(tokenHandler.CreateToken(tokenDescriptor));
```

#### 3. Setting the HttpOnly Refresh Cookie (`AuthController.cs`)
```csharp
private void SetRefreshTokenCookie(string refreshToken, DateTime expiresAtUtc)
{
    var cookieOptions = new CookieOptions
    {
        HttpOnly = true,
        Secure = !_environment.IsDevelopment(), // Secure=True in staging/production
        SameSite = SameSiteMode.Lax,
        Expires = expiresAtUtc,
        Path = "/api/v1/auth" // Scope cookie strictly to auth routes
    };
    Response.Cookies.Append(RefreshTokenCookieName, refreshToken, cookieOptions);
}
```

#### 4. Authorization Policies & Endpoint Protection
- Standard authenticated user: `[Authorize]`
- Active account verification (blocks suspended accounts): `[Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]`
- Administrative endpoints: `[Authorize(Policy = AuthorizationPolicies.RequireAdmin)]` or `[Authorize(Roles = "Admin")]`

---

## 4. Complete API Endpoint Reference (Swagger Equivalent)

Base Path: `/api/v1`  
All error responses adhere to **RFC 7807 ProblemDetails** (`Content-Type: application/problem+json`).

---

### 4.1 Authentication (`/auth`)

| Method | Endpoint | Auth | Purpose | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Anonymous | Register a new Buyer account (`SEC-01`) | `{ "displayName": "...", "email": "...", "password": "..." }` | `201 Created`: `RegisterResponse` |
| `POST` | `/auth/login` | Anonymous | Login with credentials; returns JWT and sets HttpOnly cookie | `{ "email": "...", "password": "..." }` | `200 OK`: `AuthResponse` |
| `POST` | `/auth/refresh` | Cookie | Rotates refresh token & issues new 15-min JWT | None (reads `refreshToken` cookie) | `200 OK`: `AuthResponse` |
| `POST` | `/auth/logout` | Authenticated | Revokes refresh token & deletes cookie | None | `204 NoContent` |
| `GET` | `/auth/me` | `RequireActiveUser` | Retrieves current authenticated profile | None | `200 OK`: `UserDto` |

---

### 4.2 Seller Onboarding & Verification (`/seller-applications`, `/seller/store`)

| Method | Endpoint | Auth | Purpose | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/seller-applications` | `RequireActiveUser` | Submit application to become a verified seller | `{ "proposedStoreName": "...", "businessType": "...", "contactPhone": "..." }` | `201 Created`: `SellerApplicationDto` |
| `GET` | `/seller-applications/me` | `RequireActiveUser` | Check current seller application status | None | `200 OK`: `SellerApplicationDto` |
| `POST` | `/seller-applications/me/evidence`| `RequireActiveUser` | Upload KYC/NRC document or business license | `multipart/form-data` (`file`, `documentType`) | `201 Created`: `EvidenceDto` |
| `GET` | `/seller/store` | `RequireActiveUser` | Get current seller's store profile | None | `200 OK`: `SellerStoreDto` |
| `PUT` | `/seller/store` | `RequireActiveUser` | Update store profile. **Note: Store name changes trigger `PendingReverification` (`SEC-04`)** | `{ "storeName": "...", "contactPhone": "...", "bio": "...", "city": "..." }` | `200 OK`: `SellerStoreDto` |

---

### 4.3 Public Catalog & Products (`/products`, `/categories`)

| Method | Endpoint | Auth | Purpose | Query Params | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/products` | Anonymous | Search catalog (Multilingual Burmese/English Hybrid Search) | `?q=...&category=...&minPrice=...&maxPrice=...&page=1&pageSize=20` | `200 OK`: `PagedList<ProductSummaryDto>` |
| `GET` | `/products/{id}` | Anonymous | Get full product detail & seller trust badge | Path `id` (Guid) | `200 OK`: `ProductDetailDto` |
| `GET` | `/products/{id}/images` | Anonymous | Get image gallery metadata for product | Path `id` (Guid) | `200 OK`: `List<ProductImageDto>` |
| `GET` | `/products/{id}/images/{imageId}/content` | Anonymous | Serve binary image data | Path `id`, `imageId` | `200 OK`: `image/jpeg` or `image/png` |
| `GET` | `/categories` | Anonymous | List category taxonomy | None | `200 OK`: `List<CategoryDto>` |

---

### 4.4 Seller Product Management (`/seller/products`)

| Method | Endpoint | Auth | Purpose | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/seller/products` | `RequireActiveUser` | List seller's own listings (Draft, Published, Archived) | `?page=1&pageSize=20` | `200 OK`: `PagedList<SellerProductDto>` |
| `POST` | `/seller/products` | `RequireActiveUser` | Create product draft (Checks subscription quota & verification status) | `{ "name": "...", "description": "...", "price": 15000, "categoryId": "...", "stockQuantity": 10 }` | `201 Created`: `SellerProductDto` |
| `PATCH`| `/seller/products/{id}` | `RequireActiveUser` | Update product draft or published details | `{ "name": "...", "description": "...", "price": ... }` | `200 OK`: `SellerProductDto` |
| `POST` | `/seller/products/{id}/publish` | `RequireActiveUser` | Publish listing to marketplace (**Blocked if store is `PendingReverification`**) | None | `200 OK`: `SellerProductDto` |
| `POST` | `/seller/products/{id}/archive` | `RequireActiveUser` | Archive listing | None | `200 OK`: `SellerProductDto` |
| `POST` | `/seller/products/{id}/images` | `RequireActiveUser` | Upload image for product listing | `multipart/form-data` (`file`) | `201 Created`: `ProductImageDto` |
| `DELETE`| `/seller/products/{id}/images/{imageId}` | `RequireActiveUser` | Delete listing image | Path `id`, `imageId` | `204 NoContent` |
| `PUT` | `/seller/products/{id}/images/{imageId}/primary` | `RequireActiveUser` | Set as thumbnail/primary photo | Path `id`, `imageId` | `200 OK` |

---

### 4.5 Subscriptions & Payments (`/subscription-plans`, `/seller/subscription`)

| Method | Endpoint | Auth | Purpose | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/subscription-plans` | Anonymous | List Free, Standard, and Premium tier pricing & limits | None | `200 OK`: `List<SubscriptionPlanDto>` |
| `GET` | `/seller/subscription` | `RequireActiveUser` | Get seller's current plan, quota used, and expiry | None | `200 OK`: `SellerSubscriptionDto` |
| `POST` | `/seller/subscription/subscribe` | `RequireActiveUser` | Submit KBZPay/WavePay transaction reference for plan upgrade | `{ "planTier": "Standard", "paymentMethod": "KBZPay", "transactionReference": "TXN987654321" }` | `200 OK`: `SubscriptionPaymentSubmissionDto` |
| `GET` | `/platform/payment-methods` | Anonymous | Get configured KBZPay/WavePay QR assets & receiver details | None | `200 OK`: `PaymentMethodsDto` |

---

### 4.6 Orders & Non-Custodial Delivery (`/orders`)

| Method | Endpoint | Auth | Purpose | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/orders` | `RequireActiveUser` | Buyer places order with items and delivery address | `{ "items": [{ "productId": "...", "quantity": 1 }], "deliveryAddress": "..." }` | `201 Created`: `OrderDto` |
| `GET` | `/orders/{id}` | `RequireActiveUser` | Get order detail (Buyer, Seller, or Admin only) | Path `id` | `200 OK`: `OrderDto` |
| `GET` | `/buyer/orders` | `RequireActiveUser` | List orders placed by the current buyer | `?page=1&pageSize=20` | `200 OK`: `PagedList<OrderDto>` |
| `GET` | `/seller/orders` | `RequireActiveUser` | List orders received by the current seller | `?page=1&pageSize=20` | `200 OK`: `PagedList<OrderDto>` |
| `POST` | `/orders/{id}/accept` | `RequireActiveUser` | Seller accepts order (`Pending` -> `Processing`) | None | `200 OK`: `OrderDto` |
| `POST` | `/orders/{id}/ship` | `RequireActiveUser` | Seller ships order (`Processing` -> `Shipped`) | None | `200 OK`: `OrderDto` |
| `POST` | `/orders/{id}/confirm-delivery` | `RequireActiveUser` | **Buyer confirms receipt (`Shipped` -> `Completed`). Seller cannot call this (`SEC-07`)** | None | `200 OK`: `OrderDto` |
| `POST` | `/orders/{id}/cancel` | `RequireActiveUser` | Cancel order (prior to shipping) | `{ "reason": "..." }` | `200 OK`: `OrderDto` |

---

### 4.7 Reviews & Reputation (`/orders/{orderId}/reviews`, `/sellers/{sellerId}/trust-profile`)

| Method | Endpoint | Auth | Purpose | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/orders/{orderId}/reviews` | `RequireActiveUser` | Buyer writes a verified review for a `Completed` order (`SEC-09/10`) | `{ "rating": 5, "comment": "Excellent quality lacquerware!" }` | `201 Created`: `ReviewDto` |
| `GET` | `/sellers/{sellerId}/reviews` | Anonymous | List reviews and ratings for a seller's products | `?page=1&pageSize=20` | `200 OK`: `PagedList<ReviewDto>` |
| `GET` | `/sellers/{sellerId}/trust-profile` | Anonymous | Get transaction-derived trust score, completed order count, and badges | Path `sellerId` | `200 OK`: `SellerTrustProfileDto` |

---

### 4.8 Disputes & Complaints (`/orders/{orderId}/complaints`, `/complaints`)

| Method | Endpoint | Auth | Purpose | Request Body | Success Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/orders/{orderId}/complaints` | `RequireActiveUser` | Buyer files complaint against an order | `{ "reason": "...", "description": "..." }` | `201 Created`: `ComplaintDto` |
| `GET` | `/complaints/{id}` | `RequireActiveUser` | View dispute details & status | Path `id` | `200 OK`: `ComplaintDto` |
| `GET` | `/admin/complaints` | `Admin` | List all open disputes for admin mediation | `?status=Open&page=1` | `200 OK`: `PagedList<ComplaintDto>` |
| `POST` | `/admin/complaints/{id}/decision` | `Admin` | Admin adjudicates dispute (Upheld / Dismissed) | `{ "decision": "Upheld", "resolutionNotes": "..." }` | `200 OK`: `ComplaintDto` |

---

### 4.9 Admin Back-Office Operations (`/admin/*`)

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/seller-applications` | `RequireAdmin` | List pending KYC seller applications. |
| `GET` | `/admin/seller-applications/{id}/evidence/{evidenceId}` | `RequireAdmin` | Download private NRC / business registration evidence file. |
| `POST`| `/admin/seller-applications/{id}/decision` | `RequireAdmin` | Approve or Reject seller application (`Approve`, `Reject`). |
| `GET` | `/admin/seller-stores` | `RequireAdmin` | List stores requiring re-verification (`PendingReverification`). |
| `POST`| `/admin/sellers/{sellerId}/re-verify` | `RequireAdmin` | Approve store name change; returns store to `Approved` state. |
| `GET` | `/admin/subscriptions` | `RequireAdmin` | List pending KBZPay/WavePay subscription payment submissions. |
| `POST`| `/admin/subscriptions/{id}/verify` | `RequireAdmin` | Approve/Reject payment. On approval, grants plan quota (`SEC-11`). |
| `GET` | `/admin/catalog/search-status` | `RequireAdmin` | View embedding provider health (NVIDIA API / Local Hash) & stats. |
| `POST`| `/admin/catalog/reindex-embeddings` | `RequireAdmin` | Rebuild 384-dimensional vector embeddings for all products. |

---

## 5. Non-Negotiable Domain Invariants ("Rules You Must Not Break")

When extending the backend, ensure your code respects these enforced security invariants:

1. **`SEC-01` Strict Buyer Self-Registration**:
   - `POST /auth/register` creates user accounts with the `Buyer` role only.
   - The `Seller` role is granted **only** after an Admin approves a `SellerApplication`.
   - The `Admin` role is never assignable through public APIs.

2. **`SEC-04` Re-verification Lockout on Store Name Change**:
   - When a seller updates their `StoreName` via `PUT /seller/store`, `SellerStoreService` automatically sets `StoreStatus = PendingReverification`.
   - While `StoreStatus == PendingReverification`, product publishing (`POST /seller/products/{id}/publish`) throws a `ForbiddenException` (HTTP 403).
   - Only calling `POST /admin/sellers/{sellerId}/re-verify` can restore the store to `Approved`.

3. **`SEC-07` Non-Custodial Delivery Gate**:
   - The platform does not hold escrow funds. Buyer pays seller directly.
   - The seller moves orders from `Pending` -> `Processing` -> `Shipped`.
   - **Under no circumstances may a seller mark an order as `Completed`.** Only the buyer calling `POST /orders/{id}/confirm-delivery` can transition the status to `Completed`.

4. **`SEC-09 & SEC-10` Review Uniqueness & Verified Purchase Gate**:
   - A review can **only** be created for an order with `Status == OrderStatus.Completed`.
   - Database unique index `IX_Reviews_OrderId_ReviewerUserId` strictly prevents more than 1 review per transaction.

5. **`SEC-11` Subscription Quota & Payment Verification**:
   - Plan quotas: Free = 10 listings; Standard = 30 listings; Premium = 100 listings.
   - Submitting a KBZPay/WavePay transaction reference **does not** automatically upgrade quotas. It remains `Pending` until an admin verifies it via `POST /admin/subscriptions/{id}/verify`.

6. **`SEC-13` Uniform Error Responses**:
   - Auth failures return a generic `401 Unauthorized` message (`"Invalid email or password"`) to prevent username/email enumeration.

---

## 6. Testing & CI Verification

Run tests from the repository root:

```powershell
# Run all unit tests (Domain & Business logic)
dotnet test tests/TrustedMarketplace.UnitTests

# Run all integration tests (ASP.NET Core WebApplicationFactory + Database)
dotnet test tests/TrustedMarketplace.IntegrationTests

# Run everything with detailed test output
dotnet test --logger "console;verbosity=normal"
```

All **204 tests** (117 unit, 87 integration) should pass without errors or skipped fixtures.
