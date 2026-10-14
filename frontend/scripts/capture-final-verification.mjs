import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\Kyaw Zay Ya Hein\\.gemini\\antigravity\\brain\\d5165e98-300f-4220-9ef7-96cb3678cc2b";
const SCREENSHOTS_DIR = "D:\\Project\\TrustedMarketplace\\screenshots";

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function getAdminToken() {
  const res = await fetch("http://localhost:5248/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@trustedmarketplace.local",
      password: "AdminDemo123!",
    }),
  });
  const data = await res.json();
  return data.accessToken;
}

async function getSellerTokenAndProduct() {
  const res = await fetch("http://localhost:5248/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "artisan.seller@trustedmarketplace.local",
      password: "SellerDemo123!",
    }),
  });
  const data = await res.json();
  const token = data.accessToken;

  const prodsRes = await fetch("http://localhost:5248/api/v1/seller/products", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const prods = await prodsRes.json();
  return { token, product: prods[0] };
}

async function capture() {
  console.log("Fetching tokens...");
  const adminToken = await getAdminToken();
  const { token: sellerToken, product: sellerProd } = await getSellerTokenAndProduct();

  console.log("Launching headless Edge browser...");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  async function take(name, url, token, setupFn) {
    console.log(`Navigating to ${url}...`);
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

    await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle2" });
    if (token) {
      await page.evaluate((tok) => {
        sessionStorage.setItem("tm_access_token", tok);
      }, token);
    } else {
      await page.evaluate(() => {
        sessionStorage.removeItem("tm_access_token");
      });
    }

    await page.goto(url, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1200));

    if (setupFn) {
      await setupFn(page);
      await new Promise((r) => setTimeout(r, 800));
    }

    const deskPath = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: deskPath, fullPage: false });
    console.log(`Saved: ${deskPath}`);
    const deskArtifact = path.join(ARTIFACT_DIR, `${name}.png`);
    fs.copyFileSync(deskPath, deskArtifact);
  }

  // 1. Seller Product Edit with Price 85,000 MMK
  if (sellerProd) {
    await take("final-seller-edit-price", `http://localhost:3000/seller/products/${sellerProd.id}/edit`, sellerToken, async (p) => {
      // Type 85000 in price input and verify no step mismatch error
      const priceInput = await p.$('#edit-price');
      if (priceInput) {
        await priceInput.click({ clickCount: 3 });
        await priceInput.type('85000');
      }
    });
  }

  // 2. Admin Dashboard
  await take("final-admin-dashboard", "http://localhost:3000/admin", adminToken);

  // 3. Login Page
  await take("final-login-page", "http://localhost:3000/auth/login", null);

  // 4. Products Catalog
  await take("final-catalog-photography", "http://localhost:3000/products", null);

  await browser.close();
  console.log("All final verification screenshots captured successfully!");
}

capture().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
