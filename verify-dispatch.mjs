import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));

  // Select the first priority-queue card to verify the selected wash + the
  // SelectedHotspot panel populating with a count-up CIS.
  await page.evaluate(() => {
    const card = document.querySelector('li div[role="button"]');
    card?.click();
  });

  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: "dispatch-test.png" });
  await browser.close();
  console.log("captured dispatch-test.png");
})();
