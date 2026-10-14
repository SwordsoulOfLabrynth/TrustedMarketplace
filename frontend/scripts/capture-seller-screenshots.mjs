import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\Kyaw Zay Ya Hein\\.gemini\\antigravity\\brain\\d5165e98-300f-4220-9ef7-96cb3678cc2b";
const SCREENSHOTS_DIR = "D:\\Project\\TrustedMarketplace\\screenshots";

// Ensure directories exist
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function createSolidPng(width, height, r, g, b) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  function crc32(type, data) {
    const buf = Buffer.concat([Buffer.from(type), data]);
    let c = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
    }
    return (c ^ -1) >>> 0;
  }
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(type, data), 0);
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  }

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0;
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

async function createSampleProductWithImages() {
  const API_BASE = "http://localhost:5248";
  // 1. Login
  const loginRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "artisan.seller@trustedmarketplace.local",
      password: "SellerDemo123!",
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;

  // 2. Categories
  const catRes = await fetch(`${API_BASE}/api/v1/categories`);
  const cats = await catRes.json();
  const catId = cats[0].id;

  // 3. Create product
  const prodRes = await fetch(`${API_BASE}/api/v1/seller/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      categoryId: catId,
      title: "Handmade Mandalay Marionette Puppet (Royal Prince)",
      description: "Carved from seasoned teakwood with 14 articulated silk strings. Dressed in authentic royal court costume with traditional glass beadwork and gold leaf embroidery.",
      priceAmount: 95000,
      condition: "New",
      currencyCode: "MMK",
    }),
  });
  const product = await prodRes.json();

  // 4. Upload 3 sample photos with real artisan colors
  const photo1 = createSolidPng(400, 300, 180, 50, 40); // Bagan Vermilion
  const photo2 = createSolidPng(400, 300, 212, 160, 23); // Mandalay Gold Silk
  const photo3 = createSolidPng(400, 300, 139, 87, 42); // Teak Amber Timber

  for (const [hdr, name, type] of [
    [photo1, "marionette_court.png", "image/png"],
    [photo2, "marionette_silk.png", "image/png"],
    [photo3, "marionette_wood.png", "image/png"],
  ]) {
    const form = new FormData();
    form.append("file", new Blob([hdr], { type }), name);
    await fetch(`${API_BASE}/api/v1/seller/products/${product.id}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  }

  // Publish product so it can be viewed publicly too
  await fetch(`${API_BASE}/api/v1/seller/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  return { productId: product.id, token };
}

async function capture() {
  console.log("Preparing sample product with genuine photography...");
  const { productId, token } = await createSampleProductWithImages();
  console.log(`Product prepared: ${productId}`);

  console.log("Launching headless Edge...");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));

  // Helper to save screenshot both in screenshots/ and in brain/ artifact folder
  async function takePair(name, url, waitForSelector) {
    console.log(`Navigating to ${url}...`);

    // Desktop: 1280x900
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle2" });
    if (waitForSelector) await page.waitForSelector(waitForSelector, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    const deskPath = path.join(SCREENSHOTS_DIR, `${name}-desktop.png`);
    await page.screenshot({ path: deskPath, fullPage: false });
    console.log(`Saved: ${deskPath}`);

    const deskArtifact = path.join(ARTIFACT_DIR, `${name}-desktop.png`);
    fs.copyFileSync(deskPath, deskArtifact);

    // Mobile: 390x844
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.reload({ waitUntil: "networkidle2" });
    if (waitForSelector) await page.waitForSelector(waitForSelector, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    const mobPath = path.join(SCREENSHOTS_DIR, `${name}-mobile.png`);
    await page.screenshot({ path: mobPath, fullPage: false });
    console.log(`Saved: ${mobPath}`);

    const mobArtifact = path.join(ARTIFACT_DIR, `${name}-mobile.png`);
    fs.copyFileSync(mobPath, mobArtifact);
  }

  try {
    // 1. Establish authenticated session in browser
    console.log("Initializing seller session in browser tab...");
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
    await page.evaluate((tok) => {
      sessionStorage.setItem("tm_access_token", tok);
    }, token);
    console.log("Session token set in sessionStorage!");

    // 2. Seller Listings Dashboard (/seller/products)
    await takePair("phase2-seller-products", "http://localhost:3000/seller/products", "h1");

    // 3. New Product Form (/seller/products/new)
    await takePair("phase2-seller-product-new", "http://localhost:3000/seller/products/new", "h1");

    // 4. Product Edit & Photography Workbench (/seller/products/[id]/edit)
    await takePair("phase2-seller-product-edit", `http://localhost:3000/seller/products/${productId}/edit`, "h1");

    // 5. Public Product Detail Page with Multi-Photo Gallery (/products/[id])
    await takePair("phase2-product-detail-photos", `http://localhost:3000/products/${productId}`, "h1");

  } finally {
    await browser.close();
    console.log("All screenshots captured and saved successfully!");
  }
}

capture().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
