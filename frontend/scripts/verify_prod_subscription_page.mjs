import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const executablePath = fs.existsSync(EDGE_PATH) ? EDGE_PATH : CHROME_PATH;

const SCREENSHOTS_DIR = "D:\\Project\\TrustedMarketplace\\screenshots\\subscription";
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function verifySubscriptionPage() {
  console.log("Using browser at:", executablePath);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

  // 1. Log in on production
  console.log("Navigating to production login page...");
  await page.goto("https://trusted-marketplace.vercel.app/auth/login", {
    waitUntil: "networkidle2",
    timeout: 45000,
  });

  console.log("Logging in as demo seller...");
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.type('input[type="email"]', "artisan.seller@trustedmarketplace.local");
  await page.type('input[type="password"]', "SellerDemo123!");
  
  // Click sign in button
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  // Wait a couple seconds to ensure cookies/tokens are stored in localStorage
  await new Promise((r) => setTimeout(r, 3000));

  // 2. Navigate to subscription page
  console.log("Navigating to https://trusted-marketplace.vercel.app/seller/subscription...");
  await page.goto("https://trusted-marketplace.vercel.app/seller/subscription", {
    waitUntil: "networkidle2",
    timeout: 45000,
  });

  console.log("Waiting for subscription plans to render...");
  // Wait until the "Loading subscription details..." spinner is gone
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading subscription details..."),
    { timeout: 45000 }
  );
  // Wait an extra second for smooth animation/render
  await new Promise((r) => setTimeout(r, 2000));

  // 3. Inspect page text and DOM
  const pageDetails = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const has30000 = bodyText.includes("30,000") || bodyText.includes("30000");
    const has45000 = bodyText.includes("45,000") || bodyText.includes("45000");

    // Check plan cards
    const cards = Array.from(document.querySelectorAll("div, section"))
      .filter((el) => {
        const text = el.innerText || "";
        return text.includes("Premium") && (text.includes("MMK") || text.includes("/month"));
      })
      .map((el) => el.innerText.slice(0, 200));

    return {
      title: document.title,
      url: window.location.href,
      has30000,
      has45000,
      bodySnippet: bodyText.slice(0, 1000),
      premiumSnippets: cards.slice(0, 5),
    };
  });

  console.log("Subscription page verification result:");
  console.log("- Page Title:", pageDetails.title);
  console.log("- Current URL:", pageDetails.url);
  console.log("- Contains 30,000 MMK:", pageDetails.has30000 ? "YES (PASS)" : "NO (FAIL)");
  console.log("- Contains 45,000 MMK:", pageDetails.has45000 ? "YES (FAIL - Old price still visible!)" : "NO (PASS - Old price gone!)");
  console.log("- Premium Snippets:", pageDetails.premiumSnippets);

  // 4. Select Premium plan and verify dynamic transfer amount
  console.log("Selecting Premium plan card...");
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("div, button, section"));
    const premiumBtn = cards.find(
      (el) =>
        (el.tagName === "BUTTON" || el.getAttribute("role") === "button" || el.className.includes("cursor-pointer")) &&
        el.innerText.includes("Premium")
    ) || Array.from(document.querySelectorAll("div")).find(d => d.innerText.includes("Premium") && d.innerText.includes("30,000"));
    if (premiumBtn) premiumBtn.click();
  });

  await new Promise((r) => setTimeout(r, 1000));

  // Change duration dropdown to 3 Months if available
  const durationValue = await page.evaluate(() => {
    const select = document.querySelector("select");
    if (select) {
      select.value = "3";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  });

  if (durationValue) {
    await new Promise((r) => setTimeout(r, 1000));
    const summaryText = await page.evaluate(() => document.body.innerText);
    const has90000 = summaryText.includes("90,000");
    console.log("- Multi-month calculation (3 months @ 30,000 = 90,000 MMK):", has90000 ? "YES (PASS)" : "NO");
  }

  // Take screenshot with selected plan
  const screenshotDurationPath = path.join(SCREENSHOTS_DIR, "live-prod-subscription-duration-30000.png");
  await page.screenshot({ path: screenshotDurationPath, fullPage: true });
  console.log("Saved selection screenshot to:", screenshotDurationPath);

  await browser.close();

  if (!pageDetails.has30000 || pageDetails.has45000) {
    throw new Error("Live production page verification failed!");
  }

  console.log("\n>>> LIVE PRODUCTION VERIFICATION SUCCESSFUL: Premium plan displays 30,000 MMK/month! <<<");
}

verifySubscriptionPage().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
