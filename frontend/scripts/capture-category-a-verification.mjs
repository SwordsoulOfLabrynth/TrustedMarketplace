import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\Kyaw Zay Ya Hein\\.gemini\\antigravity\\brain\\d5165e98-300f-4220-9ef7-96cb3678cc2b";

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // 1. Log in as Buyer
  console.log("Navigating to login as Buyer...");
  await page.goto("http://localhost:3000/auth/login?returnUrl=/seller/apply", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]');
  await new Promise((r) => setTimeout(r, 500));
  await page.focus('input[type="email"]');
  await page.keyboard.type("buyer@trustedmarketplace.local");
  await page.focus('input[type="password"]');
  await page.keyboard.type("BuyerDemo123!");
  await page.click('button[type="submit"]');
  console.log("Submitted Buyer login, waiting...");
  await new Promise((r) => setTimeout(r, 3500));

  console.log("Navigating directly to /seller/apply...");
  await page.goto("http://localhost:3000/seller/apply", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "seller-apply-page.png"), fullPage: true });
  console.log("Captured seller-apply-page.png");

  // 2. Log in as Admin
  console.log("Navigating to login as Admin...");
  await page.goto("http://localhost:3000/auth/login?returnUrl=/admin", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]');
  await new Promise((r) => setTimeout(r, 500));

  await page.focus('input[type="email"]');
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("admin@trustedmarketplace.local");

  await page.focus('input[type="password"]');
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("AdminDemo123!");

  await page.click('button[type="submit"]');
  console.log("Submitted Admin login, waiting...");
  await new Promise((r) => setTimeout(r, 3500));

  console.log("Navigating directly to /admin...");
  await page.goto("http://localhost:3000/admin", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "admin-verifications-tab.png"), fullPage: true });
  console.log("Captured admin-verifications-tab.png");

  // 3. Switch to Disputes & Complaints tab
  console.log("Switching to Disputes & Complaints tab...");
  const adminTabBtns = await page.$$("button");
  for (const btn of adminTabBtns) {
    const text = await page.evaluate((el) => el.textContent, btn);
    if (text && text.includes("Disputes")) {
      await btn.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "admin-disputes-tab.png"), fullPage: true });
  console.log("Captured admin-disputes-tab.png");

  await browser.close();
  console.log("All screenshots captured successfully!");
}

capture().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
