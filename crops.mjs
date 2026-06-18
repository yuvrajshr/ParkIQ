import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
mkdirSync("shots", { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 2 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

const regions = {
  "c-kpi": { x: 76, y: 70, width: 720, height: 230 },
  "c-queue": { x: 1168, y: 56, width: 344, height: 580 },
  "c-strip": { x: 76, y: 738, width: 1080, height: 206 },
};
for (const [name, clip] of Object.entries(regions)) {
  await page.screenshot({ path: `shots/${name}.png`, clip });
  console.log("saved", name);
}
await browser.close();
