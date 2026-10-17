import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SCREENSHOT_DIR = "D:\\Project\\TrustedMarketplace\\screenshots\\branding";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log("Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Test static assets
  const assetsToTest = [
    "http://localhost:3000/favicon.ico",
    "http://localhost:3000/favicon.svg",
    "http://localhost:3000/images/branding/matchguard-icon-192.png",
    "http://localhost:3000/images/branding/matchguard-icon-512.png",
    "http://localhost:3000/images/branding/matchguard-logo.svg",
    "http://localhost:3000/images/branding/matchguard-logo-horizontal.svg",
    "http://localhost:3000/site.webmanifest",
  ];

  console.log("\n--- Checking Static Branding Assets ---");
  for (const assetUrl of assetsToTest) {
    const res = await page.goto(assetUrl);
    const status = res.status();
    console.log(`[${status === 200 ? "PASS" : "FAIL"}] ${status} : ${assetUrl}`);
    if (status !== 200) {
      throw new Error(`Asset failed to load: ${assetUrl} (Status ${status})`);
    }
  }

  // Helper to capture desktop & mobile views
  async function testPage(urlPath, name) {
    console.log(`\n--- Testing ${name} (${urlPath}) ---`);

    // Desktop
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:3000${urlPath}`, { waitUntil: "networkidle0" });
    const desktopTitle = await page.title();
    console.log(`Desktop Page Title: "${desktopTitle}"`);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${name}-desktop.png`),
      fullPage: true,
    });

    // Check brand in title or body
    const hasBrandInTitle = desktopTitle.includes("MatchGuard");
    console.log(`Brand In Title: ${hasBrandInTitle ? "YES" : "NO"}`);

    // Mobile
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:3000${urlPath}`, { waitUntil: "networkidle0" });
    
    // Check horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const hasOverflow = scrollWidth > clientWidth;
    console.log(`Mobile scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth} (Overflow: ${hasOverflow ? "YES - FAIL" : "NO - PASS"})`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${name}-mobile.png`),
      fullPage: false,
    });
  }

  await testPage("/", "homepage");
  await testPage("/auth/login", "login");
  await testPage("/auth/register", "register");
  await testPage("/products", "products-catalog");

  await browser.close();
  console.log("\nAll UI checks and screenshots completed successfully!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
