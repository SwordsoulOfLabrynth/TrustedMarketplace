import puppeteer from "puppeteer-core";
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
  await page.setViewport({ width: 1280, height: 950 });

  // 1. Log in as Seller (Daw Khin)
  console.log("Logging in as Seller...");
  await page.goto("http://localhost:3000/auth/login?returnUrl=/seller/subscription", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]');
  await new Promise((r) => setTimeout(r, 600));

  await page.focus('input[type="email"]');
  await page.keyboard.type("artisan.seller@trustedmarketplace.local");
  await page.focus('input[type="password"]');
  await page.keyboard.type("SellerDemo123!");
  await page.click('button[type="submit"]');

  console.log("Waiting for /seller/subscription redirect...");
  await new Promise((r) => setTimeout(r, 3500));
  await page.goto("http://localhost:3000/seller/subscription", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "seller-subscription-hub.png"), fullPage: true });
  console.log("Captured seller-subscription-hub.png");

  // 2. Log in as Admin
  console.log("Logging in as Admin...");
  await page.goto("http://localhost:3000/auth/login?returnUrl=/admin", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]');
  await new Promise((r) => setTimeout(r, 600));

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
  console.log("Waiting for /admin redirect...");
  await new Promise((r) => setTimeout(r, 3500));

  await page.goto("http://localhost:3000/admin", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));

  // Click on "Subscriptions & Payments" tab
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes("Subscriptions & Payments")) {
      await btn.click();
      console.log("Clicked Subscriptions & Payments tab");
      break;
    }
  }

  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "admin-subscriptions-tab.png"), fullPage: true });
  console.log("Captured admin-subscriptions-tab.png");

  await browser.close();
  console.log("Done visual captures!");
}

capture().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});
