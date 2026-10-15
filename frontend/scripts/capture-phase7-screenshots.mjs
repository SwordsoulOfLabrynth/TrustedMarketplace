import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\Kyaw Zay Ya Hein\\.gemini\\antigravity\\brain\\d5165e98-300f-4220-9ef7-96cb3678cc2b";
const SCREENSHOTS_DIR = "D:\\Project\\TrustedMarketplace\\screenshots";

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function loginViaUI(page, email, password) {
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.press("Backspace");
    await emailInput.type(email, { delay: 20 });
  }

  const pwdInput = await page.$('input[type="password"]');
  if (pwdInput) {
    await pwdInput.click({ clickCount: 3 });
    await pwdInput.press("Backspace");
    await pwdInput.type(password, { delay: 20 });
  }

  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  }

  await new Promise((r) => setTimeout(r, 3000));
}

async function capture() {
  console.log("=== Capturing Phase 7 Verification Screenshots ===");

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,960"],
    defaultViewport: { width: 1280, height: 960, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  // 1. Admin Store Re-verifications Queue
  console.log("Logging into Admin via UI...");
  await loginViaUI(page, "admin@trustedmarketplace.local", "AdminDemo123!");

  console.log("Navigating to /admin...");
  await page.goto("http://localhost:3000/admin", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000));

  // Click on "Store Re-verifications" tab
  const tabs = await page.$$("button");
  for (const tab of tabs) {
    const text = await page.evaluate((el) => el.textContent, tab);
    if (text && text.includes("Store Re-verifications")) {
      await tab.click();
      console.log("Clicked Store Re-verifications tab!");
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 3000));

  const adminShotPath = path.join(SCREENSHOTS_DIR, "phase7-admin-reverifications.png");
  const adminArtifactPath = path.join(ARTIFACT_DIR, "phase7-admin-reverifications.png");
  await page.screenshot({ path: adminShotPath, fullPage: false });
  fs.copyFileSync(adminShotPath, adminArtifactPath);
  console.log("Saved screenshot: phase7-admin-reverifications.png");

  // 2. Seller Subscription Sandbox Payment QR Display
  console.log("\nLogging into Seller via UI for subscription QR display...");
  await loginViaUI(page, "artisan.seller@trustedmarketplace.local", "SellerDemo123!");

  console.log("Navigating to /seller/subscription...");
  await page.goto("http://localhost:3000/seller/subscription", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000));

  // Scroll down to payment details
  await page.evaluate(() => window.scrollBy(0, 750));
  await new Promise((r) => setTimeout(r, 1500));

  const subShotPath = path.join(SCREENSHOTS_DIR, "phase7-subscription-sandbox-qr.png");
  const subArtifactPath = path.join(ARTIFACT_DIR, "phase7-subscription-sandbox-qr.png");
  await page.screenshot({ path: subShotPath, fullPage: false });
  fs.copyFileSync(subShotPath, subArtifactPath);
  console.log("Saved screenshot: phase7-subscription-sandbox-qr.png");

  // 3. Seller Store Profile View
  console.log("\nNavigating to /seller/store...");
  await page.goto("http://localhost:3000/seller/store", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000));

  const storeShotPath = path.join(SCREENSHOTS_DIR, "phase7-seller-store-profile.png");
  const storeArtifactPath = path.join(ARTIFACT_DIR, "phase7-seller-store-profile.png");
  await page.screenshot({ path: storeShotPath, fullPage: false });
  fs.copyFileSync(storeShotPath, storeArtifactPath);
  console.log("Saved screenshot: phase7-seller-store-profile.png");

  await browser.close();
  console.log("\n🎉 All Phase 7 UI screenshots captured and saved successfully!");
}

capture().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
