# TrustedMarketplace — Free Deployment Guide

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
4. In the Render dashboard, go to **Environment** and add these **secret** variables:

   | Key | Value |
   |-----|-------|
   | `ConnectionStrings__DefaultConnection` | *(Neon URL from Step 1)* |
   | `Jwt__Key` | *(random 32+ char string — generate below)* |

   Generate a JWT secret:
   ```powershell
   [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
   ```

5. Click **Deploy** — wait ~5 min for Docker build
6. Your API will be live at: `https://trusted-marketplace-api.onrender.com`

> ⚠️ Free tier sleeps after 15 min of inactivity. First cold start = ~30s delay.

---

## Step 4 — Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → **Sign up** → **New Project**
2. Import your GitHub repo
3. Set **Root Directory** → `frontend`
4. Add **Environment Variable**:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://trusted-marketplace-api.onrender.com` |

5. Click **Deploy** — done in ~2 min
6. Your frontend will be live at: `https://trusted-marketplace.vercel.app`

---

## Step 5 — Update CORS on API

After Vercel gives you the final URL, set it in Render's Environment variables:

| Key | Value |
|-----|-------|
| `Cors__AllowedOrigins__0` | `https://trusted-marketplace.vercel.app` |

Then redeploy the API service on Render.

---

## CI — GitHub Actions

The file `.github/workflows/ci.yml` automatically:
- Runs all 204 tests (117 unit + 87 integration) against a real PostgreSQL container
- Builds the Next.js frontend

Triggers on every push or PR to `main`.

---

## Checklist

- [ ] Neon project created, extensions enabled
- [ ] EF Core migrations applied to Neon
- [ ] Render service deployed, secret env vars set
- [ ] Vercel project deployed with `NEXT_PUBLIC_API_URL`
- [ ] CORS updated on Render with Vercel domain
- [ ] CI passing on GitHub Actions
