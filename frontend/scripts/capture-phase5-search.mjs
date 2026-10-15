import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\Kyaw Zay Ya Hein\\.gemini\\antigravity\\brain\\d5165e98-300f-4220-9ef7-96cb3678cc2b";
const SCREENSHOTS_DIR = "D:\\Project\\TrustedMarketplace\\screenshots";

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function capture() {
  console.log("Launching headless Edge browser...");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

  async function take(name, url, waitSelector) {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    if (waitSelector) {
      await page.waitForSelector(waitSelector, { timeout: 10000 }).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 2000));

    const localFile = path.join(SCREENSHOTS_DIR, `${name}.png`);
    const artifactFile = path.join(ARTIFACT_DIR, `${name}.png`);
    await page.screenshot({ path: localFile, fullPage: false });
    fs.copyFileSync(localFile, artifactFile);
    console.log(`Captured: ${name}.png -> ${artifactFile}`);
  }

  try {
    // 1. Homepage with Bilingual Search and Semantic Tags
    await take("phase5-homepage-bilingual", "http://localhost:3000", "input[placeholder*='English or မြန်မာ']");

    // 2. Burmese Puppetry Search: ရုပ်သေး
    await take(
      "phase5-burmese-search",
      `http://localhost:3000/products?keyword=${encodeURIComponent("ရုပ်သေး")}`,
      "h1"
    );

    // 3. Burmese Lacquerware Search: ယွန်းထည်
    await take(
      "phase5-lacquerware-search",
      `http://localhost:3000/products?keyword=${encodeURIComponent("ယွန်းထည်")}`,
      "h1"
    );

    console.log("All screenshots captured successfully!");
  } finally {
    await browser.close();
  }
}

capture().catch((err) => {
  console.error("Capture error:", err);
  process.exit(1);
});
