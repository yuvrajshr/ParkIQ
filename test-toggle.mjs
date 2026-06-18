import puppeteer from "puppeteer";
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle0" });
  
  // Screenshot light mode
  await page.screenshot({ path: "screenshot-light.png", fullPage: true });
  console.log("✓ Light mode screenshot taken");
  
  // Click the moon button (NavRail toggle) — it's in the left sidebar
  const moonBtn = await page.$('button[title*="dark mode"]');
  if (moonBtn) {
    await moonBtn.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: "screenshot-dark.png", fullPage: true });
    console.log("✓ Dark mode screenshot taken");
    
    // Click again to toggle back to light
    await moonBtn.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: "screenshot-light-after-toggle.png", fullPage: true });
    console.log("✓ Light mode after toggle screenshot taken");
  } else {
    console.log("✗ Moon button not found");
  }
  
  await browser.close();
})();
