import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SCREENSHOTS_DIR = "D:\\Project\\TrustedMarketplace\\screenshots";
const ARTIFACT_DIR = "C:\\Users\\Kyaw Zay Ya Hein\\.gemini\\antigravity\\brain\\ae8f8287-3462-431b-9acd-4ee53cfa8e09";

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function verify() {
  console.log("Launching headless Edge browser...");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

  const targetUrl = "https://trusted-marketplace.vercel.app";
  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 4000));

  const pageInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    const hasPhotographyPending = text.includes("Photography pending");
    const hasPhotoUnavailable = text.includes("Photo unavailable");

    const images = Array.from(document.querySelectorAll("img")).map((img) => ({
      src: img.src,
      alt: img.alt,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      visible: img.offsetWidth > 0 && img.offsetHeight > 0,
    }));

    const productCards = Array.from(document.querySelectorAll("a[href^='/products/']")).map((a) => {
      return {
        href: a.getAttribute("href"),
        title: a.querySelector("h3")?.innerText || a.innerText,
        hasImg: !!a.querySelector("img"),
        imgSrc: a.querySelector("img")?.src || null,
        imgLoaded: (a.querySelector("img")?.naturalWidth || 0) > 0,
        textSnippet: a.innerText.slice(0, 80),
      };
    });

    return {
      hasPhotographyPending,
      hasPhotoUnavailable,
      imagesCount: images.length,
      images,
      productCards,
    };
  });

  console.log("Page inspection result:", JSON.stringify(pageInfo, null, 2));

  // Take desktop screenshot
  const desktopPath = path.join(SCREENSHOTS_DIR, "prod-home-fixed-desktop.png");
  await page.screenshot({ path: desktopPath, fullPage: false });
  console.log(`Saved screenshot to ${desktopPath}`);
  fs.copyFileSync(desktopPath, path.join(ARTIFACT_DIR, "prod-home-fixed-desktop.png"));

  // Mobile viewport
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 3000));

  const mobilePath = path.join(SCREENSHOTS_DIR, "prod-home-fixed-mobile.png");
  await page.screenshot({ path: mobilePath, fullPage: false });
  console.log(`Saved mobile screenshot to ${mobilePath}`);
  fs.copyFileSync(mobilePath, path.join(ARTIFACT_DIR, "prod-home-fixed-mobile.png"));

  await browser.close();
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
