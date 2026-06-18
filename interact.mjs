import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
mkdirSync("shots", { recursive: true });

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

const clickByText = (text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent.includes(t));
    if (el) el.click();
    return !!el;
  }, text);

// 1. Select the top hotspot
await page.evaluate(() => {
  const card = document.querySelector('[role="button"][tabindex="0"]');
  if (card) card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: "shots/05-selected.png" });
console.log("selected");

// 2. Dispatch a warden to it
await clickByText("Send warden");
await new Promise((r) => setTimeout(r, 1400));
await page.screenshot({ path: "shots/06-dispatched.png" });
console.log("dispatched");

// 3. Speed up and play so the warden arrives and traffic recovers
await clickByText("4×");
await clickByText("Play");
await new Promise((r) => setTimeout(r, 7000));
await page.screenshot({ path: "shots/07-recovered.png" });
console.log("recovered");

await browser.close();
