import puppeteer from "puppeteer";

const args = [
  "--no-sandbox",
  "--ignore-gpu-blocklist",
  "--enable-unsafe-swiftshader",
  "--use-gl=angle",
  "--use-angle=swiftshader",
];
const browser = await puppeteer.launch({ headless: "new", args });
const page = await browser.newPage();
await page.setViewport({ width: 1512, height: 950 });
let tiles = 0;
const statuses = {};
page.on("response", (r) => {
  if (r.url().includes("cartocdn.com")) {
    tiles++;
    statuses[r.status()] = (statuses[r.status()] || 0) + 1;
  }
});
page.on("pageerror", (e) => console.log("PAGEERR:", e.message));
page.on("console", (m) => {
  const t = m.text();
  if (/error|webgl|fail|gl_/i.test(t)) console.log("PAGE:", t);
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));
const sz = await page.evaluate(() => {
  const c = document.querySelector(".maplibregl-canvas");
  return { w: c?.width, h: c?.height, cssW: c?.clientWidth, cssH: c?.clientHeight };
});
console.log("TILES:", tiles, JSON.stringify(statuses));
console.log("CANVAS:", JSON.stringify(sz));
await browser.close();
