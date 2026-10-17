# MatchGuard (formerly TrustedMarketplace) — Free Deployment Guide

**Stack**: Neon (PostgreSQL) → Render (ASP.NET Core API) → Vercel (Next.js)  
**Cost**: \$0 — no credit card required for any of the three platforms.

---

## Architecture

```
Browser → Vercel (Next.js :3000) → Render (ASP.NET Core API :8080) → Neon (PostgreSQL)
```

---

## Step 1 — Neon (Database)

1. Go to [neon.tech](https://neon.tech) → **Sign up** → **Create Project**
2. Name it `trusted-marketplace`, region closest to you
3. Copy the **Connection String** (looks like):
   ```
   postgresql://user:pass@ep-xxx-yyy.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Open the **SQL Editor** and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```

---

## Step 2 — Run Migrations (from your local machine)

Set the Neon connection string and apply EF Core migrations:

```powershell
# Windows PowerShell
$env:ConnectionStrings__DefaultConnection = "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"

dotnet ef database update `
  --project src/TrustedMarketplace.Infrastructure `
  --startup-project src/TrustedMarketplace.Api
```

---

## Step 3 — Render (API)

1. Go to [render.com](https://render.com) → **Sign up** → **New → Web Service**
2. Connect your GitHub repo
3. Render auto-detects `render.yaml` → click **Apply**
4. In the Render dashboard, go to **Environment** and verify/add these variables:

   | Key | Value | Notes |
   |-----|-------|-------|
   | `ConnectionStrings__DefaultConnection` | *(Neon URL from Step 1)* | Secret: full postgresql connection string |
   | `Jwt__Key` | *(random 32+ char secret)* | Secret: generate with PowerShell command below |
   | `CORS_ALLOWED_ORIGINS` | `https://trusted-marketplace.vercel.app` | Required for browser cross-origin requests |
   | `Jwt__RefreshTokenCookieSameSite` | `None` | Required for cross-site HttpOnly refresh cookies |

   Generate a JWT secret:
   ```powershell
   [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
   ```

5. Click **Deploy** — wait ~5 min for Docker build
6. Note the exact service URL provided by Render (e.g., `https://trustedmarketplace-hyr9.onrender.com` or `https://trusted-marketplace-api.onrender.com`).
   Verify it returns 200 OK:
   ```powershell
   curl -i "https://<your-render-service>.onrender.com/api/v1/health"
   ```

> ⚠️ Free tier sleeps after 15 min of inactivity. First cold start = ~30s delay.
> ⚠️ If you see `404 Not Found` with `x-render-routing: no-server`, check Render deployment logs: the container either crashed (e.g. missing `Jwt__Key` / database connection) or the service is suspended.

---

## Step 4 — Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → **Sign up** → **New Project**
2. Import your GitHub repo
3. Set **Root Directory** → `frontend`
4. Add **Environment Variable**:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://<your-render-service>.onrender.com` (exact URL from Render, without trailing slash) |

5. Click **Deploy** — done in ~2 min
6. Your frontend will be live at: `https://trusted-marketplace.vercel.app`

---

## Step 5 — Verify CORS & Cross-Site Authentication

1. Verify preflight OPTIONS response:
   ```powershell
   curl -i -X OPTIONS "https://<your-render-service>.onrender.com/api/v1/categories" `
     -H "Origin: https://trusted-marketplace.vercel.app" `
     -H "Access-Control-Request-Method: GET"
   ```
   Must return `204 No Content` (or `200 OK`) with:
   - `Access-Control-Allow-Origin: https://trusted-marketplace.vercel.app`
   - `Access-Control-Allow-Credentials: true`

2. Open `https://trusted-marketplace.vercel.app` in your browser and verify in DevTools Network tab that:
   - `/api/v1/categories` returns 200 OK
   - `/api/v1/products?pageSize=6` returns 200 OK
   - `/api/v1/auth/refresh` responds with 401 Unauthorized (when not logged in) with correct CORS headers and no CORS errors.

---

## CI — GitHub Actions

The file `.github/workflows/ci.yml` automatically:
- Runs all tests against a real PostgreSQL container
- Builds the Next.js frontend

Triggers on every push or PR to `main`.

---

## Checklist

- [ ] Neon project created, extensions enabled (`vector`, `pg_trgm`)
- [ ] EF Core migrations applied to Neon
- [ ] Render service deployed with `ConnectionStrings__DefaultConnection` & `Jwt__Key`
- [ ] `CORS_ALLOWED_ORIGINS` set to `https://trusted-marketplace.vercel.app`
- [ ] `Jwt__RefreshTokenCookieSameSite` set to `None`
- [ ] Vercel project deployed with matching `NEXT_PUBLIC_API_URL`
- [ ] CI passing on GitHub Actions
