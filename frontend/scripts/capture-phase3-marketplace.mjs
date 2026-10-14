import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\Kyaw Zay Ya Hein\\.gemini\\antigravity\\brain\\d5165e98-300f-4220-9ef7-96cb3678cc2b";
const SCREENSHOTS_DIR = "D:\\Project\\TrustedMarketplace\\screenshots";

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function getBuyerToken() {
  const res = await fetch("http://localhost:5248/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "buyer@trustedmarketplace.local", password: "BuyerDemo123!" }),
  });
  const data = await res.json();
  return data.accessToken;
}

async function getLatestOrderId(buyerToken) {
  const res = await fetch("http://localhost:5248/api/v1/buyer/orders", {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  const orders = await res.json();
  const orderWithRealPhoto = orders.find(o => o.items && o.items.some(i => i.productId === "70f90e96-76d5-4bad-b01c-d513f1bc6230"));
  const orderWithImage = orders.find(o => o.items && o.items.some(i => Boolean(i.primaryImageUrl)));
  return orderWithRealPhoto ? orderWithRealPhoto.id : (orderWithImage ? orderWithImage.id : orders[0]?.id);
}

async function capture() {
  const buyerToken = await getBuyerToken();
  const targetOrderId = await getLatestOrderId(buyerToken);
  console.log(`Buyer token obtained. Target order ID for detail: ${targetOrderId}`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  async function takePair(name, url, options = {}) {
    console.log(`\nNavigating to ${url}...`);

    // Desktop: 1280x900
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle2" });
    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: 15000 }).catch(() => {
        console.log(`[WARN] Selector ${options.waitFor} timed out on desktop, taking screenshot anyway`);
      });
    }
    await new Promise((r) => setTimeout(r, options.delay || 1500));

    const deskPath = path.join(SCREENSHOTS_DIR, `${name}-desktop.png`);
    await page.screenshot({ path: deskPath, fullPage: false });
    console.log(`Saved: ${deskPath}`);
    const deskArtifact = path.join(ARTIFACT_DIR, `${name}-desktop.png`);
    fs.copyFileSync(deskPath, deskArtifact);

    // Mobile: 390x844
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.reload({ waitUntil: "networkidle2" });
    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: 15000 }).catch(() => {
        console.log(`[WARN] Selector ${options.waitFor} timed out on mobile, taking screenshot anyway`);
      });
    }
    await new Promise((r) => setTimeout(r, options.delay || 1500));

    const mobPath = path.join(SCREENSHOTS_DIR, `${name}-mobile.png`);
    await page.screenshot({ path: mobPath, fullPage: false });
    console.log(`Saved: ${mobPath}`);
    const mobArtifact = path.join(ARTIFACT_DIR, `${name}-mobile.png`);
    fs.copyFileSync(mobPath, mobArtifact);
  }

  try {
    // 1. Establish session in browser via UI login form (ensures HttpOnly refresh cookie is set in browser jar)
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle2" });

    await page.waitForSelector("input#email", { timeout: 10000 });
    await page.type("input#email", "buyer@trustedmarketplace.local");
    await page.type("input#password", "BuyerDemo123!");

    await new Promise((r) => setTimeout(r, 200));
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    console.log(`Buyer session initialized via login form submission. Current URL: ${page.url()}`);

    // 2. Homepage (Curated product cards leading with genuine photos & dignified craft placeholders)
    await takePair("phase3-home", "http://localhost:3000", { waitFor: "article" });

    // 3. Product Catalog (/products)
    await takePair("phase3-catalog", "http://localhost:3000/products", { waitFor: "article" });

    // 4. Product Detail with Real Photography Gallery (/products/[id])
    const photoProductId = "70f90e96-76d5-4bad-b01c-d513f1bc6230"; // Bagan Traditional Lacquerware Bowl
    await takePair("phase3-product-detail-with-photos", `http://localhost:3000/products/${photoProductId}`, { waitFor: "h1" });

    // 5. Product Detail with Photography Pending Placeholder
    const placeholderProductId = "30ba9ce8-7b38-4203-9fa2-71bb937a7a30"; // Handcrafted Teak Marionette (no photos uploaded)
    await takePair("phase3-product-detail-placeholder", `http://localhost:3000/products/${placeholderProductId}`, { waitFor: "h1" });

    // 6. Seller Storefront (/sellers/[id])
    const sellerId = "1f0100ea-410c-4c47-b053-e9c273f17cff"; // Daw Khin / Mandalay Marionettes & Crafts
    await takePair("phase3-seller-storefront", `http://localhost:3000/sellers/${sellerId}`, { waitFor: "article" });

    // 7. Buyer Orders Hub (/orders)
    await takePair("phase3-orders-list", "http://localhost:3000/orders", { waitFor: "h1" });

    // 8. Order Detail with Line Item Photography (/orders/[id])
    if (targetOrderId) {
      await takePair("phase3-order-detail", `http://localhost:3000/orders/${targetOrderId}`, { waitFor: "h1" });
    }
  } finally {
    await browser.close();
    console.log("\n🎉 Phase 3 marketplace screenshot capture complete!");
  }
}

capture().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
